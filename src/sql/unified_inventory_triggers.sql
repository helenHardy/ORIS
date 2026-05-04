-- ========================================================
-- GACIA ERP - UNIFIED INVENTORY & STOCK TRIGGERS (PRODUCTION)
-- ========================================================

-- 1. RE-ENTRANCY PROTECTION FLAG (Global)
-- This facilitates preventing double-deduction when a parent (Sale/Purchase) is deleted.

-- 2. UNIFIED SALE ITEM TRIGGER
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    -- GUARD: If parent Sale is being deleted, sub-items are handled by parent trigger to avoid double counting
    IF (TG_OP = 'DELETE' AND current_setting('app.is_parent_deleting', true) = 'true') THEN
        RETURN old;
    END IF;

    -- GET BRANCH
    IF (TG_OP = 'DELETE') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = old.sale_id;
    ELSE
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
    END IF;

    IF (v_branch_id IS NULL) THEN RETURN coalesce(new, old); END IF;

    -- OPERATIONS
    IF (TG_OP = 'INSERT') THEN
        IF (new.is_damaged = true) THEN
            UPDATE public.product_branch_settings 
            SET damaged_stock = damaged_stock - new.quantity 
            WHERE product_id = new.product_id AND branch_id = v_branch_id
            RETURNING damaged_stock INTO v_new_stock;
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA_MERMA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta de producto dañado');
        ELSE
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada');
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle changes in is_damaged status or quantity
        IF (COALESCE(old.is_damaged, false) != COALESCE(new.is_damaged, false)) THEN
            -- Revert old
            IF (old.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + old.quantity WHERE product_id = old.product_id AND branch_id = v_branch_id;
            ELSE
                v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            END IF;
            -- Apply new
            IF (new.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock - new.quantity WHERE product_id = new.product_id AND branch_id = v_branch_id RETURNING damaged_stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MOD_VENTA_MERMA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta merma');
            ELSE
                v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MOD_VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta normal');
            END IF;
        ELSE
            -- Quantity changed only
            v_diff := new.quantity - old.quantity;
            IF v_diff != 0 THEN
                IF (new.is_damaged = true) THEN
                    UPDATE public.product_branch_settings SET damaged_stock = damaged_stock - v_diff WHERE product_id = new.product_id AND branch_id = v_branch_id RETURNING damaged_stock INTO v_new_stock;
                    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                    VALUES (v_branch_id, new.product_id, 'MOD_VENTA_MERMA', -v_diff, v_new_stock, new.sale_id::text, 'Ajuste cantidad venta merma');
                ELSE
                    v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -v_diff);
                    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                    VALUES (v_branch_id, new.product_id, 'MOD_VENTA', -v_diff, v_new_stock, new.sale_id::text, 'Ajuste cantidad venta normal');
                END IF;
            END IF;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        IF (old.is_damaged = true) THEN
            UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + old.quantity WHERE product_id = old.product_id AND branch_id = v_branch_id RETURNING damaged_stock INTO v_new_stock;
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'ANULACION_VENTA_MERMA', old.quantity, v_new_stock, old.sale_id::text, 'Venta merma anulada');
        ELSE
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'ANULACION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta anulada');
        END IF;
    END IF;

    RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. UNIFIED SALE DELETE TRIGGER (Parent)
CREATE OR REPLACE FUNCTION public.handle_sale_delete()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    PERFORM set_config('app.is_parent_deleting', 'true', true);

    FOR t_item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        IF (t_item.is_damaged = true) THEN
            UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + t_item.quantity WHERE product_id = t_item.product_id AND branch_id = old.branch_id RETURNING damaged_stock INTO v_new_stock;
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.branch_id, t_item.product_id, 'ANUL_TOT_VENTA_MERMA', t_item.quantity, v_new_stock, old.id::text, 'Venta merma eliminada por completo');
        ELSE
            v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.branch_id, t_item.product_id, 'ANUL_TOT_VENTA', t_item.quantity, v_new_stock, old.id::text, 'Venta eliminada por completo');
        END IF;
    END LOOP;

    PERFORM set_config('app.is_parent_deleting', 'false', true);
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. REINSTALL ALL SALE TRIGGERS
DROP TRIGGER IF EXISTS trg_kardex_sale_changes ON public.sale_items;
DROP TRIGGER IF EXISTS trg_kardex_sale_insert_update ON public.sale_items;
DROP TRIGGER IF EXISTS trg_kardex_sale_delete ON public.sale_items;

CREATE TRIGGER trg_kardex_sale_main 
AFTER INSERT OR UPDATE OR DELETE ON public.sale_items 
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

DROP TRIGGER IF EXISTS trg_sale_delete_stock ON public.sales;
CREATE TRIGGER trg_sale_delete_stock 
BEFORE DELETE ON public.sales 
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_delete();

-- 5. INITIALIZE ALL BRANCHES & PRODUCTS (Sync)
INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock, damaged_stock)
SELECT p.id, b.id, 0, 0, 0
FROM public.products p
CROSS JOIN public.branches b
WHERE NOT EXISTS (
    SELECT 1 FROM public.product_branch_settings s WHERE s.product_id = p.id AND s.branch_id = b.id
)
ON CONFLICT DO NOTHING;

-- 6. AUTOMATION TRIGGERS FOR NEW DATA
CREATE OR REPLACE FUNCTION public.initialize_product_branch_settings()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock, damaged_stock)
    SELECT new.id, b.id, 0, 0, 0 FROM public.branches b WHERE b.active = true
    ON CONFLICT DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_product_branches ON public.products;
CREATE TRIGGER trg_init_product_branches AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.initialize_product_branch_settings();

CREATE OR REPLACE FUNCTION public.initialize_branch_product_settings()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock, damaged_stock)
    SELECT p.id, new.id, 0, 0, 0 FROM public.products p WHERE p.active = true
    ON CONFLICT DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_branch_products ON public.branches;
CREATE TRIGGER trg_init_branch_products AFTER INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.initialize_branch_product_settings();
