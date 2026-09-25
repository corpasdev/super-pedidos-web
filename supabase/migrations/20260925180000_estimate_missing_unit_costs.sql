-- Costo estimado para los productos que quedaron en $0 al importar el catálogo (R8, regla del dueño):
-- el precio de venta es el costo + 30 % en dulcería y + 20 % en el resto → costo = precio ÷ 1,30 o ÷ 1,20.
-- Solo toca costos en $0 que no escribió el dueño; los que vienen del Excel o del dueño se respetan.
-- Misma regla que estimateUnitCost() en packages/order-agent/src/formulas/estimatedCost.ts.

update product_settings as settings
set unit_cost = round(
      products.sale_price / case
        when translate(lower(products.category), 'í', 'i') like '%dulceri%' then 1.30
        else 1.20
      end
    )::integer,
    cost_source = 'estimated',
    is_estimated = true,
    updated_at = now()
from products
where products.id = settings.product_id
  and settings.unit_cost = 0
  and settings.cost_source <> 'owner'
  and products.sale_price > 0;
