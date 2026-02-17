
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
  SELECT EXISTS (
    -- 1. User owns the friend (and it's not self-referencing)
    SELECT 1 FROM public.friends f
    WHERE f.id = check_friend_id 
      AND f.user_id = auth.uid()
      AND (f.linked_user_id IS NULL OR f.linked_user_id != auth.uid())  -- Not self
  ) 
  OR EXISTS (
    -- 2. Friend links TO the current user (critical for cross-user share calculation)
    SELECT 1 FROM public.friends f
    WHERE f.id = check_friend_id
      AND f.linked_user_id = auth.uid()  -- Friend record links to you
  )
  OR EXISTS (
    -- 3. Friend is payer of a visible expense (and friend is not me)
    SELECT 1 FROM public.friends f
    JOIN public.expenses e ON e.payer_id = f.id
    WHERE f.id = check_friend_id
      AND (f.linked_user_id IS NULL OR f.linked_user_id != auth.uid())  -- Not self
      AND (
        e.user_id = auth.uid() 
        OR (e.trip_id IS NOT NULL AND public.can_access_trip(e.trip_id))
        OR public.is_involved_in_split(e.id)
      )
  ) 
  OR EXISTS (
    -- 4. Friend is involved in a split of a visible expense (and friend is not me)
    SELECT 1 FROM public.friends f
    JOIN public.expense_splits es ON (es.friend_id = f.id OR es.owed_to_friend_id = f.id)
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE f.id = check_friend_id
      AND (f.linked_user_id IS NULL OR f.linked_user_id != auth.uid())  -- Not self
      AND (
        e.user_id = auth.uid() 
        OR (e.trip_id IS NOT NULL AND public.can_access_trip(e.trip_id))
        OR public.is_involved_in_split(e.id)
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
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  linked_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
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
  CONSTRAINT expenses_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
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
  created_at timestamp with time zone DEFAULT now(),
  can_add_expenses boolean DEFAULT false,
  CONSTRAINT trip_members_pkey PRIMARY KEY (id),
  CONSTRAINT trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id),
  CONSTRAINT trip_members_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.friends(id)
);

----------------------------------------------------------------------------------------------------
-- 3. TRIGGERS
----------------------------------------------------------------------------------------------------

-- Trigger: Auto-create profile on new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: Auto-sync trip_members when friend is linked
CREATE OR REPLACE FUNCTION public.sync_trip_members_on_friend_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a friend.linked_user_id is set (null -> uuid or changed)
  -- Update all trip_members that reference this friend_id
  IF NEW.linked_user_id IS NOT NULL AND (OLD.linked_user_id IS NULL OR OLD.linked_user_id != NEW.linked_user_id) THEN
    UPDATE public.trip_members
    SET user_id = NEW.linked_user_id
    WHERE friend_id = NEW.id
      AND (user_id IS NULL OR user_id != NEW.linked_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_trip_members_on_friend_link_trigger ON public.friends;
CREATE TRIGGER sync_trip_members_on_friend_link_trigger
  AFTER INSERT OR UPDATE OF linked_user_id
  ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trip_members_on_friend_link();

-- Trigger: Auto-create inverse friendships (two-way sync)
CREATE OR REPLACE FUNCTION public.sync_inverse_friendship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  --Only create inverse if:
  -- 1. New friend has linked_user_id (is registered)
  -- 2. Not a self-friendship
  -- 3. Inverse doesn't already exist
  IF NEW.linked_user_id IS NOT NULL 
     AND NEW.user_id != NEW.linked_user_id 
     AND NOT EXISTS (
       SELECT 1 FROM public.friends
       WHERE user_id = NEW.linked_user_id
         AND linked_user_id = NEW.user_id
     ) THEN
    
    -- Create inverse friendship
    INSERT INTO public.friends (user_id, name, email, linked_user_id)
    SELECT 
      NEW.linked_user_id,                                  -- Friend's user_id
      p.full_name,                                         -- Owner's name
      u.email,                                             -- Owner's email
      NEW.user_id                                          -- Owner's user_id
    FROM auth.users u
    INNER JOIN public.profiles p ON p.id = NEW.user_id
    WHERE u.id = NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_inverse_friendship_trigger ON public.friends;
CREATE TRIGGER sync_inverse_friendship_trigger
  AFTER INSERT OR UPDATE OF linked_user_id
  ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inverse_friendship();

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
-- Updated policy to ensure all trip members see all trip expenses
create policy "Users view relevant expenses" on public.expenses for select
using (
  -- Personal expenses created by user
  auth.uid() = expenses.user_id 
  OR
  -- Trip expenses where user is a member (by user_id OR email)
  (
    expenses.trip_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.trips t
      LEFT JOIN public.trip_members tm ON t.id = tm.trip_id
      WHERE t.id = expenses.trip_id
      AND (
        -- User is trip creator
        t.user_id = auth.uid()
        OR
        -- User is member by user_id
        tm.user_id = auth.uid()
        OR
        -- User is member by email
        tm.email = auth.jwt()->>'email'
      )
    )
  )
  OR
  -- Expenses where user is involved in splits (for non-trip shared expenses)
  public.is_involved_in_split(expenses.id)
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
