-- ==========================================
-- GACIA ERP - TRANSFERS STATUS STANDARDIZATION
-- ==========================================
-- This script fixes discrepancies between the database
-- and the frontend regarding transfer states.
-- ==========================================

-- 1. Sync status values: 'Completado' -> 'Recibido'
UPDATE public.transfers SET status = 'Recibido' WHERE status = 'Completado';

-- 2. Ensure the default is correct for future records
ALTER TABLE public.transfers ALTER COLUMN status SET DEFAULT 'Pendiente';

-- 3. (Optional) If there are other non-standard statuses, correct them
-- (No hay otros detectados por ahora)
