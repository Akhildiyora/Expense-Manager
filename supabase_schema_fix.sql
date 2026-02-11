-- Supabase schema for multi-user expense tracker
-- RUN THIS IN THE SUPABASE SQL EDITOR

-- ⚠️ WARNING: THIS WILL DELETE ALL EXISTING DATA ⚠️
-- We use CASCADE to handle foreign key dependencies (like expense_splits -> expenses)

drop table if exists public.expense_splits cascade;
drop table if exists public.friends cascade;
drop table if exists public.budgets cascade;
drop table if exists public.expenses cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

-- Profiles table (optional but recommended)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

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

create policy "Users manage own friends"
  on public.friends
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  date date not null default current_date,
  note text,
  is_recurring boolean not null default false,
  recurring_frequency text, -- 'daily', 'weekly', 'monthly', 'yearly', etc.
  payer_id uuid references public.friends(id) on delete set null, -- null means user paid
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Users manage own expenses"
  on public.expenses
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Budgets
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  period text not null, -- 'monthly', 'weekly', etc.
  amount numeric(12,2) not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

alter table public.budgets enable row level security;

create policy "Users manage own budgets"
  on public.budgets
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Expense splits
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade, -- who owes money (null = user)
  owed_to_friend_id uuid references public.friends(id) on delete cascade, -- who is owed money (null = user)
  share_amount numeric(12,2) not null
);

alter table public.expense_splits enable row level security;

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

-- Indexes for performance
create index if not exists idx_expenses_user_date on public.expenses(user_id, date);
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_expense_splits_expense on public.expense_splits(expense_id);
