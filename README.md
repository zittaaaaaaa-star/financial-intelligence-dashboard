# Financial Intelligence Dashboard

Private research terminal for the three tracker pipelines:

- **13F:** institutional filings and reported positions
- **Form 4:** SEC insider transactions
- **FDA 510(k):** medical-device clearance records

## Stack

Next.js 15, React 19, TypeScript, Supabase Auth, and Supabase Postgres. The existing Python/GitHub Actions repositories remain the ingestion workers and keep their Discord alerts.

## Local development

1. Install Node.js 20.9+.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project's API settings.
4. Run `npm install`, then `npm run dev`.
5. Open http://localhost:3000.

**Security:** The browser uses only the Supabase publishable/anon key. Never add `SUPABASE_SERVICE_ROLE_KEY` to this repository, a `NEXT_PUBLIC_*` variable, or Vercel. The service-role key belongs only in the three ingestion repositories' GitHub Actions secrets.

## Supabase authentication

The app signs in existing Supabase Auth users with email/password. Create your own user in Supabase Dashboard → Authentication → Users. After creating the owner account, disable public sign-ups in Authentication settings. The four tracker tables have authenticated SELECT policies; keep Row Level Security enabled.

## Deploy to Vercel

1. Import this private repository into Vercel.
2. Set the two environment variables above for Production (and Preview only if needed).
3. Deploy.
4. In Supabase Authentication → URL Configuration, set the Site URL to your deployed Vercel URL and add that URL to the allowed redirect URLs if required by your project.

## Data sources

The dashboard reads these existing tables:

| Source | Supabase tables |
| --- | --- |
| 13F | `institutional_filings`, `institutional_holdings` |
| Form 4 | `form4_transactions` |
| FDA 510(k) | `fda_510k_clearances` |

The first version loads the latest 100 rows per table, supports a text search across loaded records, and exports the displayed filtered rows as CSV. Counts are queried separately across the full tables.

## Advanced research features

Run `supabase/advanced_features.sql` once in Supabase Dashboard → SQL Editor after deploying this update. It creates user-scoped watchlist and alert-rule tables with row-level security. Each authenticated user can access only their own saved items and rules.

The dashboard then adds:
- **Insider clusters:** groups loaded Form 4 rows by issuer and week, counting distinct insiders.
- **13F comparison:** compares the two most recent report periods among the latest 5,000 loaded holding rows, matching institution CIK + CUSIP + put/call.
- **Watchlist:** save tickers, companies, FDA product codes and CUSIPs.
- **Alert rules:** configure minimum distinct insiders and aggregate reported value, by ticker or globally.

**Signal limitations:** The current Form 4 ingestion schema does not include transaction codes, so cluster analysis cannot distinguish purchases from sales. It is a review signal, not a buy/sell recommendation. Alert rules are evaluated in the dashboard on load/refresh; they do not yet send push, email or Discord notifications. 13F comparisons are limited to the latest 5,000 rows fetched by the client and may be incomplete if a reporting period exceeds that limit.
