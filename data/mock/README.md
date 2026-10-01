# Mock de la vista Sugeridos

Datos de prueba que simulan un lunes en la tienda: los 9 proveedores del calendario real del lunes, la caja del día, las deudas y el sugerido de cada proveedor.

Los productos, su proveedor, precios, costos y niveles B/PD/T son los de Supabase (`productos-supabase.json`). La rotación parte del Excel modelo `data/ventas-16-al-23-sept.xlsx`. Las ventas de la semana, los vendedores, la caja y las deudas son inventados.

## Verlo en la web

Abre la web con `?mock` al final de la dirección, por ejemplo `http://localhost:5173/?mock`. Arriba sale el aviso «Datos de prueba». El modo se recuerda en esa pestaña; `?mock=0` lo apaga. También se puede dejar fijo con `VITE_MOCK=1` en `apps/web/.env`.

En modo de prueba la vista lee estos JSON en lugar de la API. Confirmar un pedido o cambiar la caja solo cambia la memoria de la página (se pierde al recargar) y nada llega a Supabase. Subir o quitar el Excel no funciona en este modo. Las demás vistas siguen leyendo la API real, pero no pueden guardar.

## Archivos

| Archivo | Qué es |
|---|---|
| `ventas-mock.xlsx` | Excel de ventas con el mismo formato que el modelo (hoja «Informe», 18 columnas, todo como texto). Cubre los 7 días anteriores a hoy. Se puede subir en el recuadro «Excel de ventas». |
| `productos-supabase.json` | Copia de los productos de los proveedores del lunes en Supabase, con sus niveles B/PD/T. |
| `catalogo-niveles.json` | Los productos que entran al mock (hasta 10 por proveedor, los que más rotan), con niveles y CM (vendido en la semana). |
| `api/inbox-today.json` | Respuesta de `GET /inbox/today`: caja, proveedores del día con el total de su sugerido y deudas. |
| `api/inbox-days.json` | Respuesta de `GET /inbox/days`. |
| `api/daily-cash-today.json` | Respuesta de `GET /daily-cash/today`. |
| `api/sales-report-latest.json` | Respuesta de `GET /sales-reports/latest`. |
| `api/suggestions/<proveedor>.json` | Respuesta de `POST` del sugerido de cada proveedor (lo que se ve en el panel al tocar una card). |

## Qué casos cubre

- **Caja:** $450.000 al abrir, $133.400 ya pedidos y $316.600 restantes. Cada pedido tiene hasta $250.000.
- **Plata justa:** Postobon y Coca-Cola necesitan más de $250.000, así que cubren la base y suben hacia el tope hasta donde alcanza (`between_base_and_tope`).
- **Plata suficiente:** Ramo, Bimbo, Guadalupe, Cenneca y Colombina llegan al tope.
- **Cenneca y Arepas German** todavía no tienen productos asignados en Supabase; el mock les asigna unos a mano.
- **Pedido ya hecho hoy:** MD (recibido y pagado) y Arepas German (recibido, debe $18.000).
- **Semáforo:** la venta de la semana de cada producto varía entre 0,6 y 1,9 veces su rotación normal, así que unos quedan sobre la base y otros por debajo (urgentes).
- **Le debes:** Postobon ($120.000) y Arepas German ($18.000) vienen hoy. ALPINA ($45.000) no viene hoy y la vista debe ocultarla.
- **Vendedor:** Ramo y Cenneca no tienen nombre de vendedor, para ver el «—» en la card.
- **Entrega:** Coca-Cola y Ramo entregan el martes; Guadalupe, Postobon y Cenneca el miércoles; Bimbo el jueves; los demás el mismo día.

## Regenerar

El sugerido se calcula con el motor real (`planSuggestion` de `packages/order-agent`), así que los números siguen las reglas actuales.

```sh
npm run build --workspace packages/order-agent   # si cambió el motor
# si cambiaron los niveles en Supabase, volver a exportar productos-supabase.json (ver abajo)
node data/mock/generar.mjs                       # hoy = próximo lunes
node data/mock/generar.mjs 2026-10-05            # hoy = esa fecha (debería ser lunes)
```

El resultado es siempre el mismo para la misma fecha, porque se usa una semilla fija.

## Ojo al subir el Excel

`ventas-mock.xlsx` usa códigos de barras reales del catálogo, así que al subirlo se cruza con los productos de la base de datos de verdad. El análisis por la API no se probó; con el parser real (`SalesExcelParser`) sí se leyó bien. Las ventas quedan guardadas: si después hay que quitarlas, se usa «Quitar» en el recuadro del Excel.

## Volver a exportar los productos de Supabase

```sh
supabase db query --linked --output-format json "select s.name as supplier_name, p.barcode, p.name, p.category, p.sale_price, ps.unit_cost, ps.pack_size, ps.min_stock_units as base, ps.reorder_point_units as reorder_point, ps.max_stock_units as tope from products p join product_settings ps on ps.product_id = p.id join suppliers s on s.id = p.supplier_id where upper(s.name) in ('RAMO','COCACOLA DISTRIBUCIONES','GUADALUPE ARDICOLL','BIMBO DISTRIVENTAS DEL SUR','POSTOBON','MD DISTRIBUCIONES','COLOMBINA DISTRIBUCIONES') or p.barcode in ('7702001047161','7702001047178','7702001171057','67','37','161') order by s.name, p.name"
```

La salida trae las filas en `rows`; se guardan en `productos-supabase.json` dentro de `products`.
