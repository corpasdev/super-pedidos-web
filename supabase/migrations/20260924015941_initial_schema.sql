-- Esquema inicial del Motor de Pedidos (sección 8.2 de la especificación).
-- Tablas con `store_id`, UUID, created_at/updated_at, RLS activo en todas.

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  external_id integer,
  name text not null,
  tax_id text,
  contact_email text,
  order_weekday smallint check (order_weekday between 1 and 7),
  delivery_weekday smallint check (delivery_weekday between 1 and 7),
  visit_frequency text check (visit_frequency in ('weekly','biweekly')),
  biweekly_anchor_date date,
  check (visit_frequency is distinct from 'biweekly' or biweekly_anchor_date is not null),
  minimum_order_amount integer not null default 0 check (minimum_order_amount >= 0),
  settings_are_estimated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  name text not null,
  unique (store_id, supplier_id, name)
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  external_id integer,
  barcode text not null,
  reference text,
  name text not null,
  category text not null,
  sale_price integer not null default 0,
  stock_units integer not null default 0,
  is_stock_reliable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, barcode)
);

create index on products (store_id, supplier_id);

-- ---------------------------------------------------------------------------
-- product_settings
-- ---------------------------------------------------------------------------
create table product_settings (
  product_id uuid primary key references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  unit_cost integer not null default 0 check (unit_cost >= 0),
  cost_source text not null default 'estimated' check (cost_source in ('owner','sales_report','estimated')),
  pack_size integer not null default 1 check (pack_size >= 1),
  max_stock_units integer check (max_stock_units >= 0),
  is_estimated boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sales_reports
-- ---------------------------------------------------------------------------
create table sales_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  file_name text not null,
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  covered_days_override integer check (covered_days_override >= 1),
  replenishment_mode text not null default 'fill_to_target' check (replenishment_mode in ('replenish_sold','fill_to_target')),
  safety_margin_ratio numeric(4,3) not null default 0.100,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sales_report_lines
-- ---------------------------------------------------------------------------
create table sales_report_lines (
  id uuid primary key default gen_random_uuid(),
  sales_report_id uuid not null references sales_reports(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  barcode text not null,
  product_name text,
  category text,
  units_sold numeric(12,3) not null,
  receipt_count integer not null,
  latest_purchase_cost integer,
  sale_price integer
);

create index on sales_report_lines (sales_report_id, barcode);

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  sales_report_id uuid references sales_reports(id),
  status text not null check (status in ('confirmed','received')),
  available_budget integer check (available_budget >= 0),
  maximum_order_cost integer not null check (maximum_order_cost >= 0),
  total_cost integer not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

-- ---------------------------------------------------------------------------
-- purchase_order_lines
-- ---------------------------------------------------------------------------
create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id),
  units integer not null check (units > 0),
  unit_cost integer not null,
  was_adjusted_by_owner boolean not null default false
);

-- ---------------------------------------------------------------------------
-- truck_deliveries: llegada del camión que convierte un pedido en recibido.
-- ---------------------------------------------------------------------------
create table truck_deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id),
  delivered_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory_movements
-- ---------------------------------------------------------------------------
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id),
  movement_type text not null check (movement_type in ('truck_delivery','physical_count','sale_adjustment')),
  units_delta integer not null,
  purchase_order_id uuid references purchase_orders(id),
  occurred_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- data_quality_issues
-- ---------------------------------------------------------------------------
create table data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  barcode text,
  issue_code text not null,
  original_value text,
  description text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- RLS (sección 8.3): activa en todas las tablas. El dueño solo ve su tienda.
-- La API usa la llave secreta (omite RLS) y además filtra siempre por store_id.
-- ---------------------------------------------------------------------------
alter table stores enable row level security;
alter table suppliers enable row level security;
alter table brands enable row level security;
alter table products enable row level security;
alter table product_settings enable row level security;
alter table sales_reports enable row level security;
alter table sales_report_lines enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;
alter table truck_deliveries enable row level security;
alter table inventory_movements enable row level security;
alter table data_quality_issues enable row level security;

create policy "owner reads and writes own store" on stores
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers', 'brands', 'products', 'product_settings', 'sales_reports',
    'sales_report_lines', 'purchase_orders', 'purchase_order_lines',
    'truck_deliveries', 'inventory_movements', 'data_quality_issues'
  ]
  loop
    execute format(
      'create policy "owner reads and writes own store rows" on %I for all to authenticated using (store_id in (select id from stores where owner_user_id = (select auth.uid()))) with check (store_id in (select id from stores where owner_user_id = (select auth.uid())))',
      table_name
    );
  end loop;
end $$;

-- Privilegios estandar Supabase: la API usa la llave secreta (salta RLS);
-- el web firmado usa las policies RLS de arriba.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
