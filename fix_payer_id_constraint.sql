-- Fix for expenses_payer_id_fkey constraint violation
-- The 'payer_id' in expenses table is currently referenced to 'profiles(id)', 
-- but the application logic allows 'friends(id)' to be stored there when a friend pays.

-- 1. Drop the incorrect constraint
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_payer_id_fkey;

-- 2. Add the correct constraint referencing public.friends
-- Note: payer_id can be NULL (meaning 'Current User') or a UUID from friends table.
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_payer_id_fkey
FOREIGN KEY (payer_id)
REFERENCES public.friends(id)
ON DELETE SET NULL;

-- 3. (Optional but recommended) Comment on the column to clarify usage
COMMENT ON COLUMN public.expenses.payer_id IS 'NULL if paid by current user, otherwise references public.friends(id)';
