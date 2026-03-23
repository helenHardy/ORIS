-- ==========================================
-- GACIA ERP - QUOTATIONS TABLE COLUMNS FIX
-- ==========================================
-- This script adds missing columns to the quotations table
-- required by the Quotations system.
-- ==========================================

DO $$ 
BEGIN 
    -- 1. Ensure table exists (just in case)
    -- (The table should exist but some columns might be missing)

    -- 2. Add notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'notes') THEN
        ALTER TABLE public.quotations ADD COLUMN notes TEXT;
    END IF;

    -- 3. Add discount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'discount') THEN
        ALTER TABLE public.quotations ADD COLUMN discount NUMERIC DEFAULT 0;
    END IF;

    -- 4. Ensure other columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'tax') THEN
        ALTER TABLE public.quotations ADD COLUMN tax NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'subtotal') THEN
        ALTER TABLE public.quotations ADD COLUMN subtotal NUMERIC DEFAULT 0;
    END IF;
END $$;
