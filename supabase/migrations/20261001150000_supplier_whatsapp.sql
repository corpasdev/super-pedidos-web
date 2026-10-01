-- Número de WhatsApp (o teléfono) del proveedor, para poder enviarle el pedido (1-oct-2026).
alter table suppliers
  add column whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+?[0-9 -]{7,20}$');

comment on column suppliers.whatsapp_number is 'WhatsApp o teléfono del proveedor (con indicativo si se conoce, ej. +57 300 123 4567).';
