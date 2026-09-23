-- Run only in a new, isolated Supabase project for this learning demo.
-- Real customers and payment data must not be entered.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  price_yen integer not null check (price_yen >= 0),
  image_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_key uuid not null unique,
  customer_name text not null,
  customer_email text not null,
  delivery_address text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'shipped')),
  total_yen integer not null check (total_yen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity integer not null check (quantity between 1 and 10),
  unit_price_yen integer not null check (unit_price_yen >= 0),
  primary key (order_id, product_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;

-- All application reads/writes run on the Vercel server. The browser has no
-- direct table privileges, including after a normal Supabase Auth login.
revoke all on public.products, public.orders, public.order_items, public.admin_users from anon, authenticated;
grant select, insert, update on public.products, public.orders, public.order_items, public.admin_users to service_role;

-- Only the server secret can call these atomic operations. Invoker security
-- means no public SECURITY DEFINER function is exposed over the Data API.
create or replace function public.create_demo_order(
  p_order_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_delivery_address text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_total integer := 0;
  v_count integer;
  v_line record;
  v_existing record;
begin
  if p_customer_name is null or length(btrim(p_customer_name)) not between 1 and 80
     or p_customer_email is null or length(p_customer_email) > 254
     or p_customer_email !~ '^[^[:space:]@]+@example\.(com|test)$'
     or p_delivery_address is null or length(btrim(p_delivery_address)) not between 3 and 300
     or btrim(p_delivery_address) not like '架空%' then
    raise exception 'invalid customer';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid items';
  end if;

  -- Reusing an order key after a retry returns the original order.
  select id, total_yen, status into v_existing
  from public.orders where order_key = p_order_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'total_yen', v_existing.total_yen,
                              'status', v_existing.status, 'reused', true);
  end if;

  select count(*) into v_count from jsonb_array_elements(p_items);
  if (select count(distinct item->>'product_id') from jsonb_array_elements(p_items) item) <> v_count then
    raise exception 'duplicate product';
  end if;

  for v_line in
    select p.id, p.price_yen, (item->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
    join public.products p on p.id = item->>'product_id' and p.is_active = true
  loop
    if v_line.quantity not between 1 and 10 then raise exception 'invalid quantity'; end if;
    v_total := v_total + v_line.price_yen * v_line.quantity;
  end loop;
  if (select count(*) from jsonb_array_elements(p_items) item
      join public.products p on p.id = item->>'product_id' and p.is_active = true) <> v_count then
    raise exception 'inactive or missing product';
  end if;

  insert into public.orders(order_key, customer_name, customer_email, delivery_address, total_yen)
  values (p_order_key, btrim(p_customer_name), btrim(p_customer_email), btrim(p_delivery_address), v_total)
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, quantity, unit_price_yen)
  select v_order_id, p.id, (item->>'quantity')::integer, p.price_yen
  from jsonb_array_elements(p_items) item
  join public.products p on p.id = item->>'product_id' and p.is_active = true;

  return jsonb_build_object('id', v_order_id, 'total_yen', v_total,
                            'status', 'pending', 'reused', false);
exception when unique_violation then
  select id, total_yen, status into v_existing from public.orders where order_key = p_order_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'total_yen', v_existing.total_yen,
                              'status', v_existing.status, 'reused', true);
  end if;
  raise;
end;
$$;

create or replace function public.set_demo_order_status(p_order_id uuid, p_new_status text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_order record;
begin
  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id
    and ((status = 'pending' and p_new_status in ('accepted', 'rejected'))
      or (status = 'accepted' and p_new_status = 'shipped'))
  returning id, status, total_yen into v_order;
  if not found then raise exception 'invalid transition or order not found'; end if;
  return jsonb_build_object('id', v_order.id, 'status', v_order.status,
                            'total_yen', v_order.total_yen);
end;
$$;

revoke all on function public.create_demo_order(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.set_demo_order_status(uuid,text) from public, anon, authenticated;
grant execute on function public.create_demo_order(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.set_demo_order_status(uuid,text) to service_role;

insert into public.products(id, name, price_yen, image_path, sort_order)
values
  ('notebook', '方眼ノート', 680, 'assets/notebook.jpg', 1),
  ('pen', '細字ペン', 420, 'assets/pen.jpg', 2),
  ('pouch', '布製ポーチ', 1480, 'assets/pouch.jpg', 3)
on conflict (id) do update set name=excluded.name, price_yen=excluded.price_yen,
  image_path=excluded.image_path, sort_order=excluded.sort_order;

-- After creating the shop user in Supabase Auth, replace the placeholder UUID
-- and run this one statement separately:
-- insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');

