-- FIX RECURSION V5: STRICT SECURITY DEFINER ISOLATION
-- This script moves ALL table lookups inside SECURITY DEFINER functions.
-- policies will NEVER query the tables directly, preventing recursion.

-- 1. DROP ALL EXISTING POLICIES (Cleanup)
-- 1. DROP ALL EXISTING POLICIES (Cleanup)
DROP POLICY IF EXISTS "Users view own and shared trips" ON public.trips;
DROP POLICY IF EXISTS "Users manage own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips" ON public.trips;
DROP POLICY IF EXISTS "Users insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Users update own and shared trips" ON public.trips;
DROP POLICY IF EXISTS "Users delete own trips" ON public.trips;
-- Also drop the new ones we are about to create, for idempotency
DROP POLICY IF EXISTS "Users view trips" ON public.trips;
DROP POLICY IF EXISTS "Users update trips" ON public.trips;

DROP POLICY IF EXISTS "Users view trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Users manage own trip members" ON public.trip_members;
DROP POLICY IF EXISTS "One can view members" ON public.trip_members;
DROP POLICY IF EXISTS "Admins manage trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Trip owners and admins can manage members" ON public.trip_members;

DROP POLICY IF EXISTS "Users view own and shared expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users insert own or shared expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users delete expenses" ON public.expenses;
-- Also drop the new ones we are about to create
DROP POLICY IF EXISTS "Users view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users manage expenses" ON public.expenses;


-- 2. HELPER: Get Allowed Trip IDs (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_allowed_trip_ids_v5()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ids uuid[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT trip_id)
  INTO ids
  FROM public.trip_members tm
  LEFT JOIN public.friends f ON tm.friend_id = f.id
  WHERE (
    tm.user_id = auth.uid() 
    OR 
    f.linked_user_id = auth.uid()
    OR
    tm.email = auth.jwt()->>'email'
  );
  
  IF ids IS NULL THEN ids := '{}'; END IF;
  RETURN ids;
END;
$$;


-- 3. HELPER: Is Trip Admin? (SECURITY DEFINER)
-- Checks if current user is owner/admin of a trip
CREATE OR REPLACE FUNCTION public.is_trip_admin_v5(lookup_trip_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is the Trip Creator (in trips table) 
  -- OR is an Admin/Owner member (in trip_members table)
  RETURN EXISTS (
    SELECT 1 FROM public.trips 
    WHERE id = lookup_trip_id AND user_id = auth.uid()
  ) 
  OR EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = lookup_trip_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$;


-- 4. APPLY TRIPS POLICIES
CREATE POLICY "Users view trips"
ON public.trips FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  id = ANY(public.get_allowed_trip_ids_v5())
);

CREATE POLICY "Users insert own trips"
ON public.trips FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update trips"
ON public.trips FOR UPDATE
USING (
  auth.uid() = user_id 
  OR 
  (public.is_trip_admin_v5(id)) -- Use function instead of subquery
);

CREATE POLICY "Users delete own trips"
ON public.trips FOR DELETE
USING (auth.uid() = user_id);


-- 5. APPLY TRIP MEMBERS POLICIES
-- NOTE: We use functions for EVERYTHING except simple direct ID checks
CREATE POLICY "Users view trip members"
ON public.trip_members FOR SELECT
USING (
  trip_id = ANY(public.get_allowed_trip_ids_v5())
);

CREATE POLICY "Admins manage trip members"
ON public.trip_members FOR ALL
USING (
  public.is_trip_admin_v5(trip_id)
  OR
  (auth.uid() = user_id) -- Users can always manage themselves (e.g. leave trip)
);


-- 6. APPLY EXPENSES POLICIES
CREATE POLICY "Users view expenses"
ON public.expenses FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  (trip_id = ANY(public.get_allowed_trip_ids_v5()))
);

CREATE POLICY "Users manage expenses"
ON public.expenses FOR ALL
USING (
  auth.uid() = user_id 
  OR 
  (trip_id = ANY(public.get_allowed_trip_ids_v5())) -- Simplified: Logic in app handles strict edit rights, DB allows access
);
