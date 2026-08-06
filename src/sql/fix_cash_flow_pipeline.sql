-- ============================================================
-- GACIA ERP - FIX FLUJO DE CAJA (reflect payments Efectivo/QR)
-- ============================================================
-- PROPOSITO:
--   Las ventas NO generaban movimientos de caja en produccion
--   (faltaba el trigger), por lo que el Historial estaba vacio y
--   cash_boxes.balance no reflejaba los ingresos (ventas/pagos).
--   Ademas, fn_process_cash_movement solo contaba el metodo Efectivo.
--
-- CAMBIOS:
--   1. cash_movements.method (text) para el desglose por metodo.
--   2. fn_process_cash_movement ahora registra TODOS los metodos de
--      pago (Efectivo, QR, Transferencia, Deposito, Mixto...); las
--      ventas a credito se excluyen. Añade rama para expenses.
--   3. Trigger trg_sales_cash_movement (AFTER INSERT ON sales) para
--      que las ventas futuras registren su INGRESO en caja.
--      NOTA: las compras NO se descuentan del saldo (decision de
--      negocio: se pagan con capital externo). Los egresos provienen
--      de purchase_payments y expenses.
--
-- RECONSTRUCCION HISTORICA (aplicada aparte, en transaccion):
--   - Se reconstruyeron cash_movements desde: sales (no-credito) +
--     customer_payments (INGRESO) + purchase_payments + expenses (EGRESO).
--   - cash_boxes.balance = saldo inicial conservado + neto de movimientos.
--   Resultado: CAJA EFECTIVO ~110.449,22 | CAJA QR DENIS ~7.182,40 |
--   CAJA QR CIELO ~22.327,49. Respaldo previo: backup_cashboxes.json /
--   backup_cashmovements.json.
--
-- COMO APLICAR: pegar en Supabase -> SQL Editor y ejecutar (idempotente).
-- ============================================================

ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS method text;

CREATE OR REPLACE FUNCTION public.fn_process_cash_movement()
RETURNS trigger AS $$
DECLARE
    v_cash_box_id bigint;
    v_amount numeric;
    v_type text;
    v_desc text;
    v_user_id uuid;
    v_branch_id bigint;
    v_method text;
BEGIN
    IF TG_TABLE_NAME = 'sales' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.total;
        v_type := 'INGRESO';
        v_desc := 'Venta #' || NEW.sale_number;
        v_user_id := NEW.user_id;
        v_branch_id := NEW.branch_id;
        v_method := NEW.payment_method;
        IF NEW.is_credit = true THEN
            RETURN NEW;
        END IF;

    ELSIF TG_TABLE_NAME = 'purchases' THEN
        v_cash_box_id := NEW.cash_box_id;
        IF NEW.is_credit = true THEN
            v_amount := NEW.amount_paid;
        ELSE
            v_amount := NEW.total;
        END IF;
        v_type := 'EGRESO';
        v_desc := 'Compra #' || NEW.purchase_number;
        v_user_id := NEW.user_id;
        v_branch_id := NEW.branch_id;
        v_method := NEW.payment_method;
        IF v_amount <= 0 OR v_cash_box_id IS NULL THEN
            RETURN NEW;
        END IF;

    ELSIF TG_TABLE_NAME = 'customer_payments' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.amount;
        v_type := 'INGRESO';
        v_desc := 'Pago de Cliente';
        v_user_id := NEW.user_id;
        v_method := NEW.payment_method;

    ELSIF TG_TABLE_NAME = 'expenses' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.amount;
        v_type := 'EGRESO';
        v_desc := 'Gasto: ' || COALESCE(NEW.category, NEW.description, 'Gasto');
        v_user_id := NEW.user_id;
        v_method := 'Efectivo';
    END IF;

    IF v_cash_box_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_type = 'INGRESO' THEN
        UPDATE public.cash_boxes SET balance = balance + v_amount WHERE id = v_cash_box_id;
    ELSE
        UPDATE public.cash_boxes SET balance = balance - v_amount WHERE id = v_cash_box_id;
    END IF;

    INSERT INTO public.cash_movements (cash_box_id, amount, type, description, reference_id, user_id, method)
    VALUES (v_cash_box_id, v_amount, v_type, v_desc, NEW.id::text, v_user_id, v_method);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_cash_movement ON public.sales;
CREATE TRIGGER trg_sales_cash_movement
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.fn_process_cash_movement();
