-- Add unit_of_measure to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'Unidad';

-- Update existing records if any
UPDATE public.products SET unit_of_measure = 'Unidad' WHERE unit_of_measure IS NULL;

-- Comment for clarity
COMMENT ON COLUMN public.products.unit_of_measure IS 'Unit of measure for the product (e.g., Litro, Metro, Kilo, Unidad)';
