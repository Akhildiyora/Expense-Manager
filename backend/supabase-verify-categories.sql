-- Verify categories table supports main categories and subcategories
-- Run this in Supabase SQL Editor if you encounter issues adding categories

-- Ensure parent_id column exists (for subcategories)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

-- Ensure icon column exists (nullable)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text;

-- RLS policies (categories table)
-- If categories insert fails with 400, verify these policies exist:
-- Policy "Users manage own categories" with USING (auth.uid() = user_id) and WITH CHECK (auth.uid() = user_id)
