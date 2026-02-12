-- RUN THIS SCRIPT IN THE SUPABASE SQL EDITOR

-- 1. Add new columns to public.profiles if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text;

-- 2. Update the handle_new_user function to populate these new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, phone, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'full_name',
    -- Use the phone from Auth (if phone login) or Metadata (if mixed login)
    COALESCE(new.phone, new.raw_user_meta_data->>'phone'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    phone = excluded.phone,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing profiles (Optional)
-- This tries to pull latest data from auth.users meta_data into the profiles table
UPDATE public.profiles p
SET
  first_name = (u.raw_user_meta_data->>'first_name')::text,
  last_name = (u.raw_user_meta_data->>'last_name')::text,
  phone = COALESCE(u.phone, (u.raw_user_meta_data->>'phone')::text),
  full_name = COALESCE((u.raw_user_meta_data->>'full_name')::text, p.full_name)
FROM auth.users u
WHERE p.id = u.id;
