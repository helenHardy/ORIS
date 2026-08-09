-- ==========================================
-- GACIA ERP - ADD is_damaged TO quotation_items
-- ==========================================
-- The frontend inserts is_damaged into quotation_items
-- (quotations support MERMAS). Run this once in production.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_items' AND column_name = 'is_damaged') THEN
        ALTER TABLE public.quotation_items ADD COLUMN is_damaged boolean DEFAULT false;
    END IF;
END $$;