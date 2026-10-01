-- Corrección del dueño (27-sep-2026): días de entrega de los proveedores que piden el lunes.
--   Guadalupe, Postobon y Cenneca → entregan el miércoles (3)
--   Cocacola y Ramo              → entregan el martes (2)
--   Bimbo                        → entrega el jueves (4)
-- Arepas German, MD y Colombina siguen entregando el mismo lunes.

create temporary table monday_delivery (supplier_name text, delivery_weekday smallint) on commit drop;
insert into monday_delivery values
  ('GUADALUPE ARDICOLL', 3),
  ('POSTOBON', 3),
  ('CENNECA', 3),
  ('COCACOLA DISTRIBUCIONES', 2),
  ('RAMO', 2),
  ('BIMBO DISTRIVENTAS DEL SUR', 4);

update supplier_sellers as sellers
set delivery_weekday = monday_delivery.delivery_weekday, updated_at = now()
from suppliers, monday_delivery
where suppliers.id = sellers.supplier_id
  and upper(suppliers.name) = monday_delivery.supplier_name
  and sellers.order_weekday = 1
  and sellers.is_active;

update suppliers
set delivery_weekday = monday_delivery.delivery_weekday, updated_at = now()
from monday_delivery
where upper(suppliers.name) = monday_delivery.supplier_name
  and suppliers.order_weekday = 1;
