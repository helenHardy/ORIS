-- ==========================================
-- GACIA ERP - STORAGE SETUP
-- ==========================================
-- This script creates the 'product-images' bucket
-- and sets up the necessary security policies.
-- ==========================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Cualquiera puede ver imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar imágenes" ON storage.objects;

-- 3. Create policies
-- Allow public read access
CREATE POLICY "Cualquiera puede ver imágenes"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to insert (upload)
CREATE POLICY "Usuarios autenticados pueden subir imágenes"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Usuarios autenticados pueden actualizar imágenes"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "Usuarios autenticados pueden eliminar imágenes"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);
