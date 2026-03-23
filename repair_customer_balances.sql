-- ==========================================
-- GACIA ERP - CUSTOMER BALANCE REPAIR
-- ==========================================
-- This script recalculates all customer balances
-- to fix the double-counting issue.
-- ==========================================

-- 1. Reset all balances to zero
UPDATE public.customers SET current_balance = 0;

-- 2. Add up all credit sales
UPDATE public.customers c
SET current_balance = current_balance + (
    SELECT COALESCE(SUM(total), 0)
    FROM public.sales s
    WHERE s.customer_id = c.id
    AND s.is_credit = true
);

-- 3. Subtract all payments
UPDATE public.customers c
SET current_balance = current_balance - (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.customer_payments p
    WHERE p.customer_id = c.id
);
