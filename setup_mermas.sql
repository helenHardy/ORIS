-- ========================================================
-- GACIA ERP - MERMAS & DAMAGED PRODUCTS SETUP
-- ========================================================

-- 1. Update product_branch_settings to track damaged stock per branch
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_branch_settings' AND column_name='damaged_stock') THEN
        ALTER TABLE public.product_branch_settings ADD COLUMN damaged_stock numeric DEFAULT 0;
    END IF;
END $$;

-- 2. Update sale_items to track if an item sold was damaged
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='is_damaged') THEN
        ALTER TABLE public.sale_items ADD COLUMN is_damaged boolean DEFAULT false;
    END IF;
END $$;

-- 3. Function to move stock from normal to damaged
CREATE OR REPLACE FUNCTION public.report_item_damage(
    p_product_id bigint, 
    p_branch_id bigint, 
    p_quantity numeric, 
    p_notes text DEFAULT 'Daño reportado'
)
RETURNS numeric AS $$
DECLARE
    v_new_damaged_stock numeric;
    v_new_normal_stock numeric;
BEGIN
    -- Decrease normal stock, increase damaged stock
    UPDATE public.product_branch_settings
    SET stock = stock - p_quantity,
        damaged_stock = damaged_stock + p_quantity
    WHERE product_id = p_product_id AND branch_id = p_branch_id
    RETURNING stock, damaged_stock INTO v_new_normal_stock, v_new_damaged_stock;

    -- Log to Kardex (Normal stock decrease)
    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
    VALUES (p_branch_id, p_product_id, 'MERMA_SALIDA', -p_quantity, v_new_normal_stock, p_notes || ' (Movido a Dañados)');

    -- Log to Kardex (Damaged stock increase - optional, but good for history)
    -- We'll use a specific note to indicate it's now in the damaged bucket
    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
    VALUES (p_branch_id, p_product_id, 'MERMA_ENTRADA', p_quantity, v_new_damaged_stock, p_notes || ' (Entrada a Dañados)');

    RETURN v_new_damaged_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to restore stock from damaged to normal
CREATE OR REPLACE FUNCTION public.restore_item_damage(
    p_product_id bigint, 
    p_branch_id bigint, 
    p_quantity numeric, 
    p_notes text DEFAULT 'Reparado/Restaurado'
)
RETURNS numeric AS $$
DECLARE
    v_new_damaged_stock numeric;
    v_new_normal_stock numeric;
BEGIN
    -- Increase normal stock, decrease damaged stock
    UPDATE public.product_branch_settings
    SET stock = stock + p_quantity,
        damaged_stock = damaged_stock - p_quantity
    WHERE product_id = p_product_id AND branch_id = p_branch_id
    RETURNING stock, damaged_stock INTO v_new_normal_stock, v_new_damaged_stock;

    -- Log to Kardex (Damaged stock decrease)
    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
    VALUES (p_branch_id, p_product_id, 'REPARACION_SALIDA', -p_quantity, v_new_damaged_stock, p_notes || ' (Salida de Dañados)');

    -- Log to Kardex (Normal stock increase)
    INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
    VALUES (p_branch_id, p_product_id, 'REPARACION_ENTRADA', p_quantity, v_new_normal_stock, p_notes || ' (Restaurado a Stock)');

    RETURN v_new_normal_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update handle_sale_item_changes trigger to handle damaged items
CREATE OR REPLACE FUNCTION public.handle_sale_item_changes()
RETURNS trigger AS $$
DECLARE
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
BEGIN
    -- Get branch_id from sales table
    IF (TG_OP = 'DELETE') THEN
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = old.sale_id;
    ELSE
        SELECT branch_id INTO v_branch_id FROM public.sales WHERE id = new.sale_id;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        IF (new.is_damaged = true) THEN
            -- Discount from damaged_stock
            UPDATE public.product_branch_settings 
            SET damaged_stock = damaged_stock - new.quantity 
            WHERE product_id = new.product_id AND branch_id = v_branch_id
            RETURNING damaged_stock INTO v_new_stock;
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA_MERMA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta de producto dañado #' || new.sale_id);
        ELSE
            -- Normal sale
            v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada #' || new.sale_id);
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- If is_damaged status changed
        IF (old.is_damaged IS DISTINCT FROM new.is_damaged) THEN
            -- Restore old quantity to OLD bucket
            IF (old.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock + old.quantity WHERE product_id = old.product_id AND branch_id = v_branch_id;
            ELSE
                UPDATE public.product_branch_settings SET stock = stock + old.quantity WHERE product_id = old.product_id AND branch_id = v_branch_id;
            END IF;
            
            -- Subtract new quantity from NEW bucket
            IF (new.is_damaged = true) THEN
                UPDATE public.product_branch_settings SET damaged_stock = damaged_stock - new.quantity WHERE product_id = new.product_id AND branch_id = v_branch_id RETURNING damaged_stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MODIFICACION_VENTA_MERMA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta merma #' || new.sale_id);
            ELSE
                UPDATE public.product_branch_settings SET stock = stock - new.quantity WHERE product_id = new.product_id AND branch_id = v_branch_id RETURNING stock INTO v_new_stock;
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MODIFICACION_VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Cambio a venta normal #' || new.sale_id);
            END IF;
        ELSE
            -- Same status, handle quantity difference
            v_diff := new.quantity - old.quantity;
            IF (new.is_damaged = true) THEN
                UPDATE public.product_branch_settings 
                SET damaged_stock = damaged_stock - v_diff 
                WHERE product_id = new.product_id AND branch_id = v_branch_id
                RETURNING damaged_stock INTO v_new_stock;
                
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MODIFICACION_VENTA_MERMA', -v_diff, v_new_stock, new.sale_id::text, 'Venta merma mod. cantidad #' || new.sale_id);
            ELSE
                v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -v_diff);
                INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
                VALUES (v_branch_id, new.product_id, 'MODIFICACION_VENTA', -v_diff, v_new_stock, new.sale_id::text, 'Venta normal mod. cantidad #' || new.sale_id);
            END IF;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        IF (old.is_damaged = true) THEN
            UPDATE public.product_branch_settings 
            SET damaged_stock = damaged_stock + old.quantity 
            WHERE product_id = old.product_id AND branch_id = v_branch_id
            RETURNING damaged_stock INTO v_new_stock;
            
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'ANULACION_VENTA_MERMA', old.quantity, v_new_stock, old.sale_id::text, 'Venta merma anulada #' || old.sale_id);
        ELSE
            v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (v_branch_id, old.product_id, 'ANULACION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta anulada #' || old.sale_id);
        END IF;
    END IF;
    RETURN coalesce(new, old);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers to ensure they use the correct function
DROP TRIGGER IF EXISTS trg_kardex_sale_insert_update ON public.sale_items;
CREATE TRIGGER trg_kardex_sale_insert_update AFTER INSERT OR UPDATE ON public.sale_items 
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

DROP TRIGGER IF EXISTS trg_kardex_sale_delete ON public.sale_items;
CREATE TRIGGER trg_kardex_sale_delete BEFORE DELETE ON public.sale_items 
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_changes();

-- 6. Update inventory valuation report to include damaged stock
DROP FUNCTION IF EXISTS get_inventory_valuation(bigint);

CREATE OR REPLACE FUNCTION get_inventory_valuation(
  p_branch_id bigint DEFAULT NULL
)
RETURNS TABLE (
  total_cost_value numeric,
  total_retail_value numeric,
  total_damaged_value numeric,
  item_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sum(pbs.stock * coalesce(p.cost_price, 0))::numeric as total_cost_value,
    sum(pbs.stock * coalesce(pbs.price, p.price, 0))::numeric as total_retail_value,
    sum(pbs.damaged_stock * coalesce(p.cost_price, 0))::numeric as total_damaged_value,
    count(distinct p.id)::bigint as item_count
  FROM product_branch_settings pbs
  JOIN products p ON pbs.product_id = p.id
  WHERE
    (p_branch_id IS NULL OR pbs.branch_id = p_branch_id)
    AND (pbs.stock > 0 OR pbs.damaged_stock > 0);
END;
$$ LANGUAGE plpgsql;
