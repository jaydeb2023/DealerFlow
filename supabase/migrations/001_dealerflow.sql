-- DealerFlow AI by Evynta: complete MVP schema (multi-company).
-- Run once in the Supabase SQL editor. Re-running is safe.
-- Security model: every table has RLS ON with NO policies, so the browser can never read them.
-- All access goes through the Next.js /api/df/* routes (service role), which always filter by org_id.

create extension if not exists pgcrypto;

create or replace function df_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- companies (platform level)
create table if not exists df_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'trial' check (status in ('trial','active','suspended')),
  plan text,
  trial_ends_at timestamptz,
  owner_email text,
  contact_mobile text,
  notes text,
  max_users int,
  max_dealers int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists df_orgs_touch on df_orgs;
create trigger df_orgs_touch before update on df_orgs for each row execute function df_touch();

-- demo requests from the marketing website (platform level)
create table if not exists df_demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null, company text, phone text, email text, message text,
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- company data
create table if not exists df_warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  name text not null, code text, address text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, name)
);
create table if not exists df_territories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  name text not null, region text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create table if not exists df_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create table if not exists df_price_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  name text not null,
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists df_staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  user_id uuid unique,
  email text not null,
  full_name text, mobile text,
  role text not null check (role in ('admin','sales_manager','sales_rep','warehouse','finance','dealer')),
  dealer_id uuid,
  territory_id uuid references df_territories(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists df_staff_email_uidx on df_staff (lower(email));
create index if not exists df_staff_org_idx on df_staff (org_id);

create table if not exists df_dealers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  dealer_code text not null,
  name text not null,
  contact_person text, phone text, phone_norm text, email text,
  billing_address text, shipping_address text, gstin text,
  rep_id uuid references df_staff(id) on delete set null,
  territory_id uuid references df_territories(id) on delete set null,
  category text,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  payment_terms_days int not null default 30 check (payment_terms_days >= 0),
  price_list_id uuid references df_price_lists(id) on delete set null,
  opening_balance numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, dealer_code)
);
create index if not exists df_dealers_org_idx on df_dealers (org_id, status);
create index if not exists df_dealers_phone_idx on df_dealers (org_id, phone_norm);
do $$ begin
  alter table df_staff add constraint df_staff_dealer_fk foreign key (dealer_id) references df_dealers(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists df_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  sku text not null,
  name text not null,
  category_id uuid references df_categories(id) on delete set null,
  brand text, description text,
  unit text not null default 'pcs',
  image_url text,
  hsn text,
  gst_rate numeric(5,2) not null default 18 check (gst_rate >= 0 and gst_rate <= 100),
  list_price numeric(14,2) not null default 0 check (list_price >= 0),
  moq numeric(14,3) not null default 1 check (moq > 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, sku)
);
create index if not exists df_products_org_idx on df_products (org_id, active);

create table if not exists df_price_list_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  price_list_id uuid not null references df_price_lists(id) on delete cascade,
  product_id uuid not null references df_products(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  unique (price_list_id, product_id)
);

-- stock per product per warehouse. reserved can never exceed on_hand => no silent overselling.
create table if not exists df_inventory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  product_id uuid not null references df_products(id) on delete cascade,
  warehouse_id uuid not null references df_warehouses(id) on delete cascade,
  on_hand numeric(14,3) not null default 0,
  reserved numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id),
  check (on_hand >= 0), check (reserved >= 0), check (reserved <= on_hand)
);
create index if not exists df_inventory_org_idx on df_inventory (org_id);

create table if not exists df_stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  product_id uuid not null references df_products(id) on delete cascade,
  warehouse_id uuid not null references df_warehouses(id) on delete cascade,
  kind text not null check (kind in ('receipt','dispatch','transfer_in','transfer_out','adjustment','return')),
  qty numeric(14,3) not null,                 -- signed effect on on_hand
  balance_after numeric(14,3),
  reason text, ref_type text, ref_id uuid,
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists df_moves_org_idx on df_stock_movements (org_id, created_at desc);
create index if not exists df_moves_product_idx on df_stock_movements (product_id, created_at desc);

-- ---------------------------------------------------------------- orders
create table if not exists df_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  order_no text not null,
  dealer_id uuid not null references df_dealers(id) on delete restrict,
  rep_id uuid references df_staff(id) on delete set null,
  status text not null default 'draft' check (status in
    ('draft','submitted','under_review','approved','picking','packed','partially_fulfilled','dispatched','delivered','rejected','cancelled','returned')),
  source text not null default 'admin' check (source in ('dealer','admin','rep')),
  order_date date not null default current_date,
  requested_delivery date,
  warehouse_id uuid references df_warehouses(id) on delete set null,
  price_list_id uuid references df_price_lists(id) on delete set null,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  shipping numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_terms_days int,
  shipping_address text,
  notes text, internal_notes text, reject_reason text,
  credit_override boolean not null default false,
  credit_override_reason text,
  stock_reserved boolean not null default false,
  submitted_at timestamptz, approved_at timestamptz, approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, order_no)
);
create index if not exists df_orders_org_idx on df_orders (org_id, status, created_at desc);
create index if not exists df_orders_dealer_idx on df_orders (dealer_id);

create table if not exists df_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  order_id uuid not null references df_orders(id) on delete cascade,
  product_id uuid not null references df_products(id) on delete restrict,
  sku text, name text, unit text,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  line_subtotal numeric(14,2) not null default 0,   -- qty * unit_price
  line_discount numeric(14,2) not null default 0,
  line_tax numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  qty_reserved numeric(14,3) not null default 0,
  qty_dispatched numeric(14,3) not null default 0,
  check (qty_dispatched <= qty)
);
create index if not exists df_order_items_order_idx on df_order_items (order_id);

create table if not exists df_order_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  order_id uuid not null references df_orders(id) on delete cascade,
  from_status text, to_status text not null, note text,
  actor_id uuid, actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists df_order_history_idx on df_order_history (order_id, created_at);

-- ---------------------------------------------------------------- dispatch
create table if not exists df_dispatches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  dispatch_no text not null,
  order_id uuid not null references df_orders(id) on delete cascade,
  warehouse_id uuid references df_warehouses(id) on delete set null,
  transporter text, vehicle_no text, tracking_no text,
  dispatched_on date not null default current_date,
  status text not null default 'dispatched' check (status in ('dispatched','delivered','exception')),
  delivered_on date, pod_url text, exception_note text,
  created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, dispatch_no)
);
create table if not exists df_dispatch_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  dispatch_id uuid not null references df_dispatches(id) on delete cascade,
  order_item_id uuid not null references df_order_items(id) on delete cascade,
  product_id uuid not null references df_products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0)
);

-- ---------------------------------------------------------------- invoices and payments
create table if not exists df_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  invoice_no text not null,
  order_id uuid references df_orders(id) on delete set null,
  dealer_id uuid not null references df_dealers(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date not null,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  shipping numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open','partial','paid','void')),
  bill_to text, ship_to text, notes text,
  created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (org_id, invoice_no),
  check (paid >= 0 and paid <= total)
);
create unique index if not exists df_invoices_one_per_order on df_invoices (order_id) where status <> 'void' and order_id is not null;
create index if not exists df_invoices_dealer_idx on df_invoices (org_id, dealer_id, status);

create table if not exists df_invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  invoice_id uuid not null references df_invoices(id) on delete cascade,
  product_id uuid references df_products(id) on delete set null,
  sku text, name text, hsn text, unit text,
  qty numeric(14,3) not null, unit_price numeric(14,2) not null,
  discount numeric(14,2) not null default 0, gst_rate numeric(5,2) not null default 0,
  tax numeric(14,2) not null default 0, line_total numeric(14,2) not null default 0
);

create table if not exists df_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  receipt_no text not null,
  dealer_id uuid not null references df_dealers(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null default 'bank_transfer' check (mode in ('cash','bank_transfer','upi','cheque','card','other')),
  reference text, paid_on date not null default current_date, notes text,
  created_by uuid, created_at timestamptz not null default now(),
  unique (org_id, receipt_no)
);
create table if not exists df_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  payment_id uuid not null references df_payments(id) on delete cascade,
  invoice_id uuid not null references df_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0)
);
-- posted payments are an audit trail: they cannot be edited or deleted
create or replace function df_payments_frozen() returns trigger language plpgsql as $$
begin raise exception 'Posted payments cannot be changed or deleted'; end $$;
drop trigger if exists df_payments_nochange on df_payments;
create trigger df_payments_nochange before update or delete on df_payments for each row execute function df_payments_frozen();
drop trigger if exists df_alloc_nochange on df_payment_allocations;
create trigger df_alloc_nochange before update or delete on df_payment_allocations for each row execute function df_payments_frozen();

-- ---------------------------------------------------------------- sales team
create table if not exists df_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  dealer_id uuid not null references df_dealers(id) on delete cascade,
  rep_id uuid references df_staff(id) on delete set null,
  kind text not null default 'visit' check (kind in ('visit','call','followup')),
  outcome text, notes text,
  visited_at timestamptz not null default now(),
  next_followup_at timestamptz, followup_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists df_visits_org_idx on df_visits (org_id, visited_at desc);
create table if not exists df_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  rep_id uuid not null references df_staff(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  sales_target numeric(14,2) not null default 0,
  collection_target numeric(14,2) not null default 0,
  unique (rep_id, period)
);
create table if not exists df_enquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  dealer_id uuid not null references df_dealers(id) on delete cascade,
  kind text not null default 'enquiry' check (kind in ('enquiry','quotation')),
  message text not null,
  status text not null default 'open' check (status in ('open','replied','closed')),
  reply text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- system
create table if not exists df_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references df_orgs(id) on delete cascade,
  staff_id uuid not null references df_staff(id) on delete cascade,
  kind text, title text not null, body text, link text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists df_notif_idx on df_notifications (staff_id, read_at, created_at desc);
create table if not exists df_settings (
  org_id uuid not null references df_orgs(id) on delete cascade,
  key text not null, value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);
create table if not exists df_counters (
  org_id uuid not null references df_orgs(id) on delete cascade,
  name text not null, value bigint not null default 0,
  primary key (org_id, name)
);
create table if not exists df_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references df_orgs(id) on delete cascade,
  actor_id uuid, actor_email text,
  table_name text, record_id text, action text, changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists df_audit_org_idx on df_audit (org_id, created_at desc);

-- touch triggers
do $$ declare t text; begin
  foreach t in array array['df_warehouses','df_staff','df_dealers','df_products','df_orders','df_dispatches','df_invoices'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function df_touch()', t, t);
  end loop;
end $$;

-- RLS on, no policies: only the server (service role) can touch data
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'df\_%' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- functions (all atomic)
create or replace function df_next_number(p_org uuid, p_name text) returns bigint language plpgsql as $$
declare v bigint;
begin
  insert into df_counters(org_id, name, value) values (p_org, p_name, 1)
  on conflict (org_id, name) do update set value = df_counters.value + 1
  returning value into v;
  return v;
end $$;

-- Create an order and its lines in one transaction (totals are computed on the server before this call).
create or replace function df_insert_order(p_order jsonb, p_items jsonb) returns uuid language plpgsql as $$
declare oid uuid; it jsonb;
begin
  insert into df_orders (org_id, order_no, dealer_id, rep_id, status, source, order_date, requested_delivery, warehouse_id,
      price_list_id, subtotal, discount_total, tax_total, shipping, total, payment_terms_days, shipping_address, notes,
      internal_notes, created_by, submitted_at)
  values ((p_order->>'org_id')::uuid, p_order->>'order_no', (p_order->>'dealer_id')::uuid, nullif(p_order->>'rep_id','')::uuid,
      p_order->>'status', p_order->>'source', coalesce(nullif(p_order->>'order_date','')::date, current_date),
      nullif(p_order->>'requested_delivery','')::date, nullif(p_order->>'warehouse_id','')::uuid,
      nullif(p_order->>'price_list_id','')::uuid, (p_order->>'subtotal')::numeric, (p_order->>'discount_total')::numeric,
      (p_order->>'tax_total')::numeric, (p_order->>'shipping')::numeric, (p_order->>'total')::numeric,
      nullif(p_order->>'payment_terms_days','')::int, p_order->>'shipping_address', p_order->>'notes',
      p_order->>'internal_notes', nullif(p_order->>'created_by','')::uuid,
      case when p_order->>'status' = 'submitted' then now() else null end)
  returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into df_order_items (org_id, order_id, product_id, sku, name, unit, qty, unit_price, discount_pct, gst_rate,
        line_subtotal, line_discount, line_tax, line_total)
    values ((p_order->>'org_id')::uuid, oid, (it->>'product_id')::uuid, it->>'sku', it->>'name', it->>'unit',
        (it->>'qty')::numeric, (it->>'unit_price')::numeric, (it->>'discount_pct')::numeric, (it->>'gst_rate')::numeric,
        (it->>'line_subtotal')::numeric, (it->>'line_discount')::numeric, (it->>'line_tax')::numeric, (it->>'line_total')::numeric);
  end loop;
  insert into df_order_history(org_id, order_id, from_status, to_status, note, actor_id, actor_name)
  values ((p_order->>'org_id')::uuid, oid, null, p_order->>'status', 'Order created', nullif(p_order->>'created_by','')::uuid, p_order->>'actor_name');
  return oid;
end $$;

-- Reserve stock for every line of an order in ONE warehouse. Fails (and changes nothing) if any line is short.
create or replace function df_reserve_order(p_org uuid, p_order uuid, p_warehouse uuid) returns void language plpgsql as $$
declare r record; n int;
begin
  if exists (select 1 from df_orders where id = p_order and org_id = p_org and stock_reserved) then return; end if;
  for r in select oi.id, oi.product_id, oi.qty, oi.name from df_order_items oi where oi.order_id = p_order and oi.org_id = p_org loop
    update df_inventory set reserved = reserved + r.qty, updated_at = now()
     where org_id = p_org and product_id = r.product_id and warehouse_id = p_warehouse and on_hand - reserved >= r.qty;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'Not enough stock for % in this warehouse', r.name; end if;
    update df_order_items set qty_reserved = r.qty where id = r.id;
  end loop;
  update df_orders set stock_reserved = true, warehouse_id = p_warehouse where id = p_order and org_id = p_org;
end $$;

-- Give back whatever is still reserved (cancel / reject / return to review).
create or replace function df_release_order(p_org uuid, p_order uuid) returns void language plpgsql as $$
declare r record; wh uuid;
begin
  select warehouse_id into wh from df_orders where id = p_order and org_id = p_org and stock_reserved;
  if wh is null then return; end if;
  for r in select id, product_id, qty_reserved, qty_dispatched from df_order_items where order_id = p_order and org_id = p_org loop
    if r.qty_reserved - r.qty_dispatched > 0 then
      update df_inventory set reserved = greatest(reserved - (r.qty_reserved - r.qty_dispatched), 0), updated_at = now()
       where org_id = p_org and product_id = r.product_id and warehouse_id = wh;
    end if;
    update df_order_items set qty_reserved = qty_dispatched where id = r.id;
  end loop;
  update df_orders set stock_reserved = false where id = p_order and org_id = p_org;
end $$;

-- Dispatch (some or all of) an order: stock leaves the warehouse, reservation is consumed.
-- p_lines = [{"order_item_id": "...", "qty": 5}, ...]
create or replace function df_dispatch_order(p_org uuid, p_order uuid, p_lines jsonb, p_transporter text, p_vehicle text,
    p_tracking text, p_date date, p_user uuid) returns jsonb language plpgsql as $$
declare ln jsonb; oi record; wh uuid; did uuid; dno text; q numeric; all_done boolean; n int; bal numeric;
begin
  select warehouse_id into wh from df_orders where id = p_order and org_id = p_org and status in ('approved','picking','packed','partially_fulfilled') and stock_reserved;
  if wh is null then raise exception 'Order is not ready to dispatch (it must be approved with stock reserved)'; end if;
  dno := 'DSP-' || lpad(df_next_number(p_org, 'dispatch')::text, 5, '0');
  insert into df_dispatches(org_id, dispatch_no, order_id, warehouse_id, transporter, vehicle_no, tracking_no, dispatched_on, created_by)
  values (p_org, dno, p_order, wh, p_transporter, p_vehicle, p_tracking, coalesce(p_date, current_date), p_user) returning id into did;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := (ln->>'qty')::numeric;
    if q is null or q <= 0 then continue; end if;
    select * into oi from df_order_items where id = (ln->>'order_item_id')::uuid and order_id = p_order and org_id = p_org for update;
    if not found then raise exception 'Unknown order line'; end if;
    if oi.qty_dispatched + q > oi.qty then raise exception 'Cannot dispatch more than ordered for %', oi.name; end if;
    update df_inventory set on_hand = on_hand - q, reserved = reserved - q, updated_at = now()
     where org_id = p_org and product_id = oi.product_id and warehouse_id = wh and reserved >= q and on_hand >= q
     returning on_hand into bal;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'Stock record out of step for %. Check inventory.', oi.name; end if;
    update df_order_items set qty_dispatched = qty_dispatched + q where id = oi.id;
    insert into df_dispatch_items(org_id, dispatch_id, order_item_id, product_id, qty) values (p_org, did, oi.id, oi.product_id, q);
    insert into df_stock_movements(org_id, product_id, warehouse_id, kind, qty, balance_after, reason, ref_type, ref_id, created_by)
    values (p_org, oi.product_id, wh, 'dispatch', -q, bal, 'Dispatch ' || dno, 'dispatch', did, p_user);
  end loop;
  if not exists (select 1 from df_dispatch_items where dispatch_id = did) then raise exception 'Enter at least one quantity to dispatch'; end if;
  select bool_and(qty_dispatched >= qty) into all_done from df_order_items where order_id = p_order;
  update df_orders set status = case when all_done then 'dispatched' else 'partially_fulfilled' end, stock_reserved = not all_done where id = p_order;
  return jsonb_build_object('dispatch_id', did, 'dispatch_no', dno, 'complete', all_done);
end $$;

-- Stock receipt / adjustment / return. p_qty is signed for adjustments.
create or replace function df_stock_change(p_org uuid, p_product uuid, p_wh uuid, p_kind text, p_qty numeric, p_reason text, p_user uuid)
returns numeric language plpgsql as $$
declare bal numeric;
begin
  if p_kind not in ('receipt','adjustment','return') then raise exception 'Invalid movement type'; end if;
  if p_qty = 0 then raise exception 'Quantity cannot be zero'; end if;
  if p_kind in ('receipt','return') and p_qty < 0 then raise exception 'Quantity must be positive'; end if;
  if not exists (select 1 from df_products where id = p_product and org_id = p_org) then raise exception 'Unknown product'; end if;
  if not exists (select 1 from df_warehouses where id = p_wh and org_id = p_org) then raise exception 'Unknown warehouse'; end if;
  insert into df_inventory(org_id, product_id, warehouse_id, on_hand) values (p_org, p_product, p_wh, 0) on conflict (product_id, warehouse_id) do nothing;
  begin
    update df_inventory set on_hand = on_hand + p_qty, updated_at = now()
     where org_id = p_org and product_id = p_product and warehouse_id = p_wh returning on_hand into bal;
  exception when check_violation then
    raise exception 'Stock cannot go below the quantity already reserved for orders';
  end;
  insert into df_stock_movements(org_id, product_id, warehouse_id, kind, qty, balance_after, reason, created_by)
  values (p_org, p_product, p_wh, p_kind, p_qty, bal, p_reason, p_user);
  return bal;
end $$;

create or replace function df_stock_transfer(p_org uuid, p_product uuid, p_from uuid, p_to uuid, p_qty numeric, p_reason text, p_user uuid)
returns void language plpgsql as $$
declare b1 numeric; b2 numeric;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_from = p_to then raise exception 'Choose two different warehouses'; end if;
  if not exists (select 1 from df_warehouses where id in (p_from, p_to) and org_id = p_org having count(*) = 2) then raise exception 'Unknown warehouse'; end if;
  begin
    update df_inventory set on_hand = on_hand - p_qty, updated_at = now()
     where org_id = p_org and product_id = p_product and warehouse_id = p_from returning on_hand into b1;
    if b1 is null then raise exception 'No stock in the source warehouse'; end if;
  exception when check_violation then
    raise exception 'Not enough free stock in the source warehouse (some is reserved for orders)';
  end;
  insert into df_inventory(org_id, product_id, warehouse_id, on_hand) values (p_org, p_product, p_to, 0) on conflict (product_id, warehouse_id) do nothing;
  update df_inventory set on_hand = on_hand + p_qty, updated_at = now() where org_id = p_org and product_id = p_product and warehouse_id = p_to returning on_hand into b2;
  insert into df_stock_movements(org_id, product_id, warehouse_id, kind, qty, balance_after, reason, created_by) values
    (p_org, p_product, p_from, 'transfer_out', -p_qty, b1, p_reason, p_user),
    (p_org, p_product, p_to, 'transfer_in', p_qty, b2, p_reason, p_user);
end $$;

-- Invoice an order (one live invoice per order; enforced by a unique index).
create or replace function df_create_invoice(p_org uuid, p_order uuid, p_user uuid, p_date date) returns uuid language plpgsql as $$
declare o record; d record; inv uuid; ino text; terms int; idate date;
begin
  select * into o from df_orders where id = p_order and org_id = p_org for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('draft','submitted','under_review','rejected','cancelled') then raise exception 'Only approved orders can be invoiced'; end if;
  if exists (select 1 from df_invoices where order_id = p_order and status <> 'void') then raise exception 'This order already has an invoice'; end if;
  select * into d from df_dealers where id = o.dealer_id;
  terms := coalesce(o.payment_terms_days, d.payment_terms_days, 30);
  idate := coalesce(p_date, current_date);
  ino := 'INV-' || lpad(df_next_number(p_org, 'invoice')::text, 5, '0');
  insert into df_invoices(org_id, invoice_no, order_id, dealer_id, invoice_date, due_date, subtotal, discount_total, tax_total, shipping, total,
      bill_to, ship_to, created_by)
  values (p_org, ino, p_order, o.dealer_id, idate, idate + terms, o.subtotal, o.discount_total, o.tax_total, o.shipping, o.total,
      d.billing_address, coalesce(o.shipping_address, d.shipping_address), p_user) returning id into inv;
  insert into df_invoice_items(org_id, invoice_id, product_id, sku, name, hsn, unit, qty, unit_price, discount, gst_rate, tax, line_total)
  select p_org, inv, oi.product_id, oi.sku, oi.name, p.hsn, oi.unit, oi.qty, oi.unit_price, oi.line_discount, oi.gst_rate, oi.line_tax, oi.line_total
    from df_order_items oi left join df_products p on p.id = oi.product_id where oi.order_id = p_order;
  return inv;
end $$;

-- Record a payment and allocate it to invoices atomically. p_alloc = [{"invoice_id": "...", "amount": 500}]
-- Anything not allocated stays on the dealer account as an advance (it reduces the balance).
create or replace function df_record_payment(p_org uuid, p_dealer uuid, p_amount numeric, p_mode text, p_ref text, p_date date,
    p_notes text, p_alloc jsonb, p_user uuid) returns jsonb language plpgsql as $$
declare pid uuid; rno text; a jsonb; inv record; amt numeric; sum_alloc numeric := 0;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if not exists (select 1 from df_dealers where id = p_dealer and org_id = p_org) then raise exception 'Unknown dealer'; end if;
  if p_ref is not null and length(trim(p_ref)) > 0 and exists (
      select 1 from df_payments where org_id = p_org and dealer_id = p_dealer and lower(reference) = lower(trim(p_ref)) and mode = p_mode) then
    raise exception 'A payment with this reference is already recorded for this dealer';
  end if;
  rno := 'RCT-' || lpad(df_next_number(p_org, 'receipt')::text, 5, '0');
  insert into df_payments(org_id, receipt_no, dealer_id, amount, mode, reference, paid_on, notes, created_by)
  values (p_org, rno, p_dealer, p_amount, p_mode, nullif(trim(p_ref), ''), coalesce(p_date, current_date), p_notes, p_user) returning id into pid;
  for a in select * from jsonb_array_elements(coalesce(p_alloc, '[]'::jsonb)) loop
    amt := (a->>'amount')::numeric;
    if amt is null or amt <= 0 then continue; end if;
    select * into inv from df_invoices where id = (a->>'invoice_id')::uuid and org_id = p_org and dealer_id = p_dealer and status <> 'void' for update;
    if not found then raise exception 'An invoice in the allocation does not belong to this dealer'; end if;
    if amt > inv.total - inv.paid then raise exception 'Allocation for % is more than its balance', inv.invoice_no; end if;
    sum_alloc := sum_alloc + amt;
    if sum_alloc > p_amount then raise exception 'Allocated amount is more than the payment'; end if;
    insert into df_payment_allocations(org_id, payment_id, invoice_id, amount) values (p_org, pid, inv.id, amt);
    update df_invoices set paid = paid + amt, status = case when paid + amt >= total then 'paid' else 'partial' end where id = inv.id;
  end loop;
  return jsonb_build_object('payment_id', pid, 'receipt_no', rno, 'allocated', sum_alloc, 'advance', p_amount - sum_alloc);
end $$;

-- Receivable position of every dealer: opening balance + invoices - all payments (advances reduce it).
create or replace function df_dealer_balances(p_org uuid)
returns table (dealer_id uuid, opening numeric, invoiced numeric, received numeric, overdue numeric, balance numeric)
language sql stable as $$
  select d.id, d.opening_balance, coalesce(i.invoiced, 0), coalesce(p.received, 0), coalesce(i.overdue, 0),
         d.opening_balance + coalesce(i.invoiced, 0) - coalesce(p.received, 0)
    from df_dealers d
    left join (select dealer_id, sum(total) invoiced,
                      sum(case when due_date < current_date and status in ('open','partial') then total - paid else 0 end) overdue
                 from df_invoices where org_id = p_org and status <> 'void' group by dealer_id) i on i.dealer_id = d.id
    left join (select dealer_id, sum(amount) received from df_payments where org_id = p_org group by dealer_id) p on p.dealer_id = d.id
   where d.org_id = p_org
$$;

-- private bucket for proof-of-delivery photos (skipped quietly if Storage is not available)
do $$ begin
  insert into storage.buckets (id, name, public) values ('df-pod', 'df-pod', false) on conflict (id) do nothing;
exception when others then null; end $$;
