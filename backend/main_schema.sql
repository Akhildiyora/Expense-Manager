
-- MAIN SCHEMA DEFINITION
-- Includes Tables, Constraints, Indexes, Functions, Triggers, and RLS Policies.

----------------------------------------------------------------------------------------------------
-- 1. FUNCTIONS FIRST (Needed for defaults and policies)
----------------------------------------------------------------------------------------------------

-- Function to handle new user (auto-create profile)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;


-- RLS Helper: Can view a trip?
create or replace function public.can_access_trip(check_trip_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.trips t
    left join public.trip_members tm on t.id = tm.trip_id
    where t.id = check_trip_id
    and (t.user_id = auth.uid() or tm.user_id = auth.uid() or tm.email = auth.jwt()->>'email')
  );
$$;

-- RLS Helper: Is involved in an expense split?
create or replace function public.is_involved_in_split(check_expense_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.expense_splits es
    left join public.friends f on f.id = es.friend_id
    where es.expense_id = check_expense_id
    and (f.linked_user_id = auth.uid() OR f.email = auth.jwt()->>'email')
  );
$$;

-- RLS Helper: Can view a friend bypassing recursion?
create or replace function public.can_view_friend_bypassing_rls(check_friend_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    -- 1. User owns the friend
    select 1 from public.friends f
    where f.id = check_friend_id 
    and f.user_id = auth.uid()
  ) 
  OR exists (
    -- 2. Friend is payer of a visible expense
    select 1 from public.expenses e
    where e.payer_id = check_friend_id
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
      or public.is_involved_in_split(e.id)
    )
  ) 
  OR exists (
    -- 3. Friend is involved in a split of a visible expense
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

-- RLS Helper: Can view a category bypassing recursion?
create or replace function public.can_view_category_bypassing_rls(check_category_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    -- 1. User owns category
    select 1 from public.categories c
    where c.id = check_category_id
    and c.user_id = auth.uid()
  )
  OR exists (
    -- 2. Category is used in a visible expense
    select 1 from public.expenses e
    where e.category_id = check_category_id
    and (
      e.user_id = auth.uid() 
      or (e.trip_id is not null and public.can_access_trip(e.trip_id))
      or public.is_involved_in_split(e.id)
    )
  );
$$;

----------------------------------------------------------------------------------------------------
-- 2. TABLES & CONSTRAINTS
----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  phone text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id)
);

CREATE TABLE IF NOT EXISTS public.friends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- The owner of the friend entry (must be a profile id now)
  name text NOT NULL,
  email text,
  linked_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
  -- Per user schema provided, referencing profiles(id) ensures profile exists
  CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT friends_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.trips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  budget numeric,
  currency text NOT NULL DEFAULT 'INR'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trips_pkey PRIMARY KEY (id),
  CONSTRAINT trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR'::text,
  category_id uuid,
  trip_id uuid,
  title text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text,
  payer_id uuid,
  payment_mode text CHECK (payment_mode = ANY (ARRAY['cash'::text, 'online'::text, 'card'::text])),
  is_settlement boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  -- Added necessary constraints
  CONSTRAINT expenses_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id), -- User specified this
  CONSTRAINT expenses_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.friends(id),
  CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  friend_id uuid,
  owed_to_friend_id uuid,
  share_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  is_settled boolean DEFAULT false,
  CONSTRAINT expense_splits_pkey PRIMARY KEY (id),
  CONSTRAINT expense_splits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id),
  CONSTRAINT expense_splits_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.friends(id),
  CONSTRAINT expense_splits_owed_to_friend_id_fkey FOREIGN KEY (owed_to_friend_id) REFERENCES public.friends(id)
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid,
  period text NOT NULL,
  amount numeric NOT NULL,
  start_date date,
  end_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_id uuid,
  trip_id uuid,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  type text DEFAULT 'system'::text CHECK (type = ANY (ARRAY['reminder'::text, 'settlement'::text, 'invite'::text, 'system'::text, 'expense'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT notifications_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);

CREATE TABLE IF NOT EXISTS public.trip_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  friend_id uuid,
  user_id uuid,
  email text,
  role text DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['admin'::text, 'viewer'::text, 'editor'::text])),
  can_add_expenses boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trip_members_pkey PRIMARY KEY (id),
  CONSTRAINT trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id),
  CONSTRAINT trip_members_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.friends(id)
);

----------------------------------------------------------------------------------------------------
-- 3. TRIGGERS
----------------------------------------------------------------------------------------------------

-- Trigger for new user handling
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


----------------------------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
----------------------------------------------------------------------------------------------------

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.friends enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.expense_splits enable row level security;
alter table public.notifications enable row level security;

-- PROFILES
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- CATEGORIES
create policy "Users manage relevant categories" on public.categories
  using (public.can_view_category_bypassing_rls(id))
  with check (auth.uid() = user_id);

-- FRIENDS
create policy "Users manage relevant friends" on public.friends
  using (public.can_view_friend_bypassing_rls(id))
  with check (auth.uid() = user_id);

-- TRIPS
create policy "Users view own or member trips" on public.trips for select
  using (public.can_access_trip(trips.id));

create policy "Users can insert own trips" on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips" on public.trips for update
  using (auth.uid() = user_id);

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

-- INSERT: Personal expenses OR trip expenses with permission
create policy "Users can insert own or permitted trip expenses" on public.expenses for insert
with check (
  auth.uid() = user_id AND (
    -- Personal expense (no trip_id)
    trip_id IS NULL
    OR
    -- Trip expense: Owner can always add
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR
    -- Trip expense: Admin/Editor can add by role
    EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
    OR
    -- Trip expense: Members with explicit permission
    EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND can_add_expenses = true
    )
  )
);

-- UPDATE: Personal expenses OR trip expenses (owner/admin only)
create policy "Users can update own or admin trip expenses" on public.expenses for update
using (
  auth.uid() = user_id AND (
    -- Personal expense
    trip_id IS NULL
    OR
    -- Trip expense: Owner can update
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR
    -- Trip expense: Admin can update
    EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  )
)
with check (auth.uid() = user_id);

-- DELETE: Personal expenses OR trip expenses (owner/admin only)
create policy "Users can delete own or admin trip expenses" on public.expenses for delete
using (
  auth.uid() = user_id AND (
    -- Personal expense
    trip_id IS NULL
    OR
    -- Trip expense: Owner can delete
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR
    -- Trip expense: Admin can delete
    EXISTS (
      SELECT 1 FROM public.trip_members 
      WHERE trip_id = expenses.trip_id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  )
);

-- EXPENSE SPLITS
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

-- BUDGETS
create policy "Users manage own budgets" on public.budgets
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- NOTIFICATIONS
create policy "Users can view their own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Authenticated users can insert notifications" on public.notifications for insert with check (auth.role() = 'authenticated');
