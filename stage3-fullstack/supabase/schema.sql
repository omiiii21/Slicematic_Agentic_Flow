-- SliceMatic — Stage 3 Supabase schema (docs/SPEC.md section 6).
-- Run this in the Supabase SQL editor BEFORE seed.sql.
-- 3 normalised tables: menus, orders, order_items.

-- Menu items (replaces the .txt files; one row per sellable item)
create table if not exists menus (
  id          text primary key,              -- 'B3', 'P7', 'T2'
  category    text not null check (category in ('base','pizza','topping')),
  name        text not null,
  price       numeric(10,2) not null check (price >= 0),
  is_active   boolean not null default true
);

-- One row per placed order (header + computed totals)
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  customer_name text not null,
  phone         text not null check (phone ~ '^[6-9][0-9]{9}$'),
  quantity      int  not null check (quantity between 1 and 10),
  subtotal      numeric(10,2) not null,
  discount      numeric(10,2) not null default 0,
  gst           numeric(10,2) not null,
  total         numeric(10,2) not null,
  payment_mode  text not null check (payment_mode in ('Cash','Card','UPI'))
);

-- Line items: the base/pizza/topping that composed the order (price snapshot)
create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  menu_id     text not null references menus(id),
  component   text not null check (component in ('base','pizza','topping')),
  unit_price  numeric(10,2) not null            -- snapshot at order time
);

create index if not exists orders_created_at_idx on orders (created_at);
create index if not exists order_items_order_id_idx on order_items (order_id);

-- --------------------------------------------------------------------------- --
-- Row Level Security
--   menus       : public read (active items power the ordering UI / agent).
--   orders      : anyone may place an order (anon insert); only authenticated
--                 admins may read all orders (dashboard).
--   order_items : same posture as orders.
-- --------------------------------------------------------------------------- --
alter table menus enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- menus: public read of active items
drop policy if exists "menus public read" on menus;
create policy "menus public read"
  on menus for select
  using (is_active = true);

-- orders: public can place orders (insert); authenticated admins read all
drop policy if exists "orders public insert" on orders;
create policy "orders public insert"
  on orders for insert
  with check (true);

drop policy if exists "orders admin read" on orders;
create policy "orders admin read"
  on orders for select
  to authenticated
  using (true);

-- order_items: public can insert the 3 line items; authenticated admins read
drop policy if exists "order_items public insert" on order_items;
create policy "order_items public insert"
  on order_items for insert
  with check (true);

drop policy if exists "order_items admin read" on order_items;
create policy "order_items admin read"
  on order_items for select
  to authenticated
  using (true);
