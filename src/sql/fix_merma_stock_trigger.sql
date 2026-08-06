-- ============================================================
-- GACIA ERP - FIX VENTAS DE MERMAS (is_damaged-aware stock)
-- ============================================================
-- PROPOSITO:
--   El trigger/funcion handle_sale_item_changes() descuentaba TODA
--   venta del stock NORMAL (product_branch_settings.stock), ignorando
--   la columna sale_items.is_damaged. Las ventas de merma debian
--   descontar de damaged_stock, no de stock.
--
-- SOLUCION:
--   Se reemplazan EN SU LUGAR las 2 funciones en produccion, manteniendo
--   los triggers existentes intactos (no se dropean ni duplican):
--     - sale_items.trg_sale_items_stock_after  (INSERT/UPDATE) -> handle_sale_item_changes()
--     - sale_items.trg_sale_items_stock_before (DELETE)        -> handle_sale_item_changes()
--     - sales.trg_sales_master_before/after                    -> handle_sale_master_changes()
--   Guard de reentrada 'app.is_parent_deleting' preservado para evitar
--   doble descuento cuando el maestro (venta) se elimina por completo.
--
-- COMO APLICAR:
--   Pegar en Supabase -> SQL Editor y ejecutar. Idempotente (CREATE OR REPLACE).
--
-- ROLLBACK:
--   Restaurar el backup generado antes de la aplicacion
--   (backup_before_fix.sql). Ese archivo contiene las definiciones
--   originales de las 6 funciones de inventario.
-- ============================================================

-- 1) SALE ITEM HANDLER: respecta is_damaged (merma) en INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    -- Prevenir doble disparo cuando la venta padre se esta eliminando
    IF current_setting('app.is_parent_deleting', true) = 'true' THEN
        RETURN coalesce(new, old);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
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
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
        IF (v_branch_id IS NULL) THEN RETURN new; END IF;

        IF (COALESCE(old.is_damaged, false) != COALESCE(new.is_damaged, false)) THEN
            -- Revertir disposicion anterior
            IF (old.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + old.quantity
                WHERE product_id = old.product_id AND branch_id = v_branch_id;
            ELSE
                PERFORM public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            END IF;
            -- Aplicar disposicion nueva
            IF (new.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock - new.quantity
                WHERE product_id = new.product_id AND branch_id = v_branch_id
                RETURNING damaged_stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MOD_VENTA_MERMA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta merma');
            ELSE
                v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MOD_VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta normal');
            END IF;
        ELSE
            -- Cambio solo de cantidad
            v_diff := new.quantity - old.quantity;
            IF v_diff != 0 THEN
                IF (new.is_damaged = true) THEN
                    UPDATE public.product_branch_settings SET damaged_stock = damaged_stock - v_diff
                    WHERE product_id = new.product_id AND branch_id = v_branch_id
                    RETURNING damaged_stock INTO v_new_stock;
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
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = old.sale_id;
        IF (v_branch_id IS NOT NULL) THEN
            IF (old.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + old.quantity
                WHERE product_id = old.product_id AND branch_id = v_branch_id
                RETURNING damaged_stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, old.product_id, 'REVERSION_ITEM_MERMA', old.quantity, v_new_stock, old.sale_id::text, 'Item merma eliminado de venta');
            ELSE
                v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, old.product_id, 'REVERSION_ITEM', old.quantity, v_new_stock, old.sale_id::text, 'Item eliminado de venta');
            END IF;
        END IF;
    END IF;

    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) SALE MASTER HANDLER: restituye damaged_stock en la anulacion total
--    (la logica de credito en INSERT/UPDATE queda intacta)
CREATE OR REPLACE FUNCTION public.handle_sale_master_changes()
RETURNS trigger AS $$
DECLARE
    t_item RECORD;
    v_new_stock numeric;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM set_config('app.is_parent_deleting', 'true', true);

        FOR t_item IN SELECT * FROM public.sale_items WHERE sale_id = old.id LOOP
            IF (t_item.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + t_item.quantity
                WHERE product_id = t_item.product_id AND branch_id = old.branch_id
                RETURNING damaged_stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (old.branch_id, t_item.product_id, 'ANULACION_VENTA_TOTAL_MERMA', t_item.quantity, v_new_stock, old.id::text, 'Venta merma anulada # ' || old.sale_number);
            ELSE
                v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (old.branch_id, t_item.product_id, 'ANULACION_VENTA_TOTAL', t_item.quantity, v_new_stock, old.id::text, 'Venta anulada # ' || old.sale_number);
            END IF;
        END LOOP;

        IF (old.is_credit = true AND old.customer_id IS NOT NULL) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) - old.total WHERE id = old.customer_id;
        END IF;

        PERFORM set_config('app.is_parent_deleting', 'false', true);
        RETURN old;

    ELSIF (TG_OP = 'INSERT') THEN
        IF (new.is_credit = true AND new.customer_id IS NOT NULL) THEN
            UPDATE public.customers SET current_balance = coalesce(current_balance, 0) + new.total WHERE id = new.customer_id;
        END IF;
        RETURN new;

    ELSIF (TG_OP = 'UPDATE') THEN
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

-- ============================================================
-- NOTA SOBRE CONCILIACION HISTORICA:
--   Las ventas de merma realizadas ANTES de este fix quedaron mal
--   deducidas del stock normal. Se corrigio de forma puntual en
--   produccion: para cada (producto, sucursal) con sale_items is_damaged,
--   se hizo  stock = stock + SUM(quantity de merma vendida)  y
--   damaged_stock = damaged_stock - SUM(quantity de merma vendida).
--   Consulte backup_pbs_before_recon.json (antes) si necesita revertir.
-- ============================================================