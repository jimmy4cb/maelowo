create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 5 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_name text not null check (char_length(friend_name) between 1 and 120),
  friend_email text not null,
  message text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, friend_email)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  provider_reference text not null unique,
  customer_email text not null,
  currency text not null check (currency = 'KES'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null check (delivery_fee >= 0),
  tax numeric(12, 2) not null check (tax >= 0),
  total numeric(12, 2) not null check (total > 0),
  payment_status text not null check (payment_status in ('paid')),
  created_at timestamptz not null default now()
);

create or replace function public.create_client_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_client_profile();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.service_reviews enable row level security;
alter table public.referrals enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
  on public.products for select to anon, authenticated
  using (active or (select public.is_admin()));

drop policy if exists "Admins can add products" on public.products;
create policy "Admins can add products"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Anyone can read service reviews" on public.service_reviews;
create policy "Anyone can read service reviews"
  on public.service_reviews for select to anon, authenticated
  using (true);

drop policy if exists "Clients can create their own reviews" on public.service_reviews;
create policy "Clients can create their own reviews"
  on public.service_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Clients can update their own reviews" on public.service_reviews;
create policy "Clients can update their own reviews"
  on public.service_reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Clients can delete their own reviews" on public.service_reviews;
create policy "Clients can delete their own reviews"
  on public.service_reviews for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Clients can read their referrals" on public.referrals;
create policy "Clients can read their referrals"
  on public.referrals for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Clients can create their referrals" on public.referrals;
create policy "Clients can create their referrals"
  on public.referrals for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Clients can view their own orders" on public.orders;
create policy "Clients can view their own orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.service_reviews to authenticated;
grant select on public.service_reviews to anon;
grant select, insert on public.referrals to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders to authenticated;

insert into public.products (name, description, price, image_url)
select seed.name, seed.description, seed.price, seed.image_url
from (values
  ('Peanut Butter', 'Natural, nutritious peanut butter.', 1200, 'assets/images/peanut-poster.jpeg'),
  ('Hibiscus Tea', 'Refreshing hibiscus tea, rich in antioxidants.', 900, 'assets/images/product-grid.jpeg'),
  ('Dried Vegetables', 'Pure, naturally dried vegetables.', 850, 'assets/images/product-grid.jpeg'),
  ('Honey', 'Raw honey with nature''s goodness.', 1100, 'assets/images/product-grid.jpeg'),
  ('Deep-Fried Fish', 'Fresh, delicious deep-fried fish.', 1400, 'assets/images/product-grid.jpeg')
) as seed(name, description, price, image_url)
where not exists (
  select 1 from public.products existing where existing.name = seed.name
);
