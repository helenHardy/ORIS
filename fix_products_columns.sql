-- ========================================================
-- GACIA ERP - PRODUCTS SCHEMA COMPLETION
-- ========================================================
-- This script adds missing columns to the products table
-- required for stock management and permissions.
-- ========================================================

-- 1. Add missing columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS can_edit boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS can_delete boolean DEFAULT true;

-- 2. Ensure product_branch_settings also has min_stock
ALTER TABLE public.product_branch_settings
ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0;

-- 3. Update RLS to ensure accessibility
-- (Already handled by previous fix_rls scripts, but keeping it robust)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. Refresh schema cache (PostgREST does this automatically on DDL, 
-- but sometimes an explicit reload via NOTIFY pgrst is needed 
-- if using an older Supabase version, though usually not required).
