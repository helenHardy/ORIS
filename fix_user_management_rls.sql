-- ==========================================
-- GACIA ERP - USER MANAGEMENT RLS FIX
-- ==========================================
-- This script gives administrators the permission
-- to create and manage profiles and branch assignments.
-- ==========================================

-- 1. Profiles Table RLS
-- (Ensure admins can insert and update any profile)

DROP POLICY IF EXISTS "Profiles allow read" ON public.profiles;
CREATE POLICY "Profiles allow read" ON public.profiles 
FOR SELECT USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Profiles allow update" ON public.profiles;
CREATE POLICY "Profiles allow update" ON public.profiles 
FOR UPDATE USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Profiles allow insert" ON public.profiles;
CREATE POLICY "Profiles allow insert" ON public.profiles 
FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Profiles allow delete" ON public.profiles;
CREATE POLICY "Profiles allow delete" ON public.profiles 
FOR DELETE USING (public.is_admin());


-- 2. User Branches RLS
-- (Ensure admins can manage assignments)

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management allow all" ON public.user_branches;
CREATE POLICY "Management allow all" ON public.user_branches 
FOR ALL USING (public.is_admin());

-- Also allow individual users to read their own assignments
DROP POLICY IF EXISTS "Users allow read own assignments" ON public.user_branches;
CREATE POLICY "Users allow read own assignments" ON public.user_branches 
FOR SELECT USING (user_id = auth.uid());
