-- ==========================================
-- GACIA ERP - CUSTOMER PAYMENTS FIX
-- ==========================================
-- This script fixes the column mismatch and adds
-- a trigger for automatic balance management.
-- ==========================================

DO $$ 
BEGIN 
    -- 1. Rename 'method' to 'payment_method' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'method') THEN
        ALTER TABLE public.customer_payments RENAME COLUMN method TO payment_method;
    -- 2. Add 'payment_method' if neither exists
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'payment_method') THEN
        ALTER TABLE public.customer_payments ADD COLUMN payment_method TEXT;
    END IF;
END $$;

-- 3. Trigger for automatic balance update
CREATE OR REPLACE FUNCTION public.handle_customer_payment_changes()
RETURNS trigger AS $$
BEGIN
    -- INSERT: Subtract from balance
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.customers 
        SET current_balance = COALESCE(current_balance, 0) - NEW.amount
        WHERE id = NEW.customer_id;
        
    -- UPDATE: Adjust balance based on difference
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.customer_id = NEW.customer_id) THEN
            UPDATE public.customers 
            SET current_balance = COALESCE(current_balance, 0) + OLD.amount - NEW.amount
            WHERE id = NEW.customer_id;
        ELSE
            -- Revert old, apply new
            UPDATE public.customers SET current_balance = COALESCE(current_balance, 0) + OLD.amount WHERE id = OLD.customer_id;
            UPDATE public.customers SET current_balance = COALESCE(current_balance, 0) - NEW.amount WHERE id = NEW.customer_id;
        END IF;

    -- DELETE: Add back to balance
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.customers 
        SET current_balance = COALESCE(current_balance, 0) + OLD.amount
        WHERE id = OLD.customer_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_customer_payments_balance ON public.customer_payments;
CREATE TRIGGER trg_customer_payments_balance
AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_customer_payment_changes();
