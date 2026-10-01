# Ventas de prueba

`ventas-mock.xlsx` es un Excel de ventas de prueba con el mismo formato que exporta el software de la tienda (hoja «Informe», 18 columnas, todo como texto). Sirve para probar el sugerido con la API y el agente reales: se carga como cualquier Excel de ventas y el agente calcula los pedidos con los productos, proveedores y niveles de Supabase.

## De dónde salen los datos

Solo de las tablas de Supabase:
- **Proveedores:** los que tienen una visita activa (`supplier_sellers`).
- **Productos:** los de esos proveedores (`products`), con su precio de venta.
- **Costo y niveles:** `product_settings`. Sin precio de compra se usa el estimado del dueño: precio de venta ÷ 1,30 en dulcería y ÷ 1,20 en lo demás.

Lo único inventado son las cantidades vendidas. Salen de los niveles de cada producto: el 70 % de los productos se vende en la semana, y cada uno vende entre 0,3 y 1,9 veces lo que cabe entre su base y su punto de pedido. Así unos quedan sobre la base y otros por debajo (urgentes). La misma fecha da siempre el mismo Excel.

## Generarlo y cargarlo

```sh
npm run mock:ventas --workspace apps/api                          # ventas de los 7 días hasta ayer
npm run mock:ventas --workspace apps/api -- --hasta 2026-09-30    # hasta esa fecha
npm run mock:ventas --workspace apps/api -- --cargar              # genera y lo carga, igual que subirlo en la web
```

También se puede subir `ventas-mock.xlsx` a mano en el recuadro «Excel de ventas» de Sugeridos. Para quitarlo se usa «Quitar» en ese mismo recuadro.

## Ojo

- Las ventas quedan guardadas en la base real (`sales_reports` y `sales_daily`), como cualquier Excel subido.
- Sugeridos muestra solo a los proveedores que vienen **hoy**. Por ahora solo está cargado el calendario del lunes, así que los sugeridos se ven los lunes.
