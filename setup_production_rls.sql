-- 1. Habilitar RLS en tablas clave si no lo están
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas públicas previas para limpiar (Opcional, previene duplicados)
DROP POLICY IF EXISTS "Permitir lectura pública de productos" ON products;
DROP POLICY IF EXISTS "Permitir lectura pública de configuraciones" ON product_branch_settings;
DROP POLICY IF EXISTS "Permitir lectura pública de sucursales" ON branches;
DROP POLICY IF EXISTS "Permitir lectura pública de categorías" ON categories;
DROP POLICY IF EXISTS "Permitir lectura pública de marcas" ON brands;
DROP POLICY IF EXISTS "Permitir lectura pública de modelos" ON models;

-- 3. Crear políticas de lectura pública (Anónima)
-- Solo lectura, sin permiso de edición
CREATE POLICY "Permitir lectura pública de productos" ON products
FOR SELECT TO anon USING (active = true);

CREATE POLICY "Permitir lectura pública de configuraciones" ON product_branch_settings
FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir lectura pública de sucursales" ON branches
FOR SELECT TO anon USING (active = true);

CREATE POLICY "Permitir lectura pública de categorías" ON categories
FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir lectura pública de marcas" ON brands
FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir lectura pública de modelos" ON models
FOR SELECT TO anon USING (true);

-- 4. Asegurar que las tablas sensibles NO sean públicas
-- (Esto asume que ya tienes políticas para usuarios autenticados)
-- Por defecto, si RLS está activo y no hay política descriptiva, se deniega el acceso.
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Comentario de confirmación
COMMENT ON TABLE products IS 'Productos del catálogo. Lectura pública habilitada para anónimos.';
