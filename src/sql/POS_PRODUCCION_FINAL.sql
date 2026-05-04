-- ========================================================
-- GACIA ERP - CERTIFICACIÓN FINAL DE PRODUCCIÓN (POS)
-- ========================================================

-- 1. NIVELACIÓN DE ESQUEMA (COLUMNAS FALTANTES)
-- --------------------------------------------------------
DO $$ 
BEGIN
    -- Columnas en sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'cash_box_id') THEN
        ALTER TABLE public.sales ADD COLUMN cash_box_id uuid REFERENCES public.cash_boxes(id) ON DELETE SET NULL;
    END IF;

    -- Columnas en sale_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'is_damaged') THEN
        ALTER TABLE public.sale_items ADD COLUMN is_damaged boolean DEFAULT false;
    END IF;

    -- Columnas en product_branch_settings (Stock de mermas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_branch_settings' AND column_name = 'damaged_stock') THEN
        ALTER TABLE public.product_branch_settings ADD COLUMN damaged_stock numeric DEFAULT 0;
    END IF;
END $$;

-- 2. TABLA DE MOVIMIENTOS DE CAJA (TRAZABILIDAD FINANCIERA)
-- --------------------------------------------------------
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

-- Permisos y Seguridad
GRANT ALL ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.cash_movements;
CREATE POLICY "Permitir lectura para autenticados" ON public.cash_movements FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.cash_movements;
CREATE POLICY "Permitir gestión para Administradores" ON public.cash_movements FOR ALL USING (public.is_admin());

-- 3. AUTOMATIZACIÓN DE FLUJO DE CAJA (TRIGGER)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_sale_cash_flow()
RETURNS trigger AS $$
DECLARE
    v_box_name text;
BEGIN
    -- Solo procesar si el pago NO es crédito y tiene una caja asignada
    IF (new.is_credit = false AND new.cash_box_id IS NOT NULL AND new.status = 'Completada') THEN
        
        -- Obtener nombre de la caja para la descripción
        SELECT name INTO v_box_name FROM public.cash_boxes WHERE id = new.cash_box_id;

        -- 1. Registrar Movimiento
        INSERT INTO public.cash_movements (cash_box_id, sale_id, user_id, type, amount, description)
        VALUES (
            new.cash_box_id, 
            new.id, 
            new.user_id, 
            'INGRESO', 
            new.total, 
            'Venta registrada #' || substring(new.id::text, 1, 8) || ' en ' || COALESCE(v_box_name, 'Caja')
        );

        -- 2. Actualizar Saldo de Caja
        UPDATE public.cash_boxes 
        SET balance = balance + new.total
        WHERE id = new.cash_box_id;
    END IF;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sales_cash_flow ON public.sales;
CREATE TRIGGER trg_sales_cash_flow
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_cash_flow();

-- 4. REVERSIÓN DE CAJA (ANULACIONES)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_sale_cash_reversion()
RETURNS trigger AS $$
BEGIN
    IF (old.is_credit = false AND old.cash_box_id IS NOT NULL) THEN
        INSERT INTO public.cash_movements (cash_box_id, user_id, type, amount, description)
        VALUES (
            old.cash_box_id, 
            old.user_id, 
            'EGRESO', 
            old.total, 
            'REVERSIÓN: Venta anulada/eliminada #' || substring(old.id::text, 1, 8)
        );

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

-- 5. RE-VINCULACIÓN DE TRIGGERS DE STOCK (ASEGURAR ACTIVIDAD)
-- --------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sale_item_stock ON public.sale_items;
CREATE TRIGGER trg_sale_item_stock
AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_item_changes();

-- FINALIZADO: El sistema ahora cuenta con trazabilidad total.
