-- Vencidos para cambio (1-oct-2026): productos vencidos que el dueño separa para que el proveedor
-- los cambie en su próxima visita. Quedan pendientes hasta que se marcan como cambiados.

create table expired_exchanges (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  -- Proveedor que hace el cambio (normalmente el del producto; se guarda por si el producto cambia de proveedor).
  supplier_id uuid references suppliers(id) on delete set null,
  units integer not null check (units > 0),
  status text not null default 'pending' check (status in ('pending', 'exchanged')),
  created_at timestamptz not null default now(),
  exchanged_at timestamptz,
  check (status = 'pending' or exchanged_at is not null)
);

create index on expired_exchanges (store_id, status);

comment on table expired_exchanges is 'Productos vencidos separados para que el proveedor los cambie.';

alter table expired_exchanges enable row level security;

create policy "owner reads and writes own store rows" on expired_exchanges
  for all to authenticated
  using (store_id in (select id from stores where owner_user_id = (select auth.uid())))
  with check (store_id in (select id from stores where owner_user_id = (select auth.uid())));
