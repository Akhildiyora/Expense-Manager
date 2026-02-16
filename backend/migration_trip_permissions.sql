-- Migration: Add can_add_expenses column and update RLS policies for trip permissions
-- Run this migration to add granular permission control to trip members

-- Step 1: Add column to existing table
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS can_add_expenses boolean DEFAULT false;

-- Step 2: Drop old expense policies
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;

-- Step 3: Create new granular expense policies
-- INSERT: Personal expenses OR trip expenses with permission
CREATE POLICY "Users can insert own or permitted trip expenses" ON public.expenses FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    trip_id IS NULL
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
    OR EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND can_add_expenses = true
    )
  )
);

-- UPDATE: Personal expenses OR trip expenses (owner/admin only)
CREATE POLICY "Users can update own or admin trip expenses" ON public.expenses FOR UPDATE
USING (
  auth.uid() = user_id AND (
    trip_id IS NULL
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  )
)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Personal expenses OR trip expenses (owner/admin only)
CREATE POLICY "Users can delete own or admin trip expenses" ON public.expenses FOR DELETE
USING (
  auth.uid() = user_id AND (
    trip_id IS NULL
    OR EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  )
);
