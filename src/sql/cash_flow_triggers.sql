-- ========================================================
-- GACIA ERP - CASH FLOW & SALES INTEGRATION (PRODUCTION)
-- ========================================================

-- 1. Create cash_movements table for financial history
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cash_box_id uuid REFERENCES public.cash_boxes(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id),
    type text NOT NULL, -- INGRESO, EGRESO, APERTURA, CIERRE
    amount numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- Permissions
GRANT ALL ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

-- RLS
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.cash_movements;
CREATE POLICY "Permitir lectura para autenticados" ON public.cash_movements FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.cash_movements;
CREATE POLICY "Permitir gestión para Administradores" ON public.cash_movements FOR ALL USING (public.is_admin());

-- 2. Trigger Function to link Sales with Cash Flow
CREATE OR REPLACE FUNCTION public.handle_sale_cash_flow()
RETURNS trigger AS $$
DECLARE
    v_box_name text;
BEGIN
    -- Only process if payment is NOT credit and a cash_box_id is provided
    IF (new.is_credit = false AND new.cash_box_id IS NOT NULL AND new.status = 'Completada') THEN
        
        -- Get box name for description
        SELECT name INTO v_box_name FROM public.cash_boxes WHERE id = new.cash_box_id;

        -- 1. Create Movement Record
        INSERT INTO public.cash_movements (cash_box_id, sale_id, user_id, type, amount, description)
        VALUES (
            new.cash_box_id, 
            new.id, 
            new.user_id, 
            'INGRESO', 
            new.total, 
            'Venta registrada #' || substring(new.id::text, 1, 8) || ' en ' || COALESCE(v_box_name, 'Caja')
        );

        -- 2. Update Cash Box Balance
        UPDATE public.cash_boxes 
        SET balance = balance + new.total
        WHERE id = new.cash_box_id;

    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Install Trigger on Sales
DROP TRIGGER IF EXISTS trg_sales_cash_flow ON public.sales;
CREATE TRIGGER trg_sales_cash_flow
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_cash_flow();

-- 4. Reversion Trace (In case sale is deleted or voided)
CREATE OR REPLACE FUNCTION public.handle_sale_cash_reversion()
RETURNS trigger AS $$
BEGIN
    IF (old.is_credit = false AND old.cash_box_id IS NOT NULL) THEN
        -- 1. Create Reversion Movement
        INSERT INTO public.cash_movements (cash_box_id, user_id, type, amount, description)
        VALUES (
            old.cash_box_id, 
            old.user_id, 
            'EGRESO', 
            old.total, 
            'REVERSIÓN: Venta anulada/eliminada #' || substring(old.id::text, 1, 8)
        );

        -- 2. Restore Balance
        UPDATE public.cash_boxes 
        SET balance = balance - old.total
        WHERE id = old.cash_box_id;
    END IF;
    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_cash_reversion ON public.sales;
CREATE TRIGGER trg_sales_cash_reversion
BEFORE DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_cash_reversion();
