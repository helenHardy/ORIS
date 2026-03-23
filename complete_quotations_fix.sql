-- ==========================================
-- GACIA ERP - QUOTATIONS COMPLETE FIX
-- ==========================================
-- Re-installs all missing columns and policies
-- for the Quotations system.
-- ==========================================

DO $$ 
BEGIN 
    -- 1. Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.quotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Add all columns with IF NOT EXISTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'quotation_number') THEN
        ALTER TABLE public.quotations ADD COLUMN quotation_number SERIAL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'customer_id') THEN
        ALTER TABLE public.quotations ADD COLUMN customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'branch_id') THEN
        ALTER TABLE public.quotations ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'user_id') THEN
        ALTER TABLE public.quotations ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'subtotal') THEN
        ALTER TABLE public.quotations ADD COLUMN subtotal NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'tax') THEN
        ALTER TABLE public.quotations ADD COLUMN tax NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'discount') THEN
        ALTER TABLE public.quotations ADD COLUMN discount NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'total') THEN
        ALTER TABLE public.quotations ADD COLUMN total NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'status') THEN
        ALTER TABLE public.quotations ADD COLUMN status TEXT DEFAULT 'Pendiente';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'valid_until') THEN
        ALTER TABLE public.quotations ADD COLUMN valid_until DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'notes') THEN
        ALTER TABLE public.quotations ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'updated_at') THEN
        ALTER TABLE public.quotations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Add Permissions (just in case they were missing)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.quotations;
CREATE POLICY "Permitir todo a usuarios autenticados" ON public.quotations FOR ALL USING (auth.role() = 'authenticated');
