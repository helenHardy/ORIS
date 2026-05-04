-- ========================================================
-- GACIA ERP - INVENTORY INTEGRITY & VISIBILITY SYNC
-- ========================================================
-- 1. Initialize missing settings for ALL (product, branch) combinations
-- This ensures that every existing product is visible in every existing branch.
INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock)
SELECT p.id, b.id, 0, 0
FROM public.products p
CROSS JOIN public.branches b
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.product_branch_settings s 
    WHERE s.product_id = p.id AND s.branch_id = b.id
)
ON CONFLICT DO NOTHING;

-- 2. Trigger for NEW PRODUCTS
-- Every time a product is created, initialize it in all active branches.
CREATE OR REPLACE FUNCTION public.initialize_product_branch_settings()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock)
    SELECT new.id, b.id, 0, 0
    FROM public.branches b
    WHERE b.active = true
    ON CONFLICT DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_product_branches ON public.products;
CREATE TRIGGER trg_init_product_branches
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.initialize_product_branch_settings();

-- 3. Trigger for NEW BRANCHES
-- Every time a branch is created, initialize it with all existing active products.
CREATE OR REPLACE FUNCTION public.initialize_branch_product_settings()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock)
    SELECT p.id, new.id, 0, 0
    FROM public.products p
    WHERE p.active = true
    ON CONFLICT DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_branch_products ON public.branches;
CREATE TRIGGER trg_init_branch_products
AFTER INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.initialize_branch_product_settings();

-- 4. Global Stock Sync Trigger (Already exists, but re-evaluating for safety)
-- This ensures products.stock is ALWAYS the sum of all branches.
CREATE OR REPLACE FUNCTION public.handle_product_branch_changes()
RETURNS trigger AS $$
DECLARE
    v_new_global_stock numeric;
    v_diff numeric;
    v_is_internal text;
BEGIN
    -- Update global stock
    SELECT COALESCE(SUM(stock), 0) INTO v_new_global_stock
    FROM public.product_branch_settings
    WHERE product_id = COALESCE(new.product_id, old.product_id);

    UPDATE public.products 
    SET stock = v_new_global_stock
    WHERE id = COALESCE(new.product_id, old.product_id);

    -- Log manual adjustments to Kardex
    v_is_internal := current_setting('app.internal_stock_update', true);
    
    IF (v_is_internal IS NULL OR v_is_internal != 'true') THEN
        IF (TG_OP = 'UPDATE') THEN
            v_diff := new.stock - old.stock;
            IF v_diff != 0 THEN
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                VALUES (new.branch_id, new.product_id, 'AJUSTE_MANUAL', v_diff, new.stock, 'Ajuste manual de inventario');
            END IF;
        ELSIF (TG_OP = 'INSERT') THEN
            IF new.stock != 0 THEN
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                VALUES (new.branch_id, new.product_id, 'CARGA_INICIAL', new.stock, new.stock, 'Carga inicial de inventario');
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
