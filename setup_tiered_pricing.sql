-- Create product_tiered_prices table
CREATE TABLE IF NOT EXISTS public.product_tiered_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES public.branches(id) ON DELETE CASCADE,
    min_quantity NUMERIC NOT NULL DEFAULT 1,
    price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure uniqueness of rule per product, branch and quantity
    CONSTRAINT unique_tiered_price UNIQUE (product_id, branch_id, min_quantity)
);

-- RLS Policies
ALTER TABLE public.product_tiered_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to tiered prices" 
ON public.product_tiered_prices FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage tiered prices" 
ON public.product_tiered_prices FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Comment for clarity
COMMENT ON TABLE public.product_tiered_prices IS 'Stores quantity-based wholesale prices for products per branch.';
