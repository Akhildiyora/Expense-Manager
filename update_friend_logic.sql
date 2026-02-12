-- Function to update a friend's details and attempt to link them to a user by email
CREATE OR REPLACE FUNCTION public.update_friend_with_email(
  p_friend_id uuid,
  p_name text,
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  updated_friend record;
BEGIN
  -- 1. Check Authorization: Ensure the calling user owns this friend record
  IF NOT EXISTS (SELECT 1 FROM public.friends WHERE id = p_friend_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to edit this friend';
  END IF;

  -- 2. Lookup existing user by email (if email is provided)
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = trim(p_email)
    LIMIT 1;
  ELSE
    target_user_id := NULL; -- If email removed, remove link
  END IF;

  -- 3. Update the friend record
  UPDATE public.friends
  SET 
    name = trim(p_name),
    email = CASE WHEN trim(p_email) = '' THEN NULL ELSE trim(p_email) END,
    linked_user_id = target_user_id
  WHERE id = p_friend_id
  RETURNING * INTO updated_friend;

  RETURN to_json(updated_friend);
END;
$$;
