-- ==========================================
-- GACIA ERP - TRIGGER ROBUSTNESS FIX
-- ==========================================
-- This script moves the stock reversal logic to the 
-- parent tables (Purchases/Sales) to avoid NULL branch_id 
-- errors during cascaded deletes.
-- ==========================================

-- 1. Remove item-level delete triggers
DROP TRIGGER IF EXISTS trg_kardex_purchase_delete ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_kardex_sale_delete ON public.sale_items;

-- 2. Create updated handle_purchase_delete function
CREATE OR REPLACE FUNCTION public.handle_purchase_delete()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    -- Reverse stock for all items in the purchase before they are gone
    FOR t_item IN SELECT * FROM public.purchase_items WHERE purchase_id = old.id LOOP
        v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, -t_item.quantity);
        
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, t_item.product_id, 'ANULACION_COMPRA', -t_item.quantity, v_new_stock, old.id::text, 'Compra anulada (reversión stock)');
    END LOOP;
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create updated handle_sale_delete function
CREATE OR REPLACE FUNCTION public.handle_sale_delete()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    -- Reverse stock for all items in the sale
    FOR t_item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
        v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
        
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (old.branch_id, t_item.product_id, 'ANULACION_VENTA', t_item.quantity, v_new_stock, old.id::text, 'Venta anulada (reversión stock)');
    END LOOP;
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-install triggers on parent tables
DROP TRIGGER IF EXISTS trg_purchase_delete_stock ON public.purchases;
CREATE TRIGGER trg_purchase_delete_stock
BEFORE DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_delete();

DROP TRIGGER IF EXISTS trg_sale_delete_stock ON public.sales;
CREATE TRIGGER trg_sale_delete_stock
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_delete();

-- 5. Fix handle_sale_item_changes to ONLY handle INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada');
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle quantity changes only if they are positive (more sold)
        -- We won't handle DELETE here anymore.
        NULL;
    END IF;
    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
