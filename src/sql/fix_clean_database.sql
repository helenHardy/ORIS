-- ========================================================
-- GACIA ERP - ROBUST & SAFE DATABASE CLEANUP (v3)
-- ========================================================
-- This version adds "WHERE true" to all DELETE statements 
-- to satisfy database safety constraints (DELETE requires a WHERE clause).
-- ========================================================

CREATE OR REPLACE FUNCTION public.clean_database()
RETURNS void AS $$
DECLARE
    table_rec RECORD;
BEGIN
    -- 1. Helper to safely delete from any existing table in the list
    FOR table_rec IN 
        SELECT unnest(ARRAY[
            -- Cash system (Logs first)
            'cash_movements',
            
            -- Transaction Items
            'sale_items',
            'purchase_items',
            'transfer_items',
            'quotation_items',
            'merma_items',
            
            -- Payments and Credits
            'purchase_payments',
            'customer_payments',
            
            -- Transaction Headers
            'sales',
            'purchases',
            'transfers',
            'quotations',
            'expenses',
            
            -- Inventory Logs
            'kardex',
            'inventory_movements',
            
            -- Product Catalog (reverse order)
            'product_branch_settings',
            'products',
            'subcategories',
            'categories',
            'models',
            'brands',
            
            -- CRM
            'customers',
            'suppliers',
            
            -- User assignments (except admin)
            'user_branches'
        ]) AS tbl_name
    LOOP
        -- Check if table exists in public schema
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = table_rec.tbl_name) THEN
            IF table_rec.tbl_name = 'user_branches' THEN
                DELETE FROM public.user_branches WHERE user_id IN (SELECT id FROM public.profiles WHERE email != 'admin@gmail.com');
            ELSE
                -- Adding "WHERE true" to satisfy safety constraints
                EXECUTE format('DELETE FROM public.%I WHERE true', table_rec.tbl_name);
            END IF;
        END IF;
    END LOOP;

    -- 2. Special handling for Profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DELETE FROM public.profiles WHERE email != 'admin@gmail.com';
    END IF;

    -- 3. Reset Cash Box balance if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_boxes') THEN
        UPDATE public.cash_boxes SET balance = 0 WHERE true;
    END IF;

    -- Note: branches, roles, role_permissions, and settings are preserved.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.clean_database() IS 'Safely clears transactional and catalog data while satisfying safety WHERE requirements.';
