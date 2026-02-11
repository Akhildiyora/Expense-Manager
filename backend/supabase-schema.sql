-- Supabase schema for multi-user expense tracker

-- If you previously created these tables with a different structure,
-- drop them first to avoid column mismatch errors (e.g. missing user_id).
-- Drop tables in reverse order of dependency
drop table if exists public.expense_splits;
drop table if exists public.trip_members;
drop table if exists public.expenses;
drop table if exists public.budgets;
drop table if exists public.trips;
drop table if exists public.friends;
drop table if exists public.categories;

-- Profiles table (optional but recommended)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  parent_id uuid references public.categories(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories"
  on public.categories
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Friends
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table public.friends enable row level security;

drop policy if exists "Users manage own friends" on public.friends;
create policy "Users manage own friends"
  on public.friends
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trips
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  budget numeric(12,2),
  start_date date,
  end_date date,
  currency text not null default 'INR',
  created_at timestamptz default now()
);

alter table public.trips enable row level security;

drop policy if exists "Users manage own trips" on public.trips;
create policy "Users manage own trips"
  on public.trips
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  category_id uuid references public.categories(id),
  title text not null,
  date date not null default current_date,
  note text,
  is_recurring boolean not null default false,
  recurring_frequency text, -- 'weekly', 'monthly', etc.
  payer_id uuid references public.friends(id), -- null means user paid
  trip_id uuid references public.trips(id) on delete set null,
  payment_mode text check (payment_mode in ('cash', 'online', 'card')),
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses"
  on public.expenses
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Budgets
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id),
  period text not null, -- 'monthly', 'weekly', etc.
  amount numeric(12,2) not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

alter table public.budgets enable row level security;

drop policy if exists "Users manage own budgets" on public.budgets;
create policy "Users manage own budgets"
  on public.budgets
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Expense splits
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  friend_id uuid references public.friends(id), -- who owes money (null = user)
  owed_to_friend_id uuid references public.friends(id), -- who is owed money (null = user)
  share_amount numeric(12,2) not null
);

alter table public.expense_splits enable row level security;

drop policy if exists "Users manage splits via own expenses" on public.expense_splits;
create policy "Users manage splits via own expenses"
  on public.expense_splits
  using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_splits.expense_id
      and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_splits.expense_id
      and e.user_id = auth.uid()
    )
  );

-- Trip Members
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  friend_id uuid not null references public.friends(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.trip_members enable row level security;

drop policy if exists "Users manage trip members via own trips" on public.trip_members;
create policy "Users manage trip members via own trips"
  on public.trip_members
  using (
    exists (
      select 1
      from public.trips t
      where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trips t
      where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
    )
  );

-- Helpful indexes
create index if not exists idx_expenses_user_date on public.expenses(user_id, date);
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_trips_user on public.trips(user_id);
create index if not exists idx_expenses_trip on public.expenses(trip_id);
