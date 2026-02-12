-- MASTER SCHEMA SCRIPT
-- Supabase schema for multi-user expense tracker
-- RUN THIS IN THE SUPABASE SQL EDITOR
-- ⚠️ WARNING: THIS WILL DELETE ALL EXISTING DATA and RECREATE THE DATABASE STRUCTURE ⚠️

-- 1. DROP EXISTING TABLES (Order matters for foreign keys)
drop table if exists public.notifications cascade;
drop table if exists public.expense_splits cascade;
drop table if exists public.trip_members cascade;
drop table if exists public.expenses cascade;
drop table if exists public.trips cascade;
drop table if exists public.budgets cascade;
drop table if exists public.friends cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

-- 2. CREATE TABLES

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Function to handle new user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- CATEGORIES
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


-- FRIENDS
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  linked_user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.friends enable row level security;

create policy "Users manage own friends"
  on public.friends
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_friends_linked_user on public.friends(linked_user_id);
create index if not exists idx_friends_email on public.friends(email);


-- TRIPS
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  budget numeric(12,2),
  currency text not null default 'INR',
  created_at timestamptz default now()
);

alter table public.trips enable row level security;

-- TRIP MEMBERS
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade,
  user_id uuid references auth.users(id), -- If they are a registered user
  email text, -- For invites
  role text check (role in ('admin', 'viewer', 'editor')) default 'viewer',
  created_at timestamptz default now()
);

alter table public.trip_members enable row level security;


-- EXPENSES
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  category_id uuid references public.categories(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  title text not null,
  date date not null default current_date,
  note text,
  is_recurring boolean not null default false,
  recurring_frequency text, -- 'daily', 'weekly', 'monthly', 'yearly'
  payer_id uuid references public.friends(id) on delete set null, -- null means user paid
  payment_mode text check (payment_mode in ('cash', 'online', 'card')),
  is_settlement boolean default false,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;


-- BUDGETS
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  period text not null, -- 'monthly', 'weekly'
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


-- EXPENSE SPLITS
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade, -- who owes money (null = user)
  owed_to_friend_id uuid references public.friends(id) on delete cascade, -- who is owed money (null = user)
  share_amount numeric(12,2) not null,
  paid_amount numeric(12,2) default 0,
  is_settled boolean default false
);

alter table public.expense_splits enable row level security;


-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null, -- Recipient
  sender_id uuid references auth.users(id), -- Sender
  trip_id uuid references public.trips(id), -- Related Trip
  title text not null,
  message text,
  is_read boolean default false,
  type text check (type in ('reminder', 'settlement', 'invite', 'system', 'expense')) default 'system',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');


-- 3. HELPER FUNCTIONS & ADVANCED RLS POLICIES

-- A. Check Trip Access
create or replace function public.can_access_trip(check_trip_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.trips t
    left join public.trip_members tm on t.id = tm.trip_id
    where t.id = check_trip_id
    and (t.user_id = auth.uid() or tm.user_id = auth.uid() or tm.email = auth.jwt()->>'email')
  );
$$;

-- B. Check if User is in Split
create or replace function public.is_involved_in_split(check_expense_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.expense_splits es
    left join public.friends f on f.id = es.friend_id
    where es.expense_id = check_expense_id
    and (f.linked_user_id = auth.uid() OR f.email = auth.jwt()->>'email')
  );
$$;

-- C. Check if User can View Expense (Bypass)
create or replace function public.can_view_expense_bypassing_rls(check_expense_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.expenses e
    where e.id = check_expense_id
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
    )
  );
$$;

-- D. Get Shared Trips Helper
create or replace function get_shared_trips(userid uuid)
returns setof trips as $$
  select t.* from trips t
  join trip_members tm on t.id = tm.trip_id
  join friends f on tm.friend_id = f.id
  where f.linked_user_id = userid
$$ language sql stable;


-- 4. APPLY ADVANCED POLICIES

-- TRIPS
create policy "Users view own or member trips" on public.trips for select
using (public.can_access_trip(trips.id));

create policy "Users can insert own trips" on public.trips for insert
with check (auth.uid() = user_id);

create policy "Users can update own trips" on public.trips for update
using (auth.uid() = user_id);
-- Note: You might want to allow admins to update trips too, but for now strict ownership.


-- TRIP MEMBERS
create policy "Users view own or related trip members" on public.trip_members for select
using (
  trip_members.user_id = auth.uid() 
  or trip_members.email = auth.jwt()->>'email' 
  or public.can_access_trip(trip_members.trip_id)
);

create policy "Trip owners and admins can manage members" on public.trip_members for all
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_members.trip_id
    and t.user_id = auth.uid()
  )
);


-- EXPENSES
create policy "Users view relevant expenses" on public.expenses for select
using (
  auth.uid() = expenses.user_id 
  or (expenses.trip_id is not null and public.can_access_trip(expenses.trip_id))
  or public.is_involved_in_split(expenses.id)
);

create policy "Users manage own expenses" on public.expenses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- EXPENSE SPLITS
create policy "Users view relevant splits" on public.expense_splits for select
using (
  exists (
    select 1 from public.friends f 
    where f.id = expense_splits.friend_id
    and (f.linked_user_id = auth.uid() OR f.email = auth.jwt()->>'email')
  )
  or public.can_view_expense_bypassing_rls(expense_splits.expense_id)
);

create policy "Users manage splits via own expenses" on public.expense_splits for all
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_splits.expense_id
    and e.user_id = auth.uid()
  )
);


-- 5. INDEXES
create index if not exists idx_expenses_user_date on public.expenses(user_id, date);
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_expense_splits_expense on public.expense_splits(expense_id);
create index if not exists idx_trips_user on public.trips(user_id);
create index if not exists idx_expenses_trip on public.expenses(trip_id);
