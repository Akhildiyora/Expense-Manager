-- FIX PROFILE RLS AND SHARED EXPENSE VISIBILITY

-- 1. FIX PROFILE RLS (Allow INSERT)
-- The 'upsert' operation requires INSERT permission if the row doesn't exist.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);


-- 2. FIX EXPENSE VISIBILITY (Support Splits)
-- We need to allow users to see expenses where they are part of the split, even if not in a trip.

-- Helper to find expenses where user is involved in a split
-- SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.get_allowed_split_expense_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ids uuid[];
BEGIN
  -- Find expense_ids where the user is the 'linked_user_id' of the friend in the split
  SELECT ARRAY_AGG(DISTINCT es.expense_id)
  INTO ids
  FROM public.expense_splits es
  JOIN public.friends f ON es.friend_id = f.id
  WHERE f.linked_user_id = auth.uid();
  
  IF ids IS NULL THEN ids := '{}'; END IF;
  RETURN ids;
END;
$$;

-- Update Expenses Policy
DROP POLICY IF EXISTS "Users view expenses" ON public.expenses;
CREATE POLICY "Users view expenses"
ON public.expenses FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  (trip_id = ANY(public.get_allowed_trip_ids_v5()))
  OR
  (id = ANY(public.get_allowed_split_expense_ids())) -- NEW: Add splits
);


-- 3. FIX EXPENSE SPLITS POLICIES
-- Users need to see the split records too
DROP POLICY IF EXISTS "Users view splits" ON public.expense_splits;
CREATE POLICY "Users view splits"
ON public.expense_splits FOR SELECT
USING (
  -- 1. I am the friend involved
  EXISTS (
    SELECT 1 FROM public.friends f 
    WHERE f.id = public.expense_splits.friend_id 
    AND f.linked_user_id = auth.uid()
  )
  OR
  -- 2. I am the owner of the expense
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = public.expense_splits.expense_id
    AND e.user_id = auth.uid()
  )
  OR
  -- 3. I can access the trip related to the expense
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = public.expense_splits.expense_id
    AND e.trip_id = ANY(public.get_allowed_trip_ids_v5())
  )
);
