-- AGGRESSIVE RLS RESET & FIX
-- This script dynamically drops ALL policies on the 'expenses' table to ensure no rogue policies persist.
-- Then it applies the STRICTEST possible rules.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Drop ALL policies on 'expenses'
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'expenses') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.expenses';
  END LOOP;

  -- 2. Drop ALL policies on 'expense_splits'
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'expense_splits') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.expense_splits';
  END LOOP;
  
  -- 3. Drop ALL policies on 'friends'
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'friends') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.friends';
  END LOOP;

  -- 4. Drop ALL policies on 'categories'
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'categories') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.categories';
  END LOOP;
END $$;

-- 5. Helper Function: IS INVOLVED IN SPLIT (Strict & Correct)
create or replace function public.is_involved_in_split(check_expense_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.expense_splits es
    left join public.friends f_debtor on f_debtor.id = es.friend_id
    left join public.friends f_creditor on f_creditor.id = es.owed_to_friend_id
    where es.expense_id = check_expense_id
    and (
      (f_debtor.linked_user_id = auth.uid() OR f_debtor.email = auth.jwt()->>'email')
      OR 
      (f_creditor.linked_user_id = auth.uid() OR f_creditor.email = auth.jwt()->>'email')
    )
  );
$$;

-- 6. Helper Function: CAN VIEW FRIEND (Strict)
create or replace function public.can_view_friend_bypassing_rls(check_friend_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.friends f
    where f.id = check_friend_id 
    and f.user_id = auth.uid()
  ) 
  OR exists (
    select 1 from public.expenses e
    where e.payer_id = check_friend_id
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
      or public.is_involved_in_split(e.id)
    )
  ) 
  OR exists (
    select 1 from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where (es.friend_id = check_friend_id OR es.owed_to_friend_id = check_friend_id)
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
      or public.is_involved_in_split(e.id)
    )
  );
$$;

-- 7. Helper Function: CAN VIEW CATEGORY (Strict)
create or replace function public.can_view_category_bypassing_rls(check_category_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.categories c
    where c.id = check_category_id
    and c.user_id = auth.uid()
  )
  OR exists (
    select 1 from public.expenses e
    where e.category_id = check_category_id
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
      or public.is_involved_in_split(e.id)
    )
  );
$$;

-- 8. APPLY STRICT POLICIES

-- EXPENSES (Reset)
alter table public.expenses enable row level security;

create policy "Users view relevant expenses" on public.expenses for select
using (
  auth.uid() = expenses.user_id 
  or (expenses.trip_id is not null and public.can_access_trip(expenses.trip_id))
  or public.is_involved_in_split(expenses.id)
);

create policy "Users manage own expenses" on public.expenses for all
using (auth.uid() = expenses.user_id)
with check (auth.uid() = expenses.user_id);

-- EXPENSE SPLITS (Reset)
alter table public.expense_splits enable row level security;

create policy "Users view relevant splits" on public.expense_splits for select
using (
  exists (
    select 1 from public.friends f 
    where f.id = expense_splits.friend_id
    and (f.linked_user_id = auth.uid() OR f.email = auth.jwt()->>'email')
  )
  or exists (
    select 1 from public.expenses e where e.id = expense_splits.expense_id
    and (e.user_id = auth.uid() or (e.trip_id is not null and public.can_access_trip(e.trip_id)))
  )
);

create policy "Users manage splits via own expenses" on public.expense_splits for all
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_splits.expense_id
    and e.user_id = auth.uid()
  )
);

-- FRIENDS (Reset)
alter table public.friends enable row level security;

create policy "Users manage relevant friends" on public.friends
  using (public.can_view_friend_bypassing_rls(id))
  with check (auth.uid() = user_id);

-- CATEGORIES (Reset)
alter table public.categories enable row level security;

create policy "Users manage relevant categories" on public.categories
  using (public.can_view_category_bypassing_rls(id))
  with check (auth.uid() = user_id);
