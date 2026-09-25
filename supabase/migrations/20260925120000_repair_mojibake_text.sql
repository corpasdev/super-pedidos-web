-- Repara textos importados con la codificación dañada: UTF-8 leído como Windows-1252.
-- Caso real: "ALVARO MU�'OZ" → "ALVARO MUÑOZ", "HELADO PI�'A" → "HELADO PIÑA".
--
-- Una letra acentuada en UTF-8 son dos bytes C3 xx. Leída como Windows-1252 quedó como
-- "Ã" (o "�", U+FFFD) + el carácter del byte xx. La letra original es U+00C0 + (xx − 0x80) = xx + 0x40.
-- Misma regla que repairMojibake() en packages/order-agent/src/text/repairMojibake.ts (la API la aplica al importar).

create or replace function public.repair_mojibake(input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text := input;
  pair record;
  byte integer;
begin
  if input is null or (position(chr(65533) in input) = 0 and position(chr(195) in input) = 0) then
    return input;
  end if;

  -- Bytes 0x80–0x9F: en Windows-1252 son estos caracteres. El apóstrofo simple es "‘" (0x91) normalizado a ASCII.
  for pair in
    select * from (values
      ('''', 145), ('‘', 145), ('’', 146), ('“', 147), ('”', 148), ('€', 128), ('‚', 130), ('ƒ', 131),
      ('„', 132), ('…', 133), ('†', 134), ('‡', 135), ('ˆ', 136), ('‰', 137), ('Š', 138), ('‹', 139),
      ('Œ', 140), ('Ž', 142), ('•', 149), ('–', 150), ('—', 151), ('˜', 152), ('™', 153), ('š', 154),
      ('›', 155), ('œ', 156), ('ž', 158), ('Ÿ', 159)
    ) as mapping(broken, continuation_byte)
  loop
    result := replace(result, chr(65533) || pair.broken, chr(pair.continuation_byte + 64));
    result := replace(result, chr(195) || pair.broken, chr(pair.continuation_byte + 64));
  end loop;

  -- Bytes 0xA0–0xBF: coinciden con Latin-1 (± → ñ, ¡ → á, © → é, ³ → ó, º → ú…).
  for byte in 160..191 loop
    result := replace(result, chr(65533) || chr(byte), chr(byte + 64));
    result := replace(result, chr(195) || chr(byte), chr(byte + 64));
  end loop;

  return result;
end;
$$;

update public.suppliers set name = public.repair_mojibake(name) where name is distinct from public.repair_mojibake(name);
update public.brands set name = public.repair_mojibake(name) where name is distinct from public.repair_mojibake(name);
update public.products
  set name = public.repair_mojibake(name),
      category = public.repair_mojibake(category),
      reference = public.repair_mojibake(reference)
  where name is distinct from public.repair_mojibake(name)
     or category is distinct from public.repair_mojibake(category)
     or reference is distinct from public.repair_mojibake(reference);
update public.sales_report_lines
  set product_name = public.repair_mojibake(product_name),
      category = public.repair_mojibake(category)
  where product_name is distinct from public.repair_mojibake(product_name)
     or category is distinct from public.repair_mojibake(category);
update public.data_quality_issues
  set description = public.repair_mojibake(description),
      original_value = public.repair_mojibake(original_value)
  where description is distinct from public.repair_mojibake(description)
     or original_value is distinct from public.repair_mojibake(original_value);
update public.stores
  set name = public.repair_mojibake(name),
      admin_name = public.repair_mojibake(admin_name)
  where name is distinct from public.repair_mojibake(name)
     or admin_name is distinct from public.repair_mojibake(admin_name);
