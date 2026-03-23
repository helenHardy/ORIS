-- Añadir columna de descuento por sucursal
ALTER TABLE product_branch_settings 
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Comentario para documentar la columna
COMMENT ON COLUMN product_branch_settings.discount_amount IS 'Monto neto de descuento para ofertas en esta sucursal';
