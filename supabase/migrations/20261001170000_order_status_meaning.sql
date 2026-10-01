-- Estados de un pedido según el dueño (1-oct-2026): solo dos.
--   confirmed = Pendiente: se espera la entrega del proveedor.
--   received  = Realizado: el proveedor ya entregó.
-- Los valores internos no cambian (los usa todo el sistema); la web los muestra como Pendiente y Realizado.
comment on column purchase_orders.status is
  'Estado del pedido: confirmed = Pendiente (se espera la entrega); received = Realizado (ya se entregó).';
