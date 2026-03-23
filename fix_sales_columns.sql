-- ==========================================
-- GACIA ERP - SALES TABLE COLUMNS FIX
-- ==========================================
-- This script adds missing columns to the sales table
-- required by the POS system.
-- ==========================================

DO $$ 
BEGIN 
    -- 1. Add amount_received
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'amount_received') THEN
        ALTER TABLE public.sales ADD COLUMN amount_received numeric DEFAULT 0;
    END IF;

    -- 2. Add amount_change
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'amount_change') THEN
        ALTER TABLE public.sales ADD COLUMN amount_change numeric DEFAULT 0;
    END IF;

    -- 3. Ensure other columns exist just in case
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'discount') THEN
        ALTER TABLE public.sales ADD COLUMN discount numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'tax') THEN
        ALTER TABLE public.sales ADD COLUMN tax numeric DEFAULT 0;
    END IF;
END $$;
