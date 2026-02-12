-- RUN THIS SCRIPT IN THE SUPABASE SQL EDITOR

-- 1. Function to add a friend by email (and link them if they exist)
CREATE OR REPLACE FUNCTION public.add_friend_by_email(friend_name text, friend_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Allows checking auth.users
AS $$
DECLARE
  target_user_id uuid;
  new_friend_id uuid;
BEGIN
  -- Check if the email belongs to an existing user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = friend_email
  LIMIT 1;

  -- Insert into friends table
  INSERT INTO public.friends (user_id, name, email, linked_user_id)
  VALUES (auth.uid(), friend_name, friend_email, target_user_id)
  RETURNING id INTO new_friend_id;

  RETURN json_build_object('id', new_friend_id, 'linked_user_id', target_user_id);
END;
$$;

-- 2. Update RLS Policies for SHARED ACCESS

-- TRIPS
DROP POLICY IF EXISTS "Users manage own trips" ON public.trips;
CREATE POLICY "Users view own and shared trips"
ON public.trips FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.trip_members tm
    LEFT JOIN public.friends f ON tm.friend_id = f.id
    WHERE tm.trip_id = public.trips.id
    AND (
      tm.user_id = auth.uid() OR -- Directly added as user
      f.linked_user_id = auth.uid() -- Added via friend link
    )
  )
);

CREATE POLICY "Users insert own trips"
ON public.trips FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own and shared trips"
ON public.trips FOR UPDATE
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.trip_members tm
    LEFT JOIN public.friends f ON tm.friend_id = f.id
    WHERE tm.trip_id = public.trips.id
    AND (
      tm.user_id = auth.uid() OR 
      f.linked_user_id = auth.uid()
    )
    AND tm.role IN ('admin', 'editor', 'owner') -- Only allow edits if role permits
  )
);

CREATE POLICY "Users delete own trips"
ON public.trips FOR DELETE
USING (auth.uid() = user_id);


-- EXPENSES
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users view own and shared expenses"
ON public.expenses FOR SELECT
USING (
  auth.uid() = user_id OR -- Personal expense
  EXISTS (
    SELECT 1 FROM public.trip_members tm
    LEFT JOIN public.friends f ON tm.friend_id = f.id
    WHERE tm.trip_id = public.expenses.trip_id
    AND (
      tm.user_id = auth.uid() OR 
      f.linked_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users insert own expenses"
ON public.expenses FOR INSERT
WITH CHECK (
   auth.uid() = user_id OR
   EXISTS (
    SELECT 1 FROM public.trip_members tm
    LEFT JOIN public.friends f ON tm.friend_id = f.id
    WHERE tm.trip_id = public.expenses.trip_id
    AND (
        tm.user_id = auth.uid() OR
        f.linked_user_id = auth.uid()
    )
   )
);
-- Note: Simplified update/delete for now to owner or creator
CREATE POLICY "Users update own expenses"
ON public.expenses FOR UPDATE
USING (auth.uid() = user_id); 


-- FRIENDS
-- Allow users to see the friend records where THEY are the linked user
-- This is useful so they can see "User A has added me as a friend"
DROP POLICY IF EXISTS "Users manage own friends" ON public.friends;
CREATE POLICY "Users manage own friends"
ON public.friends FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view identity as friend"
ON public.friends FOR SELECT
USING (linked_user_id = auth.uid());


-- NOTIFICATIONS
-- Ensure we can send notifications to linked users
-- (Existing policies might be enough, but good to verify)
