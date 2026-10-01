-- Proveedor Vendedor y Proveedor Distribuidor (modelo del dueño, 27-sep-2026).
--   Distribuidor = la fila de `suppliers`: entrega la mercancía y cobra (total pagado = Σ paid_amount de sus pedidos).
--   Vendedor = `supplier_sellers`: toma el pedido. Un distribuidor tiene uno o varios vendedores, y un vendedor
--   puede venir varios días: una fila por visita semanal (día de pedido → día de entrega).
--   Si el día de entrega es el mismo del pedido, la mercancía llega en el acto: confirmar = recibir.

create table supplier_sellers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  seller_name text check (char_length(seller_name) <= 120),
  order_weekday smallint not null check (order_weekday between 1 and 7),
  delivery_weekday smallint not null check (delivery_weekday between 1 and 7),
  visit_frequency text not null default 'weekly' check (visit_frequency in ('weekly', 'biweekly')),
  biweekly_anchor_date date,
  check (visit_frequency = 'weekly' or biweekly_anchor_date is not null),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on supplier_sellers (store_id, order_weekday) where is_active;

alter table supplier_sellers enable row level security;

create policy "owner reads and writes own store rows" on supplier_sellers
  for all to authenticated
  using (store_id in (select id from stores where owner_user_id = (select auth.uid())))
  with check (store_id in (select id from stores where owner_user_id = (select auth.uid())));

grant all on supplier_sellers to anon, authenticated, service_role;

comment on table supplier_sellers is 'Vendedor del proveedor: una fila por visita semanal (día de pedido y día de entrega).';

-- Mientras llega la lista real del dueño: un vendedor por proveedor con el calendario que ya tenía.
insert into supplier_sellers (store_id, supplier_id, seller_name, order_weekday, delivery_weekday, visit_frequency, biweekly_anchor_date)
select store_id, id, null, order_weekday, delivery_weekday, visit_frequency, biweekly_anchor_date
from suppliers
where order_weekday is not null and delivery_weekday is not null and visit_frequency is not null;

-- El pedido recuerda qué vendedor lo tomó y cuándo debe llegar.
alter table purchase_orders
  add column seller_id uuid references supplier_sellers(id) on delete set null,
  add column expected_delivery_date date;

comment on column purchase_orders.expected_delivery_date is 'Día en que debe llegar la mercancía (el mismo día del pedido si el vendedor entrega en el acto).';
