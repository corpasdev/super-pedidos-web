# Pendientes

Estado entre tareas. Cada sesión arranca con la ventana limpia: leer esto al empezar y actualizarlo al terminar.

## Esperando al dueño
- Calendario de martes a sábado de los 43 proveedores inactivos (solo está cargado el lunes: 9 proveedores). Se carga con migración, no desde la web.
- Niveles B, PD y T de cada producto. Mientras falten, el motor repone lo movido (CM).
- Volver a subir el Excel de ventas (se quitó). Sin él no hay sugeridos.

## Técnico
- 73 archivos sin commit desde `67d9887` (commit inicial). Commit y push solo cuando el usuario lo pida.
- Si la API responde 404 en rutas nuevas, reiniciar con `npm run dev:api`.

## Última tarea hecha
- Bandeja de Sugeridos: los proveedores salen en una grilla de cards (tantas por fila como quepan, ~260px mínimo cada una) con nombre, entrega, estado, productos y total. Al tocar una card, el pedido se edita y se confirma en un panel lateral. Ya no se abre ninguno solo. Falta revisarla en el navegador.
- Tile «Caja»: siempre muestra el número ($0 sin caja). El lápiz lo vuelve editable en el mismo lugar, sin bordes y sin botón de guardar (Enter o salir del campo guarda, Esc cancela). Falta revisarlo en el navegador.
- Cards de proveedores (`VendorCard.vue`): solo tres datos, el proveedor en grande, el total del sugerido y el vendedor («—» si no está registrado). Las etiquetas siguen en el panel del pedido.
- Sin tags de días: arriba de las cards solo va la fecha de hoy («miércoles, 30 de septiembre»). La bandeja muestra siempre el día actual y se recarga sola al pasar la medianoche.
- «Le debes» muestra solo los proveedores que vienen hoy y a los que se les debe plata (filtro en la vista sobre `inbox.debts`).
- Se quitó el tile de resumen (vienen, por confirmar, sugerido). El Excel ocupa ese espacio y el botón de actualizar quedó junto a la fecha.
- Se quitó el recuadro «Llegan hoy» de Sugeridos. Los pedidos que entregan otro día quedan pendientes de recibir sin botón en la web (la API `receive` y la store siguen). Decidir con el dueño cómo marcarlos recibidos.
- Distribución de Sugeridos: arriba Caja, Excel de ventas y Le debes en una fila; debajo, a todo el ancho, la fecha y la grilla de cards.
- Bento en Sugeridos: «Le debes» a la derecha ocupa las dos filas (crece hacia abajo junto a la grilla de proveedores). Contenedor con grilla de Tailwind porque n-grid no admite celdas de varias filas.
- Mock de Sugeridos en `data/mock/` (Excel de ventas con el formato del modelo + respuestas de la API por proveedor). Se regenera con `node data/mock/generar.mjs [AAAA-MM-DD]`. No está conectado a la web.
- Niveles iniciales B/PD/T cargados en Supabase para los 3.752 productos (migración `20260930120000_product_levels_minisuper.sql`): por categoría, precio y rotación del Excel del 16 al 23 de sept. El dueño puede ajustarlos.
- Mock alineado con Supabase y conectado a la web: abrir con `?mock` (ver `data/mock/README.md`). Falta revisarlo en el navegador.
- «Productos» visible en el menú. Es una sola tabla con todos los productos; el proveedor es solo una columna (se quitó el filtro por proveedor).
- Productos es el registro actual: columnas producto, proveedor, unidades actuales, precio de venta, base y tope. Se quitaron «Unidades por compra» (packSize, ya no se edita en la web) y «Punto de pedido». Ninguna existencia está contada aún (977 con unidades > 0 vienen del catálogo importado).
- Productos: precio de compra y de venta editables en la tabla (autoguardado). La API acepta `salePrice` en PATCH /products/:id/settings y guarda `sale_price`. Hay que reiniciar la API (`npm run dev:api`) para usarlo.
- «Proveedores» visible en el menú, sin columna «Acciones» (se quitó el botón «Hacer pedido» que llevaba al asistente viejo).
- Botones «Crear producto» y «Crear proveedor» con formulario (POST /products y POST /suppliers, `CatalogEntryService`). El proveedor nuevo no tiene calendario: no sale en Sugeridos hasta cargarle sus días. Reiniciar la API.
- Crear proveedor pide todos los datos de la tabla (NIT, correo, días de pedido y entrega, frecuencia, mínimo, tope) y crea su visita en supplier_sellers, así sale en Sugeridos.
- Tabla de Proveedores sin «Próxima visita» ni «Último pedido» (ocultas por ahora).
- «Vencidos para cambio» en Sugeridos (columna derecha, bajo Le debes): tabla expired_exchanges (migración 20261001120000), API /expired-exchanges. Reiniciar la API.
