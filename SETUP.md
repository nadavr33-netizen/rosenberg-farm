# Putting the Rosenberg Farm site online

About 30 minutes, all free to start. You need three accounts: **GitHub** (keeps the code), **Supabase** (keeps orders and settings), **Vercel** (puts the site on the internet).

## 1. GitHub: where the code lives

1. Create an account at https://github.com (free).
2. Create a new **private** repository named `rosenberg-farm`. Leave it empty (no README).
3. In Claude, connect GitHub (claude.ai → Settings → Connectors → GitHub) and give it access to that repository.
4. Tell Claude it's done; Claude uploads the code.

## 2. Supabase: the database

1. Create an account at https://supabase.com and click **New project**.
   - Name: `rosenberg-farm`. Region: **Central EU (Frankfurt)**, the closest to Israel. Choose a strong database password and keep it somewhere safe.
2. When the project is ready, open **SQL Editor → New query**. Paste all of `supabase/schema.sql`, click **Run**. Then do the same with `supabase/seed.sql`.
   - `seed.sql` adds example products, points and stock so you can try the site, and makes **nadavr33@gmail.com** the owner. Change the email in that file first if you want a different one.
3. Sign-in emails: open **Authentication → Emails**. In both **Confirm signup** and **Magic Link**, replace the message body with:
   ```
   <h2>כניסה לניהול משק רוזנברג</h2>
   <p>הקוד שלכם: <b>{{ .Token }}</b></p>
   <p>או לחצו כאן: <a href="{{ .ConfirmationURL }}">כניסה</a></p>
   ```
4. Open **Project Settings → API** and copy two values for step 3: the **Project URL** and the **anon public** key.

## 3. Vercel: put the site online

1. Create an account at https://vercel.com with **Continue with GitHub**.
2. Click **Add New → Project**, pick the `rosenberg-farm` repository, then open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
3. Click **Deploy**. After about two minutes you get an address like `rosenberg-farm.vercel.app`.
4. Back in Supabase, **Authentication → URL Configuration**: set **Site URL** to that address, and add `https://YOUR-ADDRESS/admin` under **Redirect URLs**.

## 4. First sign-in

1. Open `https://YOUR-ADDRESS/admin`, enter the owner email, and type the code from the email.
2. In **Settings**, replace the example data: farm details and bank account, products and prices (add photos), distribution points with dates, contact phone and WhatsApp link, delivery areas and days.
3. In **Orders & distributions**, choose each distribution and set how many of each product it gets.
4. Place a test order on the site, confirm it in admin, then cancel it.

## Good to know

- **Payments**: customers pay by bank transfer, and you confirm each transfer in admin. Bit and PayBox show as "coming soon" until a payment company (for example Grow) is connected; that is the next development step.
- **Invoices**: issue them for now in your invoicing service (for example Morning) and type the invoice number into the order in admin. Connecting an invoicing service so it happens automatically is a later step.
- **Unpaid transfers**: an order not marked paid within the hold time (24 hours by default, changeable in Settings) is cancelled automatically and its stock goes back on sale.
- **Free plans**: a free Supabase project pauses after a week with no activity; open the site or admin once a week, or move to the paid plan (about $25 a month) when you go live properly. Supabase's built-in email sends only a few sign-in emails an hour, which is fine for a handful of admins.
- **Own domain**: buy one (for example `rosenberg-farm.co.il`) and add it in Vercel → Project → Domains; then update the Site URL in Supabase.
- **Legal pages**: `/terms` and `/privacy` are a starting draft. Have a lawyer review them before a wide launch.
