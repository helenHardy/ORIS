-- ========================================================
-- GACIA ERP - FINAL PRODUCTION SCHEMA FIX (POS & INVENTORY)
-- ========================================================

-- 1. Add damaged_stock to product_branch_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_branch_settings' AND column_name = 'damaged_stock') THEN
        ALTER TABLE public.product_branch_settings ADD COLUMN damaged_stock numeric DEFAULT 0;
    END IF;
END $$;

-- 2. Add is_damaged to sale_items
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'is_damaged') THEN
        ALTER TABLE public.sale_items ADD COLUMN is_damaged boolean DEFAULT false;
    END IF;
END $$;

-- 3. Add cash_box_id to sales
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'cash_box_id') THEN
        ALTER TABLE public.sales ADD COLUMN cash_box_id uuid;
    END IF;
END $$;

-- 4. Create cash_boxes table if not exists (Basic structure for POS support)
CREATE TABLE IF NOT EXISTS public.cash_boxes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id bigint REFERENCES public.branches(id) ON DELETE CASCADE,
    name text NOT NULL,
    balance numeric DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Add cash_box_id foreign key constraint to sales
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_sales_cash_box') THEN
        ALTER TABLE public.sales 
        ADD CONSTRAINT fk_sales_cash_box 
        FOREIGN KEY (cash_box_id) 
        REFERENCES public.cash_boxes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Grant permissions
GRANT ALL ON public.cash_boxes TO authenticated;
GRANT ALL ON public.cash_boxes TO service_role;

-- 7. Ensure RLS on cash_boxes
ALTER TABLE public.cash_boxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.cash_boxes;
CREATE POLICY "Permitir lectura para autenticados" ON public.cash_boxes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.cash_boxes;
CREATE POLICY "Permitir gestión para Administradores" ON public.cash_boxes FOR ALL USING (public.is_admin());

-- 8. Add is_damaged to purchase_items for symmetry (optional but good for future mermas in purchases)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'is_damaged') THEN
        ALTER TABLE public.purchase_items ADD COLUMN is_damaged boolean DEFAULT false;
    END IF;
END $$;
