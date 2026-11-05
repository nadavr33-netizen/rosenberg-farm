-- Starting data. EVERYTHING BELOW IS EXAMPLE DATA except the farm name, location and product types:
-- change prices, distribution points, dates, stock and bank details in the site's admin area (Settings).
-- Run once, after schema.sql.

insert into public.farm_settings (id, name_he, name_en, addr_he, addr_en, dealer_no,
  bank_benef_he, bank_benef_en, bank_name_he, bank_name_en, bank_branch, bank_account)
values (1, 'משק רוזנברג', 'Rosenberg Farm', 'מושב שדה ניצן', 'Moshav Sde Nitzan', '000000000',
  'משק רוזנברג', 'Rosenberg Farm', 'בנק לדוגמה', 'Example Bank', '000', '000000')
on conflict (id) do nothing;

-- The owner. Sign in to /admin with this email address.
insert into public.admins (email, name, is_owner) values ('nadavr33@gmail.com', 'Owner', true)
on conflict (email) do nothing;

insert into public.areas (id, name_he, name_en, fee, sort) values
  ('center', 'תל אביב וגוש דן', 'Tel Aviv & Gush Dan', 35, 1),
  ('sharon', 'השרון', 'Sharon', 40, 2),
  ('shfela', 'השפלה', 'Shfela', 35, 3),
  ('south', 'באר שבע והנגב', 'Be''er Sheva & Negev', 25, 4)
on conflict (id) do nothing;

insert into public.products (id, cat, name_he, name_en, unit_he, unit_en, note_he, note_en, price, vat, sort) values
  ('keitt5', 'mango', 'מנגו קיט', 'Keitt mango', 'ארגז 5 ק״ג', '5 kg box', 'סוף העונה, הבשלה על העץ', 'End of season, ripened on the tree', 90, false, 1),
  ('keitt25', 'mango', 'מנגו קיט', 'Keitt mango', 'מארז 2.5 ק״ג', '2.5 kg pack', 'מארז קטן לבית קטן', 'Smaller pack for a small household', 50, false, 2),
  ('ettinger', 'avocado', 'אבוקדו אטינגר', 'Ettinger avocado', 'ארגז 4 ק״ג', '4 kg box', 'הזן הראשון של העונה', 'First variety of the season', 55, false, 3),
  ('hass', 'avocado', 'אבוקדו האס', 'Hass avocado', 'ארגז 4 ק״ג', '4 kg box', 'קטיף ראשון של העונה', 'First pick of the season', 70, false, 4),
  ('cherry2', 'tomato', 'עגבניות שרי', 'Cherry tomatoes', 'סלסלה 2 ק״ג', '2 kg basket', 'מהחממות של המשק', 'From our greenhouses', 38, false, 5),
  ('cherry4', 'tomato', 'עגבניות שרי', 'Cherry tomatoes', 'ארגז 4 ק״ג', '4 kg box', 'נקטפות יום לפני החלוקה', 'Picked the day before distribution', 65, false, 6),
  ('oil2', 'oil', 'שמן זית ברנע–פישולין', 'Barnea–Picholine olive oil', 'פח 2 ליטר', '2 litre tin', 'מסיק ידני מהכרם שלנו, בציר 2026', 'Hand-picked from our grove, 2026 harvest', 150, true, 7),
  ('oil5', 'oil', 'שמן זית ברנע–פישולין', 'Barnea–Picholine olive oil', 'פח 5 ליטר', '5 litre tin', 'מסיק ידני, בציר 2026, למלאי של כל השנה', 'Hand-picked, 2026 harvest, stock for the year', 340, true, 8)
on conflict (id) do nothing;

-- Example distributions, dated from today so they show up right away.
insert into public.distributions (id, type, date, time_label, name_he, name_en, place_he, place_en, area_ids) values
  ('tlv', 'pickup', current_date + 7, '08:00–11:00', 'תל אביב', 'Tel Aviv', 'פארק הירקון, כניסת רוקח', 'Hayarkon Park, Rokach entrance', '{}'),
  ('bs', 'pickup', current_date + 7, '13:00–15:00', 'באר שבע', 'Be''er Sheva', 'חניון פארק נחל באר שבע', 'Be''er Sheva River Park, parking lot', '{}'),
  ('farm', 'pickup', current_date + 14, '09:00–13:00', 'שדה ניצן', 'Sde Nitzan', 'בבית האריזה במשק', 'At the farm packing house', '{}'),
  ('del1', 'delivery', current_date + 6, '10:00–18:00', '', '', '', '', '{center,sharon}'),
  ('del2', 'delivery', current_date + 13, '10:00–18:00', '', '', '', '', '{south,shfela}')
on conflict (id) do nothing;

insert into public.stock (distribution_id, product_id, allocated)
select d, p, q from (values
  ('tlv','keitt5',40),('tlv','keitt25',30),('tlv','ettinger',50),('tlv','cherry2',40),('tlv','cherry4',30),('tlv','oil2',40),('tlv','oil5',10),
  ('bs','keitt5',25),('bs','ettinger',30),('bs','cherry2',25),('bs','oil2',25),('bs','oil5',6),
  ('farm','keitt5',30),('farm','ettinger',30),('farm','hass',40),('farm','cherry2',30),('farm','cherry4',30),('farm','oil2',50),('farm','oil5',15),
  ('del1','keitt5',30),('del1','keitt25',20),('del1','ettinger',30),('del1','cherry2',25),('del1','oil2',30),('del1','oil5',8),
  ('del2','keitt5',20),('del2','ettinger',25),('del2','hass',20),('del2','cherry2',20),('del2','oil2',20),('del2','oil5',6)
) as v(d, p, q)
on conflict do nothing;
