-- ==========================================
-- GACIA ERP - STOCK REPAIR & SYNC
-- ==========================================
-- This script recalculates all stock levels based on 
-- existing Purchases, Sales, and Transfers.
-- ==========================================

-- 1. Reset all stock to 0 before recalculating
UPDATE public.product_branch_settings SET stock = 0;
UPDATE public.products SET stock = 0;
DELETE FROM public.kardex;

-- 2. Sync from Purchases
DO $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    FOR item IN 
        SELECT pi.product_id, pi.quantity, p.branch_id, p.id as ref_id
        FROM public.purchase_items pi
        JOIN public.purchases p ON pi.purchase_id = p.id
    LOOP
        -- Update branch stock
        INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock)
        VALUES (item.product_id, item.branch_id, item.quantity, 0)
        ON CONFLICT (product_id, branch_id)
        DO UPDATE SET stock = product_branch_settings.stock + item.quantity
        RETURNING stock INTO v_new_stock;

        -- Log to Kardex
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (item.branch_id, item.product_id, 'COMPRA_RELOG', item.quantity, v_new_stock, item.ref_id::text, 'Sincronización manual de compra');
    END LOOP;
END $$;

-- 3. Sync from Sales
DO $$
DECLARE
    item RECORD;
    v_new_stock numeric;
BEGIN
    FOR item IN 
        SELECT si.product_id, si.quantity, s.branch_id, s.id as ref_id
        FROM public.sale_items si
        JOIN public.sales s ON si.sale_id = s.id
    LOOP
        -- Update branch stock
        INSERT INTO public.product_branch_settings (product_id, branch_id, stock, min_stock)
        VALUES (item.product_id, item.branch_id, -item.quantity, 0)
        ON CONFLICT (product_id, branch_id)
        DO UPDATE SET stock = product_branch_settings.stock - item.quantity
        RETURNING stock INTO v_new_stock;

        -- Log to Kardex
        INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        VALUES (item.branch_id, item.product_id, 'VENTA_RELOG', -item.quantity, v_new_stock, item.ref_id::text, 'Sincronización manual de venta');
    END LOOP;
END $$;

-- 4. Final Sync to Global Products
UPDATE public.products p
SET stock = (
    SELECT COALESCE(SUM(stock), 0)
    FROM public.product_branch_settings s
    WHERE s.product_id = p.id
);
