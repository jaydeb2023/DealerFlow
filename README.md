# DealerFlow AI by Evynta

Dealer, distributor and wholesale management SaaS: dealer ordering portal, orders, inventory (no overselling), dispatch, invoices, partial payments, credit limits, sales team tracking, reports and an AI assistant. Multi-company: each business signs up and gets its own isolated data.

Stack: Next.js 14 (App Router), TypeScript, Tailwind, Supabase (Postgres, Auth, Storage), Vercel.

## 1. Set up Supabase
1. Create a Supabase project.
2. SQL Editor: paste and run `supabase/migrations/001_dealerflow.sql` (safe to re-run).
3. Authentication > Providers: Email enabled. For quick testing, turn off "Confirm email".
4. Copy the Project URL, anon key and service-role key (Settings > API).

## 2. Environment variables (Vercel > Settings > Environment Variables)
See `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. https://dealerflow.evynta.in)
- `RV_SUPER_ADMIN_EMAILS` (your email, comma-separated): unlocks the Platform console at `/app/platform`
- `RV_SIGNUP_OPEN` (`false` stops public self-signup)
- `GROQ_API_KEY` (optional): written AI answers. Without it the assistant still returns the verified data tables.

## 3. Run
```
npm install
npm run dev     # http://localhost:3000
```
Deploy: push to GitHub, import the repo in Vercel, add the env vars, deploy, then add your domain.

## 4. First use
- Marketing site: `/`. App login and "Start free trial": `/app/login`.
- Sign up with a company name; you become that company's admin (14-day trial).
- Add warehouses, products, price lists, dealers (or bulk-import from Excel) and opening stock.
- Dealer portal login: open a dealer and choose "Create portal login". Dealers see only their own prices, orders, invoices and balance.
- Roles: admin, sales manager, sales rep, warehouse, finance, dealer.

## Order flow
Draft, Submitted, Under review, Approved (stock reserved, credit checked), Picking, Packed, Dispatched, Delivered; also Rejected, Cancelled, Partially fulfilled, Returned. Only admin can override a credit block (reason is audited).

## Known limits (MVP)
- Invoices are printable pages (Print, then Save as PDF); no server-side PDF.
- In-app notifications only; no email or WhatsApp sending yet.
- GST: per-line GST amount only (no CGST/SGST/IGST split, no e-invoice or e-way bill).
- The AI assistant is read-only with fixed tools; it never edits data.
- Not load-tested; reports aggregate in app code (fine for MVP scale).
