# Briggs’ Book Club replay library

A small members area for watching sittings, finding reading resources and marking sittings as watched. Google Drive serves the videos. Supabase handles membership, accounts and progress.

## Preview with sample data

Use a current LTS Node release that supports Vite. Run `npm ci` and `npm run dev`. Open the printed local URL and choose **Explore the library**. Both Supabase settings should be empty for this preview. Sample sittings are fictional and show a placeholder player. Preview progress stays in your browser.

## Connect Supabase

1. Open the Supabase project’s **Connect** dialog and copy its project URL and publishable key into `.env.local` using `.env.example` as the template. The browser build only needs those two public values.
2. Apply the SQL in `supabase/migrations/20261106000000_members_library.sql` via the Supabase CLI or SQL Editor. In **Authentication → Hooks**, enable **Before User Created** and select `public.before_user_created`.
3. Enable the email provider, email signups and email confirmation. Keep unused sign-in providers and anonymous signup disabled. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for club members. Use `{{ .Token }}` in both **Confirm sign up** and **Magic link or OTP**. New or unconfirmed accounts receive the confirmation email, while confirmed accounts receive the magic-link or OTP email. Keep the reset-password template set up with its recovery link. Set the Auth site URL and allow the preview and production URLs used for password resets.
4. Add a test member address in the SQL Editor before importing the real roster. Enter a lower-case email with no surrounding spaces.

   ```sql
   insert into private.member_emails (email)
   values ('member@example.com');
   ```

5. Share the app URL ending in `/#claim`. Supabase checks the roster when a new address requests a code. The member chooses a username and password, then enters the code before the app saves their credentials. On later visits they sign in with email and password.

The roster stays in a private schema. Database policies check current membership on every read of the library and confine progress to its owner. Remove a departing member from the Supabase roster and the relevant Drive permissions.

## Add the first text and replay

Add a row to `public.texts` with an ID, title and subtitle. In `public.sittings`, use the Drive file ID as `id`, the text’s ID as `text_id`, and set a title and `recorded_on` date. Add optional HTTPS resource links to `public.resources` using the same `text_id`.

Share the replay folder as **Viewer** with the club’s Google accounts or private Google Group. Keep the folder and files **Restricted**. Test the embedded player and **Open in Drive** using a member account, and check that an outside account can neither claim a dashboard account nor open the Drive replay.

This first build accepts existing Drive file IDs. The scheduled Drive folder sync is a follow-up once the folder IDs and recording workflow are known.

Run `npm run build` to produce the static site in `dist/`.
