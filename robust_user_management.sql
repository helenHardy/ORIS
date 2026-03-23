-- ========================================================
-- GACIA ERP - USER MANAGEMENT ROBUSTNESS FIX
-- ========================================================
-- This script provides a Security Definer function to 
-- safely manage users without RLS conflicts.
-- ========================================================

-- 1. Function to manage user profiles (Security Definer)
CREATE OR REPLACE FUNCTION public.admin_manage_user(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_branch_ids BIGINT[]
)
RETURNS VOID AS $$
BEGIN
    -- Only admins can call this
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acceso denegado: Se requieren permisos de Administrador';
    END IF;

    -- Upsert profile
    INSERT INTO public.profiles (id, email, full_name, role, active)
    VALUES (p_user_id, p_email, p_full_name, p_role, true)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        email = EXCLUDED.email;

    -- Manage branch assignments
    DELETE FROM public.user_branches WHERE user_id = p_user_id;
    
    INSERT INTO public.user_branches (user_id, branch_id)
    SELECT p_user_id, unnest(p_branch_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant permissions to call the function
GRANT EXECUTE ON FUNCTION public.admin_manage_user TO authenticated;

-- 3. Ensure RLS is still permissive for admins
DROP POLICY IF EXISTS "Profiles allow insert" ON public.profiles;
CREATE POLICY "Profiles allow insert" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Profiles allow update" ON public.profiles;
CREATE POLICY "Profiles allow update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Management allow all" ON public.user_branches;
CREATE POLICY "Management allow all" ON public.user_branches FOR ALL USING (public.is_admin());
