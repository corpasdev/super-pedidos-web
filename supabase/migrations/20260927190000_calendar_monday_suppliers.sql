-- Calendario real, primera parte (dueño, 27-sep-2026): proveedores que hacen pedido el LUNES.
-- "Todos los días de pedido hace y entrega": toman el pedido y entregan el mismo lunes (confirmar = recibir).
-- Ramo, Cenneca (nuevo), Cocacola, Guadalupe, Bimbo, Postobon, Arepas German (nuevo), MD y Colombina.
-- El resto de proveedores tenía el lunes provisional: queda inactivo hasta que el dueño pase sus días.

do $$
declare
  target_store uuid;
begin
  select store_id into target_store from suppliers group by store_id order by count(*) desc limit 1;
  if target_store is null then
    return;
  end if;

  -- Proveedores nuevos (si no existen).
  insert into suppliers (store_id, name, order_weekday, delivery_weekday, visit_frequency, settings_are_estimated)
  select target_store, new_name, 1, 1, 'weekly', false
  from (values ('CENNECA'), ('AREPAS GERMAN')) as incoming(new_name)
  where not exists (select 1 from suppliers where store_id = target_store and upper(name) = new_name);

  -- 1) Las visitas provisionales (lunes para todos) dejan de estar activas.
  update supplier_sellers set is_active = false, updated_at = now()
  where store_id = target_store and seller_name is null and is_active;

  -- 2) Proveedores del lunes: calendario del distribuidor y su visita real (pide y entrega el lunes).
  create temporary table monday_suppliers on commit drop as
  select id as supplier_id
  from suppliers
  where store_id = target_store
    and upper(name) in (
      'RAMO', 'CENNECA', 'COCACOLA DISTRIBUCIONES', 'GUADALUPE ARDICOLL', 'BIMBO DISTRIVENTAS DEL SUR',
      'POSTOBON', 'AREPAS GERMAN', 'MD DISTRIBUCIONES', 'COLOMBINA DISTRIBUCIONES'
    );

  update suppliers
  set order_weekday = 1, delivery_weekday = 1, visit_frequency = 'weekly', biweekly_anchor_date = null,
      settings_are_estimated = false, updated_at = now()
  where id in (select supplier_id from monday_suppliers);

  insert into supplier_sellers (store_id, supplier_id, seller_name, order_weekday, delivery_weekday, visit_frequency, is_active)
  select target_store, supplier_id, null, 1, 1, 'weekly', true
  from monday_suppliers
  where not exists (
    select 1 from supplier_sellers existing
    where existing.supplier_id = monday_suppliers.supplier_id and existing.order_weekday = 1 and existing.is_active
  );
end $$;
