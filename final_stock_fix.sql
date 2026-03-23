-- ========================================================
-- GACIA ERP - STOCK CONSISTENCY FIX (FINAL)
-- ========================================================
-- This script fixes the issue where modifying a sale
-- caused a double discount because deletions weren't logged.
-- ========================================================

-- 1. Optimized trigger for sales items (sale_items)
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
BEGIN
    -- INSERT: Discount stock
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada');
        END IF;
        
    -- DELETE: Reverse stock (Only if not being handled by parent trigger)
    ELSIF (TG_OP = 'DELETE') THEN
        -- Check if we are inside a parent delete (sales) to avoid double counting
        IF current_setting('app.is_parent_deleting', true) = 'true' THEN
            RETURN old;
        END IF;

        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = old.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'REVERSION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta modificada/anulada');
        END IF;
    END IF;
    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Optimized trigger for main sales (sales)
CREATE OR REPLACE FUNCTION public.handle_sale_delete()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    -- Mark that we are deleting the parent to prevent item triggers from firing
    PERFORM set_config('app.is_parent_deleting', 'true', true);

    FOR t_item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, t_item.product_id, 'ANULACION_VENTA_TOTAL', t_item.quantity, v_new_stock, old.id::text, 'Venta eliminada por completo');
    END LOOP;

    -- Reset the flag
    PERFORM set_config('app.is_parent_deleting', 'false', true);
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY TO PURCHASES AS WELL (Same logic)
CREATE OR REPLACE FUNCTION public.handle_purchase_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.purchases WHERE id = new.purchase_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'COMPRA', new.quantity, v_new_stock, new.purchase_id::text, 'Compra registrada');
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF current_setting('app.is_parent_deleting', true) = 'true' THEN RETURN old; END IF;
        SELECT branch_id INTO v_branch_id FROM public.purchases WHERE id = old.purchase_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, -old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'REVERSION_COMPRA', -old.quantity, v_new_stock, old.purchase_id::text, 'Compra modificada/anulada');
        END IF;
    END IF;
    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_purchase_delete()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    PERFORM set_config('app.is_parent_deleting', 'true', true);
    FOR t_item IN SELECT * FROM public.purchase_items WHERE purchase_id = old.id LOOP
        v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, -t_item.quantity);
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, t_item.product_id, 'ANULACION_COMPRA_TOTAL', -t_item.quantity, v_new_stock, old.id::text, 'Compra eliminada por completo');
    END LOOP;
    PERFORM set_config('app.is_parent_deleting', 'false', true);
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-INSTALL ALL TRIGGERS
DROP TRIGGER IF EXISTS trg_kardex_sale_insert_update ON public.sale_items;
CREATE TRIGGER trg_kardex_sale_changes AFTER INSERT OR DELETE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

DROP TRIGGER IF EXISTS trg_kardex_purchase_insert_update ON public.purchase_items;
CREATE TRIGGER trg_kardex_purchase_changes AFTER INSERT OR DELETE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

DROP TRIGGER IF EXISTS trg_purchase_delete_stock ON public.purchases;
CREATE TRIGGER trg_purchase_delete_stock BEFORE DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_delete();

DROP TRIGGER IF EXISTS trg_sale_delete_stock ON public.sales;
CREATE TRIGGER trg_sale_delete_stock BEFORE DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.handle_sale_delete();


-- 5. PERFORM ONE FINAL REPAIR (Sync everything correctly)
UPDATE public.product_branch_settings SET stock = 0;
DELETE FROM public.kardex;

DO $$
DECLARE itm RECORD;
BEGIN
    -- Compras
    FOR itm IN SELECT pi.product_id, pi.quantity, p.branch_id, p.id FROM public.purchase_items pi JOIN public.purchases p ON pi.purchase_id = p.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, itm.quantity);
    END LOOP;
    -- Ventas
    FOR itm IN SELECT si.product_id, si.quantity, s.branch_id FROM public.sale_items si JOIN public.sales s ON si.sale_id = s.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, -itm.quantity);
    END LOOP;
    -- Traspasos Recibidos
    FOR itm IN SELECT ti.product_id, ti.quantity, t.origin_branch_id, t.destination_branch_id FROM public.transfer_items ti JOIN public.transfers t ON ti.transfer_id = t.id WHERE t.status IN ('Recibido', 'Completado') LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.origin_branch_id, -itm.quantity);
        PERFORM public.update_branch_stock(itm.product_id, itm.destination_branch_id, itm.quantity);
    END LOOP;
END $$;

UPDATE public.products p SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_branch_settings s WHERE s.product_id = p.id);
