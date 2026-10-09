# RentLens

RentLens is a mobile-friendly landlord dashboard for rent collection, tenant balances, partial payments, payment promises, printable e-receipts and WhatsApp reminders.

## Included

- Supabase email/password authentication
- Multiple properties and tenants
- Automatic monthly rent charges
- Partial payment allocation against the oldest balance
- Tenant payment history and immutable receipt numbers
- Printable e-receipts
- Payment promises with scheduled reminders
- WhatsApp reminder and receipt templates
- Sent, delivered, read and failed message states through Meta webhooks
- Row Level Security so each landlord only sees their records
- Responsive desktop and mobile interface

## 1. Supabase setup

1. Create a new Supabase project for RentLens.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it once.
3. Open **Project Settings → API**.
4. Copy the Project URL and Publishable key.
5. Copy `.env.example` to `.env.local` and add those values.
6. Keep the Service Role key server-side only. Never put it in a variable beginning with `NEXT_PUBLIC_`.

## 2. Local setup

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Until Supabase is configured, use **Preview with sample data** to inspect the complete interface.

## 3. WhatsApp setup

Use the official Meta WhatsApp Business Platform and create these approved utility templates:

- `rent_due_reminder`: tenant name, balance, due date
- `rent_overdue_reminder`: tenant name, balance, due date
- `payment_promise_reminder`: tenant name, promised date
- `rent_payment_receipt`: tenant name, amount, receipt number, plus a URL button ending in `{{1}}`

Set the webhook URL to:

`https://YOUR-DOMAIN.vercel.app/api/whatsapp/webhook`

Subscribe to message status events and use the same value for `WHATSAPP_VERIFY_TOKEN` in Meta and Vercel.

## 4. Vercel deployment

1. Push this `rentlens` folder to a GitHub repository.
2. Import the repository in Vercel as a Next.js project.
3. Add every key from `.env.example` under **Project Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_APP_URL` to the production Vercel URL.
5. Deploy.
6. Add the production URL under Supabase **Authentication → URL Configuration** as the Site URL and add `/auth/callback` as a redirect URL.

The included `vercel.json` runs the reminder job daily at 6:00 UTC (9:00 AM Kampala time). Vercel automatically supplies the cron authorization header when `CRON_SECRET` is configured.

## Receipt integrity

Payments should never be edited after a receipt is issued. A later version should expose a dedicated void-and-reissue workflow using the existing `voided_at` and `void_reason` fields.
