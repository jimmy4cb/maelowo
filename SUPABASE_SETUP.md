# Supabase setup

The admin, client, product catalog, review, referral, and Google sign-in features use the configured Supabase project `vqxnazmaokbobtnxatjk`. Static HTML by itself cannot securely authenticate users or share product edits.

1. Run `supabase-schema.sql` in the project's SQL Editor to create the tables, triggers, RLS policies, and initial catalog.
2. `supabase-client.js` is configured with this project's URL and publishable key. The publishable key is intended for browser clients. Do not put the Supabase secret key, a `service_role` key, or a database password in frontend code or commit them to Git. Keep privileged keys only in a trusted server-side environment. The JWKS endpoint is for server-side JWT verification and is not needed by this static frontend.
3. In **Authentication → URL Configuration**, set the deployed site URL and add the exact sign-in callback URL (for example `https://your-domain.example/sign.html`) to the redirect allow list.
4. In **Authentication → Providers → Google**, enable Google and enter the OAuth client ID and secret from Google Cloud Console. Add this exact authorized redirect URI in Google Cloud Console:

   ```text
   https://vqxnazmaokbobtnxatjk.supabase.co/auth/v1/callback
   ```

   In Supabase **Authentication → URL Configuration**, also add your deployed site's `https://your-domain.example/sign.html` URL to the redirect allow list. The Google Cloud redirect URI is the Supabase callback above; the site callback is where users return after authentication.
5. Sign up with the account that should administer the catalog, then promote that account in the SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where email = 'admin@example.com'
   );
   ```

   Replace the email with the administrator account. All other accounts are clients by default. The app never lets a user choose or self-assign the admin role.
6. Serve the site over HTTP(S), not `file://`, and test email/password sign-in, Google sign-in, product editing, and client feedback after configuration.

RLS policies in the SQL schema enforce administrator-only catalog writes and restrict referrals and account profile access to their owners. Public reviews are readable by anyone; only signed-in clients can submit or change their own reviews.

The Supabase CLI is not installed in the current development environment. If you need CLI workflows later, install it using the official Supabase CLI instructions, then run `supabase login`, `supabase init`, and `supabase link --project-ref vqxnazmaokbobtnxatjk`. CLI login requires a Supabase personal access token. A real database password is only needed for commands that explicitly connect to Postgres; do not use the placeholder connection string or commit either credential.

If a secret key has been shared in chat, logs, or source control, rotate it in the Supabase dashboard before using it in any server-side integration. Local `.env` files are ignored by Git; share only a redacted `.env.example` if documenting server configuration.
