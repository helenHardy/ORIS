-- ========================================================
-- GACIA ERP - EXPENSES (GASTOS) SYSTEM
-- ========================================================

-- 1. Create Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id bigint REFERENCES public.branches(id) ON DELETE CASCADE,
    cash_box_id bigint REFERENCES public.cash_boxes(id) ON DELETE SET NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    category text NOT NULL, -- Servicios, Alquiler, Sueldos, Otros, etc.
    description text,
    date timestamp with time zone DEFAULT now(),
    user_id uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Expenses allow all for admins" ON public.expenses FOR ALL USING (public.is_admin());
CREATE POLICY "Expenses allow read for authenticated" ON public.expenses FOR SELECT USING (true);

-- 4. Update Trigger Logic to handle expenses
CREATE OR REPLACE FUNCTION public.fn_process_cash_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_cash_box_id bigint;
    v_amount numeric;
    v_type text;
    v_desc text;
    v_user_id uuid;
BEGIN
    -- Determine table and extract data
    IF TG_TABLE_NAME = 'sales' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.total;
        v_type := 'INGRESO';
        v_desc := 'Venta #' || NEW.sale_number;
        v_user_id := NEW.user_id;
        
        IF NEW.payment_method != 'Efectivo' OR NEW.is_credit = true THEN
            RETURN NEW;
        END IF;

    ELSIF TG_TABLE_NAME = 'purchases' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.total;
        v_type := 'EGRESO';
        v_desc := 'Compra #' || NEW.purchase_number;
        v_user_id := NEW.user_id;

    ELSIF TG_TABLE_NAME = 'customer_payments' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.amount;
        v_type := 'INGRESO';
        v_desc := 'Pago de Cliente';
        v_user_id := NEW.user_id;
        
        IF NEW.payment_method != 'Efectivo' THEN
            RETURN NEW;
        END IF;

    ELSIF TG_TABLE_NAME = 'expenses' THEN
        v_cash_box_id := NEW.cash_box_id;
        v_amount := NEW.amount;
        v_type := 'EGRESO';
        v_desc := 'Gasto: ' || COALESCE(NEW.category, 'General') || ' - ' || COALESCE(NEW.description, '');
        v_user_id := NEW.user_id;
    END IF;

    -- Basic validation
    IF v_cash_box_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Update Box Balance
    IF v_type = 'INGRESO' THEN
        UPDATE public.cash_boxes SET balance = balance + v_amount WHERE id = v_cash_box_id;
    ELSE
        UPDATE public.cash_boxes SET balance = balance - v_amount WHERE id = v_cash_box_id;
    END IF;

    -- Log Movement
    INSERT INTO public.cash_movements (cash_box_id, amount, type, description, reference_id, user_id)
    VALUES (v_cash_box_id, v_amount, v_type, v_desc, NEW.id::text, v_user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Apply Trigger to expenses table
DROP TRIGGER IF EXISTS trg_expenses_cash_movement ON public.expenses;
CREATE TRIGGER trg_expenses_cash_movement AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.fn_process_cash_movement();

-- 6. Add some initial categories if needed (Optional, UI will handle it)
-- INSERT INTO public.settings (key, value) VALUES ('expense_categories', 'Servicios,Alquiler,Sueldos,Mantenimiento,Otros') ON CONFLICT DO NOTHING;
