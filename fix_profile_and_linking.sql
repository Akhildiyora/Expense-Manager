-- FIX: Add trigger to auto-update public.profiles when auth.users updates
CREATE OR REPLACE FUNCTION public.sync_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = new.email,
    updated_at = now(),
    -- Sync metadata if it changed
    first_name = COALESCE(new.raw_user_meta_data->>'first_name', first_name),
    last_name = COALESCE(new.raw_user_meta_data->>'last_name', last_name),
    full_name = COALESCE(new.raw_user_meta_data->>'full_name', full_name),
    phone = COALESCE(new.phone, new.raw_user_meta_data->>'phone', phone)
  WHERE id = new.id;
  RETURN new;
END;
$$;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.sync_user_to_profile();


-- FIX: Function to Link Registered User to existing Friend records
-- This solves the issue where a user is invited (created as a friend) BEFORE they register.
CREATE OR REPLACE FUNCTION public.link_user_to_friends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update friends table where email matches the current user's email
  -- AND linked_user_id is currently NULL
  UPDATE public.friends
  SET linked_user_id = auth.uid()
  WHERE email = auth.jwt()->>'email'
  AND linked_user_id IS NULL;
END;
$$;
