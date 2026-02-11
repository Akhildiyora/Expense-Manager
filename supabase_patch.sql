-- PATCH SCRIPT: Fix Schema Issues without full reset
-- Run this in Supabase SQL Editor

-- 1. Add recurring_frequency to expenses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'recurring_frequency') THEN
        ALTER TABLE public.expenses ADD COLUMN recurring_frequency text;
    END IF;
END $$;

-- 2. Fix Budgets Foreign Key to be CASCADE
-- First drop the existing constraint (we try standard names, or catch error if tricky, but dropping by name is best guess)
-- accepted name usually: budgets_category_id_fkey

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_category_id_fkey;

ALTER TABLE public.budgets
    ADD CONSTRAINT budgets_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE CASCADE;

-- 3. Fix Expense Splits Foreign Key (owed_to_friend_id) if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'owed_to_friend_id') THEN
        ALTER TABLE public.expense_splits ADD COLUMN owed_to_friend_id uuid REFERENCES public.friends(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure RLS policies are enabled (just in case)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
