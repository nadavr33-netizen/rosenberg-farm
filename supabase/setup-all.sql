-- Rosenberg Farm: full database setup (schema + example data). Paste all of this into Supabase SQL Editor and click Run.
-- Rosenberg Farm ordering site: database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor, then run seed.sql.
-- Customers never read tables directly: they go through the functions at the bottom.
-- Admins (people listed in public.admins, signed in with an email code) can read and change everything.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.farm_settings (
  id int primary key default 1 check (id = 1),
  name_he text not null default 'משק רוזנברג',
  name_en text not null default 'Rosenberg Farm',
  addr_he text not null default 'מושב שדה ניצן',
  addr_en text not null default 'Moshav Sde Nitzan',
  dealer_no text not null default '',
  contact_phone text not null default '',
  bank_benef_he text not null default '',
  bank_benef_en text not null default '',
  bank_name_he text not null default '',
  bank_name_en text not null default '',
  bank_branch text not null default '',
  bank_account text not null default '',
  transfer_hold_hours int not null default 24 check (transfer_hold_hours between 1 and 168),
  online_payments_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.areas (
  id text primary key default ('a' || substr(md5(random()::text), 1, 8)),
  name_he text not null,
  name_en text not null default '',
  fee numeric(10,2) not null default 0 check (fee >= 0),
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists public.products (
  id text primary key default ('p' || substr(md5(random()::text), 1, 8)),
  cat text not null check (cat in ('mango','avocado','tomato','oil')),
  name_he text not null,
  name_en text not null default '',
  unit_he text not null default '',
  unit_en text not null default '',
  note_he text not null default '',
  note_en text not null default '',
  price numeric(10,2) not null check (price >= 0),
  vat boolean not null default false,
  image_path text,
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists public.distributions (
  id text primary key default ('d' || substr(md5(random()::text), 1, 8)),
  type text not null check (type in ('pickup','delivery')),
  date date not null,
  time_label text not null default '',
  name_he text not null default '',
  name_en text not null default '',
  place_he text not null default '',
  place_en text not null default '',
  phone text not null default '',
  whatsapp text not null default '' check (whatsapp = '' or whatsapp ~ '^https://(chat\.whatsapp\.com|wa\.me)/\S+$'),
  area_ids text[] not null default '{}',
  active boolean not null default true,
  check (type = 'delivery' or name_he <> '')
);

create table if not exists public.stock (
  distribution_id text not null references public.distributions(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  allocated int not null default 0 check (allocated >= 0),
  primary key (distribution_id, product_id)
);

create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('RF-' || nextval('public.order_no_seq')),
  public_token uuid not null default gen_random_uuid(),
  distribution_id text not null references public.distributions(id),
  area_id text references public.areas(id),
  status text not null default 'await' check (status in ('await','paid','closed','cancelled')),
  pay_method text not null check (pay_method in ('bit','paybox','transfer')),
  cust_name text not null,
  cust_phone text not null,
  cust_email text not null,
  address text not null default '',
  city text not null default '',
  notes text not null default '',
  biz_name text not null default '',
  biz_id text not null default '',
  sms_opt_in boolean not null default false,
  lang text not null default 'he' check (lang in ('he','en')),
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  vat_amount numeric(10,2) not null,
  invoice_no text not null default '',
  hold_until timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  closed_at timestamptz
);
create index if not exists orders_distribution_idx on public.orders(distribution_id);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null,
  vat boolean not null,
  name_he text not null,
  name_en text not null,
  unit_he text not null,
  unit_en text not null,
  primary key (order_id, product_id)
);

create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  name text not null default '',
  phone text not null default '',
  is_owner boolean not null default false,
  added_at timestamptz not null default now()
);

-- ---------- Helpers ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Bank-transfer orders not paid in time give their stock back.
create or replace function public.expire_holds() returns void
language sql security definer set search_path = public as $$
  update public.orders set status = 'cancelled'
  where status = 'await' and hold_until is not null and hold_until < now();
$$;

-- Units already taken from a distribution's stock (cancelled orders don't count).
create or replace function public.sold_qty(p_dist text, p_product text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(oi.qty), 0)::int
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.distribution_id = p_dist and oi.product_id = p_product and o.status <> 'cancelled';
$$;

-- ---------- Row-level security ----------

alter table public.farm_settings enable row level security;
alter table public.areas enable row level security;
alter table public.products enable row level security;
alter table public.distributions enable row level security;
alter table public.stock enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['farm_settings','areas','products','distributions','stock','orders','order_items','admins'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- The owner can't be removed or demoted from the site.
create or replace function public.protect_owner() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.is_owner then raise exception 'The owner cannot be removed'; end if;
  if tg_op = 'UPDATE' and old.is_owner and not new.is_owner then raise exception 'The owner cannot be demoted'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists protect_owner on public.admins;
create trigger protect_owner before update or delete on public.admins
for each row execute function public.protect_owner();

-- ---------- Public functions (what customers can call) ----------

-- Everything the shop needs. Stock is sent capped at 20 so exact counts stay private.
create or replace function public.get_catalog() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'farm', (select jsonb_build_object(
        'name_he', name_he, 'name_en', name_en, 'addr_he', addr_he, 'addr_en', addr_en,
        'contact_phone', contact_phone, 'dealer_no', dealer_no,
        'bank_benef_he', bank_benef_he, 'bank_benef_en', bank_benef_en,
        'bank_name_he', bank_name_he, 'bank_name_en', bank_name_en,
        'bank_branch', bank_branch, 'bank_account', bank_account,
        'transfer_hold_hours', transfer_hold_hours,
        'online_payments_enabled', online_payments_enabled)
      from public.farm_settings where id = 1),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_he', name_he, 'name_en', name_en, 'fee', fee) order by sort, name_he)
      from public.areas where active), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'cat', cat, 'name_he', name_he, 'name_en', name_en, 'unit_he', unit_he, 'unit_en', unit_en,
        'note_he', note_he, 'note_en', note_en, 'price', price, 'vat', vat, 'image_path', image_path) order by sort, name_he)
      from public.products where active), '[]'::jsonb),
    'distributions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'type', d.type, 'date', d.date, 'time_label', d.time_label,
        'name_he', d.name_he, 'name_en', d.name_en, 'place_he', d.place_he, 'place_en', d.place_en,
        'phone', d.phone, 'area_ids', d.area_ids,
        'avail', coalesce((select jsonb_object_agg(s.product_id,
                   least(20, greatest(0, s.allocated - public.sold_qty(d.id, s.product_id))))
                 from public.stock s join public.products p on p.id = s.product_id and p.active
                 where s.distribution_id = d.id and s.allocated > 0), '{}'::jsonb)
      ) order by d.date, d.time_label)
      from public.distributions d
      where d.active and d.date >= (now() at time zone 'Asia/Jerusalem')::date), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Place an order. Prices, fees and stock are checked here, never trusted from the browser.
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.distributions;
  fs public.farm_settings;
  a public.areas;
  v_pay text := payload ->> 'pay_method';
  v_area text := nullif(payload ->> 'area_id', '');
  v_order public.orders;
  item record;
  p public.products;
  v_left int;
  v_sub numeric := 0;
  v_taxable numeric := 0;
  v_fee numeric := 0;
  v_count int := 0;
begin
  perform public.expire_holds();
  select * into fs from public.farm_settings where id = 1;

  if v_pay not in ('bit','paybox','transfer') then raise exception 'bad_payment_method'; end if;
  if v_pay in ('bit','paybox') and not fs.online_payments_enabled then raise exception 'payment_method_unavailable'; end if;

  -- Lock the distribution so two orders can't take the same last box.
  select * into d from public.distributions where id = payload ->> 'distribution_id' and active for update;
  if not found or d.date < (now() at time zone 'Asia/Jerusalem')::date then raise exception 'distribution_unavailable'; end if;

  if d.type = 'delivery' then
    select * into a from public.areas where id = v_area and active;
    if not found or not (v_area = any(d.area_ids)) then raise exception 'area_unavailable'; end if;
    v_fee := a.fee;
    if coalesce(trim(payload #>> '{customer,address}'), '') = '' or coalesce(trim(payload #>> '{customer,city}'), '') = '' then
      raise exception 'address_required';
    end if;
  else
    v_area := null;
  end if;

  if coalesce(trim(payload #>> '{customer,name}'), '') = '' or coalesce(trim(payload #>> '{customer,phone}'), '') = ''
     or coalesce(trim(payload #>> '{customer,email}'), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'details_required';
  end if;

  insert into public.orders (distribution_id, area_id, status, pay_method,
    cust_name, cust_phone, cust_email, address, city, notes, biz_name, biz_id, sms_opt_in, lang,
    subtotal, delivery_fee, total, vat_amount, hold_until)
  values (d.id, v_area, 'await', v_pay,
    left(trim(payload #>> '{customer,name}'), 120), left(trim(payload #>> '{customer,phone}'), 40),
    lower(left(trim(payload #>> '{customer,email}'), 160)),
    left(coalesce(trim(payload #>> '{customer,address}'), ''), 200), left(coalesce(trim(payload #>> '{customer,city}'), ''), 80),
    left(coalesce(payload #>> '{customer,notes}', ''), 500),
    left(coalesce(trim(payload #>> '{customer,biz_name}'), ''), 120), left(coalesce(trim(payload #>> '{customer,biz_id}'), ''), 20),
    coalesce((payload #>> '{customer,sms_opt_in}')::boolean, false),
    case when payload ->> 'lang' = 'en' then 'en' else 'he' end,
    0, 0, 0, 0, now() + make_interval(hours => fs.transfer_hold_hours))
  returning * into v_order;

  for item in select key as product_id, (value #>> '{}')::int as qty from jsonb_each(payload -> 'items') loop
    continue when item.qty is null or item.qty <= 0;
    select * into p from public.products where id = item.product_id and active;
    if not found then raise exception 'product_unavailable:%', item.product_id; end if;
    select greatest(0, coalesce(s.allocated, 0) - public.sold_qty(d.id, p.id)) into v_left
      from public.stock s where s.distribution_id = d.id and s.product_id = p.id;
    if coalesce(v_left, 0) < item.qty then raise exception 'out_of_stock:%', p.id; end if;
    insert into public.order_items (order_id, product_id, qty, unit_price, vat, name_he, name_en, unit_he, unit_en)
      values (v_order.id, p.id, item.qty, p.price, p.vat, p.name_he, p.name_en, p.unit_he, p.unit_en);
    v_sub := v_sub + p.price * item.qty;
    if p.vat then v_taxable := v_taxable + p.price * item.qty; end if;
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'empty_order'; end if;

  v_taxable := v_taxable + v_fee;
  update public.orders set
    subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee,
    vat_amount = round(v_taxable - v_taxable / 1.18, 2),
    hold_until = case when v_pay = 'transfer' then hold_until else now() + interval '30 minutes' end
  where id = v_order.id returning * into v_order;

  return jsonb_build_object('order_no', v_order.order_no, 'token', v_order.public_token);
end $$;

-- A customer's own order, for the confirmation page (needs the private token from the order link).
create or replace function public.get_order(p_order_no text, p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'pay_method', o.pay_method, 'lang', o.lang,
    'cust_name', o.cust_name, 'address', o.address, 'city', o.city,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total, 'vat_amount', o.vat_amount,
    'invoice_no', o.invoice_no, 'hold_until', o.hold_until, 'created_at', o.created_at,
    'area', (select jsonb_build_object('name_he', name_he, 'name_en', name_en) from public.areas where id = o.area_id),
    'distribution', (select jsonb_build_object('type', type, 'date', date, 'time_label', time_label,
        'name_he', name_he, 'name_en', name_en, 'place_he', place_he, 'place_en', place_en,
        'phone', phone, 'whatsapp', whatsapp) from public.distributions where id = o.distribution_id),
    'items', (select jsonb_agg(jsonb_build_object('qty', qty, 'unit_price', unit_price, 'vat', vat,
        'name_he', name_he, 'name_en', name_en, 'unit_he', unit_he, 'unit_en', unit_en) order by name_he)
      from public.order_items where order_id = o.id)
  )
  from public.orders o where o.order_no = p_order_no and o.public_token = p_token;
$$;

revoke all on function public.place_order(jsonb) from public;
revoke all on function public.get_order(text, uuid) from public;
revoke all on function public.get_catalog() from public;
revoke all on function public.expire_holds() from public;
revoke all on function public.sold_qty(text, text) from public;
grant execute on function public.get_catalog() to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.get_order(text, uuid) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.expire_holds() to authenticated;
grant execute on function public.sold_qty(text, text) to authenticated;

-- ---------- Product photos ----------

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images admin write" on storage.objects;
create policy "product images admin write" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

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
