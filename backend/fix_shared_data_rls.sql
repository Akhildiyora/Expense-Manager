-- FIX EXPENSE VISIBILITY & DATA LEAK
-- Clean up old policies and re-apply strict rules.

-- 1. Helper Function Update: Correctly check both sides of a split (Debtor AND Creditor)
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

-- 2. RESET EXPENSE POLICIES (Drop potentially conflicting ones)
drop policy if exists "Users view relevant expenses" on public.expenses;
drop policy if exists "Enable read access for all users" on public.expenses;
drop policy if exists "Authenticated users can see all expenses" on public.expenses;
-- (Just in case user manually created one or older migrations left one)

-- 3. RE-APPLY STRICT POLICY
create policy "Users view relevant expenses" on public.expenses for select
using (
  auth.uid() = user_id 
  or (trip_id is not null and public.can_access_trip(trip_id))
  or public.is_involved_in_split(id)
);

-- 4. ENSURE INSERT/UPDATE ARE STRICT TOO
drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 5. TRIPS (Safety Check)
-- Ensure trip access function is robust (already done in main schema but good to refresh)
create or replace function public.can_access_trip(check_trip_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.trips t
    left join public.trip_members tm on t.id = tm.trip_id
    where t.id = check_trip_id
    and (t.user_id = auth.uid() or tm.user_id = auth.uid() or tm.email = auth.jwt()->>'email')
  );
$$;
