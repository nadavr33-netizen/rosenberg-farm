# Rosenberg Farm ordering site

See README.md for the layout and SETUP.md for deployment. Product spec and decisions: Hebrew RTL first with English; payment only Bit, PayBox, bank transfer; stock counts never shown to customers; each customer step about one phone screen.

- All customer writes go through the `place_order` SQL function; keep price, fee and stock checks there.
- Admin access = row in `public.admins` + Supabase email-code sign-in; RLS policies use `public.is_admin()`.
- Next steps planned: Grow payment connection (Bit/PayBox + webhook marking orders paid), automatic invoices (Morning/iCount API), SMS/email notifications.
- Ask the owner before signing up for any paid service.
