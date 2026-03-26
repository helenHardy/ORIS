-- ========================================================
-- GACIA ERP - UNIFIED STOCK & KARDEX FIX (FINAL VERSION)
-- ========================================================
-- This script eliminates ALL duplicate triggers and sets up 
-- a single, robust source of truth for stock movements.
-- ========================================================

-- 1. CLEANUP ALL POSSIBLE OLD TRIGGERS
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- Sale Items Triggers
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'sale_items' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.sale_items CASCADE'; 
    END LOOP;

    -- Sales Triggers (except for credit sync if needed, but we'll re-install correctly)
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'sales' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.sales CASCADE'; 
    END LOOP;

    -- Purchase Items Triggers
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'purchase_items' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.purchase_items CASCADE'; 
    END LOOP;

    -- Purchases Triggers
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'purchases' AND event_object_schema = 'public') LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.purchases CASCADE'; 
    END LOOP;
END $$;

-- 2. RE-INSTALL MASTER LOGIC FOR SALES (One function handles all)

-- Function for INDIVIDUAL ITEMS (When they are inserted or updated directly)
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    -- Prevent double-firing if parent sale is being deleted
    IF current_setting('app.is_parent_deleting', true) = 'true' THEN
        RETURN coalesce(new, old);
    END IF;

    -- INSERT: New item sold
    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada');
        END IF;

    -- UPDATE: Quantity changed
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (old.quantity != new.quantity) THEN
            v_diff := new.quantity - old.quantity;
            SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
            IF (v_branch_id IS NOT NULL) THEN
                v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -v_diff);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MODIFICACION_VENTA', -v_diff, v_new_stock, new.sale_id::text, 'Cantidad modificada');
            END IF;
        END IF;

    -- DELETE: Single item removed (not part of a sale deletion)
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = old.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'REVERSION_ITEM', old.quantity, v_new_stock, old.sale_id::text, 'Item eliminado de venta');
        END IF;
    END IF;

    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for PARENT SALE (Deletions and Credit)
CREATE OR REPLACE FUNCTION public.handle_sale_master_changes()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    -- [A] HANDLE DELETION (Stock reversion)
    IF (TG_OP = 'DELETE') THEN
        -- Mark as parent deletion to stop item triggers
        PERFORM set_config('app.is_parent_deleting', 'true', true);

        FOR t_item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
            v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.branch_id, t_item.product_id, 'ANULACION_VENTA_TOTAL', t_item.quantity, v_new_stock, old.id::text, 'Venta anulada # ' || old.sale_number);
        END LOOP;

        -- Substract from customer balance if credit
        IF (old.is_credit = true AND old.customer_id IS NOT NULL) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
        END IF;

        PERFORM set_config('app.is_parent_deleting', 'false', true);
        RETURN old;

    -- [B] HANDLE INSERT/UPDATE (Credit tracking only, stock is by items)
    ELSIF (TG_OP = 'INSERT') THEN
        IF (new.is_credit = true AND new.customer_id IS NOT NULL) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
        END IF;
        RETURN new;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case: Changed from cash to credit or vice versa
        IF (old.is_credit = false AND new.is_credit = true) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
        ELSIF (old.is_credit = true AND new.is_credit = false) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
        ELSIF (old.is_credit = true AND new.is_credit = true AND old.total != new.total) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + (new.total - old.total) WHERE id = new.customer_id;
        END IF;
        RETURN new;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-INSTALL SALE TRIGGERS
CREATE TRIGGER trg_sale_items_stock_after
AFTER INSERT OR UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

CREATE TRIGGER trg_sale_items_stock_before
BEFORE DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

CREATE TRIGGER trg_sales_master_after
AFTER INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_master_changes();

CREATE TRIGGER trg_sales_master_before
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_master_changes();

-- 4. SIMILAR LOGIC FOR PURCHASES (Avoid duplication too)

CREATE OR REPLACE FUNCTION public.handle_purchase_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    IF current_setting('app.is_parent_deleting', true) = 'true' THEN
        RETURN coalesce(new, old);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.purchases WHERE id = new.purchase_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'COMPRA', new.quantity, v_new_stock, new.purchase_id::text, 'Compra recibida');
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT branch_id INTO v_branch_id FROM public.purchases WHERE id = old.purchase_id;
        IF (v_branch_id IS NOT NULL) THEN
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, -old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'REVERSION_COMPRA', -old.quantity, v_new_stock, old.purchase_id::text, 'Item eliminado de compra');
        END IF;
    END IF;
    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_purchase_master_changes()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM set_config('app.is_parent_deleting', 'true', true);
        FOR t_item IN SELECT * FROM public.purchase_items WHERE purchase_id = old.id LOOP
            v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, -t_item.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.branch_id, t_item.product_id, 'ANULACION_COMPRA_TOTAL', -t_item.quantity, v_new_stock, old.id::text, 'Compra anulada total');
        END LOOP;
        PERFORM set_config('app.is_parent_deleting', 'false', true);
    END IF;
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_purchase_items_stock_after
AFTER INSERT OR UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

CREATE TRIGGER trg_purchase_items_stock_before
BEFORE DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_item_changes();

CREATE TRIGGER trg_purchases_master_before
BEFORE DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_master_changes();

-- 5. FINAL REPAIR & SYNC
-- This will recalculate all branch stocks based on the items in DB.
-- WARNING: This assumes that sale_items and purchase_items are the current "Truth".

UPDATE public.product_branch_settings SET stock = 0;

DO $$
DECLARE itm RECORD;
BEGIN
    -- Compras
    FOR itm IN SELECT pi.product_id, pi.quantity, p.branch_id FROM public.purchase_items pi JOIN public.purchases p ON pi.purchase_id = p.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, itm.quantity);
    END LOOP;
    -- Ventas
    FOR itm IN SELECT si.product_id, si.quantity, s.branch_id FROM public.sale_items si JOIN public.sales s ON si.sale_id = s.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, -itm.quantity);
    END LOOP;
    -- Traspasos
    FOR itm IN SELECT ti.product_id, ti.quantity, t.origin_branch_id, t.destination_branch_id FROM public.transfer_items ti JOIN public.transfers t ON ti.transfer_id = t.id WHERE t.status = 'Recibido' LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.origin_branch_id, -itm.quantity);
        PERFORM public.update_branch_stock(itm.product_id, itm.destination_branch_id, itm.quantity);
    END LOOP;
END $$;

-- Sync Global Product Stock One Last Time
UPDATE public.products p SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_branch_settings s WHERE s.product_id = p.id);

-- DONE
