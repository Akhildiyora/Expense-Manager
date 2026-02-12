-- FIX: Make friend linking and trip access case-insensitive

-- 1. Update link_user_to_friends to be case-insensitive
CREATE OR REPLACE FUNCTION public.link_user_to_friends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update friends table where email matches the current user's email (case-insensitive)
  -- AND linked_user_id is currently NULL
  UPDATE public.friends
  SET linked_user_id = auth.uid()
  WHERE lower(email) = lower(auth.jwt()->>'email')
  AND linked_user_id IS NULL;
END;
$$;


-- 2. Update get_allowed_trip_ids_v5 to be case-insensitive on email
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
    lower(tm.email) = lower(auth.jwt()->>'email')
  );
  
  IF ids IS NULL THEN ids := '{}'; END IF;
  RETURN ids;
END;
$$;
