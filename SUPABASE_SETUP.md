# Supabase setup

The admin, client, product catalog, review, referral, and Google sign-in features use the configured Supabase project `sxyyrtuweixwdthgrvcd`. Static HTML by itself cannot securely authenticate users or share product edits.

1. Run `supabase-schema.sql` in the project's SQL Editor to create the tables, triggers, RLS policies, orders table, and initial catalog.
2. `supabase-client.js` is configured with this project's URL and publishable key. The publishable key is intended for browser clients. Do not put the Supabase secret key, a `service_role` key, or a database password in frontend code or commit them to Git. Keep privileged keys only in a trusted server-side environment. The JWKS endpoint is for server-side JWT verification and is not needed by this static frontend.
3. In **Authentication → URL Configuration**, set the deployed site URL and add the exact sign-in callback URL (for example `https://your-domain.example/sign.html`) to the redirect allow list.
   Signup confirmation redirects to the current site origin's `/sign.html` (including a checkout `next` parameter if present). Test on the deployed HTTPS site, not `file://`, and allow-list the exact resulting URL.
4. In **Authentication → Sign In / Providers → Email**, make sure email/password signups are enabled and email confirmation is enabled. Check **Authentication → Email Templates → Confirm signup** for a valid confirmation link template. The app shows errors returned by Supabase and includes a resend confirmation action on the sign-in page.
5. Configure custom SMTP in **Project Settings → Auth → SMTP Settings** (or **Authentication → SMTP Settings**, depending on dashboard layout). Supabase's built-in mailer is for testing only: it only sends to pre-authorized project team addresses and has a very low rate limit. For public users, configure a transactional email provider, verify your sender domain, and check SPF/DKIM/DMARC, provider suppression/bounce logs, and Supabase Auth rate limits. Check spam/junk and verify that the user's email is spelled correctly.
6. In Google Cloud Console, create or select an OAuth client of type **Web application**. Add your deployed HTTPS site origin under **Authorized JavaScript origins** (for example `https://your-domain.example`). Under **Authorized redirect URIs**, add this exact Supabase callback:

   ```text
   https://sxyyrtuweixwdthgrvcd.supabase.co/auth/v1/callback
   ```

   In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Web application OAuth client ID and client secret from the downloaded Google client JSON. Enter these credentials directly in the Supabase dashboard; never add the JSON or client secret to this repository, frontend files, or chat. If the client secret has been exposed, rotate it in Google Cloud and replace it in Supabase.
   In Supabase **Authentication → URL Configuration**, set the deployed site URL and add the site's sign-in return URL (for example `https://your-domain.example/sign.html`) to the redirect allow list. For local testing, allow-list the exact localhost URL and serve the site over HTTP. The Google Cloud redirect URI above points to Supabase; the Supabase redirect allow-list URL points back to the website.
7. Sign up with the account that should administer the catalog, then promote that account in the SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where email = 'admin@example.com'
   );
   ```

   Replace the email with the administrator account. All other accounts are clients by default. The app never lets a user choose or self-assign the admin role.
8. Serve the site over HTTP(S), not `file://`, and test email/password sign-in, Google sign-in, product editing, and client feedback after configuration.

RLS policies in the SQL schema enforce administrator-only catalog writes and restrict referrals and account profile access to their owners. Public reviews are readable by anyone; only signed-in clients can submit or change their own reviews.

The Supabase CLI is not installed in the current development environment. If you need CLI workflows later, install it using the official Supabase CLI instructions, then run `supabase login`, `supabase init`, and `supabase link --project-ref sxyyrtuweixwdthgrvcd`. CLI login requires a Supabase personal access token. A real database password is only needed for commands that explicitly connect to Postgres; do not use a placeholder connection string or commit either credential.

If a secret key has been shared in chat, logs, or source control, rotate it in the Supabase dashboard before using it in any server-side integration. Local `.env` files are ignored by Git; share only a redacted `.env.example` if documenting server configuration.

## Edge Function payment verification

The checkout calls `supabase/functions/verify-paystack-payment/index.ts` after Paystack reports a completed payment. The function requires a signed-in user, reloads active product prices from Supabase, verifies the transaction against Paystack using a server-only secret, checks the currency, amount, reference, and customer email, then records the order. Run the schema above before deploying the function.

Supabase Edge Functions already provide `SUPABASE_URL` and Supabase keys at runtime. Do not copy the secret key into the function source, browser code, or a committed `.env` file. Set the Paystack transaction verification secret in the Supabase project secrets:

```powershell
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_or_live_value
supabase functions deploy verify-paystack-payment
```

Use the secret key from the Paystack dashboard for server-side verification; the existing `pk_live_...` key remains the browser-side checkout key. Keep test and live keys aligned. The function uses the Deno npm specifier `npm:@supabase/server@^1`, so installing an npm package into this static website is not required.

This function verifies a payment and creates a database order; it does not send order-confirmation emails. Supabase Auth confirmation email delivery is separate and still requires SMTP configuration above. Before relying on checkout for fulfillment, test the whole flow with Paystack test credentials and verify the recorded order in the database.
