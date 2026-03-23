-- ==========================================
-- GACIA ERP - IS_ADMIN ROBUSTNESS FIX
-- ==========================================
-- This script ensures is_admin() correctly 
-- identifies the main administrator.
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- 1. Try to get role by UID
  SELECT role, email INTO v_role, v_email 
  FROM public.profiles 
  WHERE id = auth.uid();

  -- 2. Return true if role is Administrador OR it is the master email
  RETURN (v_role = 'Administrador') OR (v_email = 'admin@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply permissions to the RPC
GRANT EXECUTE ON FUNCTION public.admin_manage_user TO authenticated;
