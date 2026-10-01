-- Pedidos confirmados antes de guardar la fecha de llegada: se calcula con el día de entrega del proveedor
-- (el siguiente día de entrega desde el día del pedido; el mismo día si coinciden), para que aparezcan en «Llegan hoy».
update purchase_orders as orders
set expected_delivery_date =
      (orders.created_at at time zone 'America/Bogota')::date
      + (((suppliers.delivery_weekday - extract(isodow from (orders.created_at at time zone 'America/Bogota'))::int) % 7 + 7) % 7)
from suppliers
where suppliers.id = orders.supplier_id
  and orders.status = 'confirmed'
  and orders.expected_delivery_date is null
  and suppliers.delivery_weekday is not null;
