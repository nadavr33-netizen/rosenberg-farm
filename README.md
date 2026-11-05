# Rosenberg Farm ordering site

Pre-order site for משק רוזנברג (Moshav Sde Nitzan): customers order mango, avocado, cherry tomatoes and olive oil for a distribution point or home delivery and pay by bank transfer (Bit and PayBox coming). A few admins manage distributions, stock, orders and settings at `/admin`.

- **Put it online:** [SETUP.md](SETUP.md)
- **Stack:** Next.js 15 (App Router) · Supabase (Postgres, email-code sign-in, photo storage) · Vercel
- **Database:** `supabase/schema.sql` (tables, security rules, ordering functions) and `supabase/seed.sql` (example data)

## Where things are

| Path | What |
| --- | --- |
| `src/components/Shop.tsx` | Customer flow: welcome → produce → delivery + details → payment |
| `src/components/OrderPage.tsx` | Order confirmation and transfer details (`/order/RF-1234?t=…`) |
| `src/components/admin/` | Admin sign-in, orders & distributions, CSV export, settings, admins |
| `src/lib/i18n.ts` | All Hebrew and English text |
| `supabase/schema.sql` | `place_order` checks stock and prices on the server; customers never read tables directly |

## Run locally

```
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev
```
