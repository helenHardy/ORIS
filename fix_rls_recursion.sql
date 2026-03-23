-- ==========================================
-- GACIA ERP - UNIFIED SCHEMA & RLS FIX
-- ==========================================
-- Run this script in your Supabase SQL Editor 
-- to fix the 500 and 400 errors.
-- ==========================================

-- 1. Fix Profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 2. Create SECURITY DEFINER function to check for admin role
-- This function bypasses RLS and avoids recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix Foreign Key names for frontend joins
-- Sales
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Purchases
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_user_id_fkey;
ALTER TABLE public.purchases ADD CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Transfers (Align with sent_by/received_by columns)
DO $$ 
BEGIN 
    -- Only alter if user_id exists (meaning it hasn't been migrated)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='user_id') THEN
        ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS sent_by uuid;
        ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS received_by uuid;
        -- Optional: Migrate existing user_id data if any
        UPDATE public.transfers SET sent_by = user_id WHERE sent_by IS NULL;
        ALTER TABLE public.transfers DROP COLUMN user_id;
    END IF;
END $$;

ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_sent_by_fkey;
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS fk_transfers_sender;
ALTER TABLE public.transfers ADD CONSTRAINT fk_transfers_sender FOREIGN KEY (sent_by) REFERENCES public.profiles(id);

ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_received_by_fkey;
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS fk_transfers_receiver;
ALTER TABLE public.transfers ADD CONSTRAINT fk_transfers_receiver FOREIGN KEY (received_by) REFERENCES public.profiles(id);

-- 4. Update RLS Policies
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Permitir lectura para autenticados" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir gestión para Administradores" ON public.%I;', t);
        
        EXECUTE format('CREATE POLICY "Permitir lectura para autenticados" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'');', t);
        EXECUTE format('CREATE POLICY "Permitir gestión para Administradores" ON public.%I FOR ALL USING (public.is_admin());', t);
    END LOOP;
END $$;

-- 5. Specific fix for profiles table 
DROP POLICY IF EXISTS "Permitir lectura propia y administradores" ON public.profiles;
CREATE POLICY "Permitir lectura propia y administradores" ON public.profiles 
FOR SELECT USING (auth.uid() = id OR public.is_admin());
