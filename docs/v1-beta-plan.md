# Briggs’ Book Club members area · v1 beta plan

## What a strong beta means

An existing member opens one link, claims an account with their book club email, and lands on a replay they can play immediately. They can find any of the six texts, open the accompanying resources, mark a sitting watched, and see their place when they return on another device. The organiser can publish the next replay by putting it in the right Drive folder and can update the member list without editing the app.

Keep the existing Vite app, Supabase, Resend and Google Drive. The work is to finish the member journey and make the archive reliable to operate.

## Where v0.1 stands

| Area | Verified state |
| --- | --- |
| Dashboard | The running local preview has the player, sittings, PDFs and catalogue together. A real Drive replay has played inside it. At phone width, the layout stacks without horizontal overflow in the preview. The catalogue starts well below the player, so the browse shortcut matters. |
| Catalogue | The live Supabase project has **6 texts, 22 sittings and 5 resources**. The import used the existing Drive folders. Future recordings still require a manual catalogue update. |
| Access | Supabase has **387 allowlisted emails**. The live endpoint rejected an unlisted address, and Resend delivered one approved test code. The database currently has **0 Auth accounts, 0 profiles and 0 saved progress rows**. The delivery test stopped before account creation was completed. |
| Release | The production build passes. The repo has no tracked deployment workflow or automated test command, and the preview runs locally. Supabase’s Site URL is `http://localhost:3000`, its redirect allowlist is empty, and its migration ledger is absent because setup SQL was applied manually. |

Audit baseline is `6517ca6`, the running preview, and read-only checks of the live project. [Source repository](https://github.com/muhibegypt-del/members-area-lite/tree/6517ca6)

## Build order

### 1. Fix the account journey and release setup

**Priority · Before the first pilot member**

- Deploy the app from GitHub to an HTTPS beta URL. Use the public site’s hosting setup if it can host a separate project. Set the Supabase Site URL to the beta origin and allow only the exact reset destinations the app uses. Prove a reset email opens the beta app from a different device. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- Make demo mode explicit and development-only. Today a production build with both Supabase settings missing can open the demo. Make a missing production configuration fail clearly at build time or show an unavailable screen. Keep the roster, local preview catalogue and server credentials out of Git and the deployed bundle.
- Keep the shared claim link, chosen username, and email-and-password sign-in. Make **Send code again**, **Change email**, and **Forgot password** easy to find. Explain the next step when a code expires, mail is rate-limited, a username is taken or a member used the wrong address.
- Tighten the wording and eligibility check for returning or removed members. The current hook only runs before a new Auth user is created, so a successful code request for an existing account is insufficient proof of current membership. Keep the database membership check authoritative, verify that revocation works with an existing session, and avoid adding an unrestricted roster lookup. [Claim and access code](https://github.com/muhibegypt-del/members-area-lite/blob/6517ca6/src/main.js)

**Done when** an approved test member can claim, sign out, sign in again and reset their password on the beta URL. An unlisted address cannot claim. A removed member with an existing session cannot fetch the catalogue or write progress.

### 2. Make the dashboard easy to return to

**Priority · Before the first pilot member**

- Keep the player visible on arrival and add a clear **Next sitting** action. Today the featured replay is the first unwatched sitting in catalogue order. Save the last opened text or sitting per member so someone who starts with Surah Yusuf returns there. Once they mark it watched, offer the next unwatched sitting in that text.
- Keep **Mark as watched** and the count visible. Give the save a pending, success and retry state. Guard an in-flight save against sign-out or a session change so a late response cannot change another session’s on-screen progress. Use a label like **Continue your text** if needed to make clear what the button resumes. Exact playback timestamps can wait while Drive supplies the player.
- On phones, put the selected sitting title, player and next action close together. Make **Sittings**, **Resources** and **All texts** easy to jump to without scrolling through a long list. Keep keyboard focus visible, use predictable tab order, and check that the controls still work at larger text sizes.
- Make the catalogue read like a library. Clean up PDF filenames and duplicate course names in sitting titles. Keep the existing session order and show recording dates only when known. Give unavailable videos a plain explanation and a visible **Open in Drive** route.

**Done when** a member can open a different text, play a sitting, mark it watched, refresh, and return to the right place from a second device. Test on an actual iPhone or iPad with Safari and on desktop Chrome. Check a PDF, keyboard navigation, and the Drive fallback.

### 3. Automate replay publishing

**Priority · Before calling the pilot a v1 beta**

- Use a scheduled Google Apps Script under a club-controlled account to check the six already-mapped folders. Start with a 15-minute check. If the recording tool already puts files in the right folder, discovery and publishing are automatic. If recordings first land somewhere else, the organiser drops the finished file into its text folder until that upstream handoff can be mapped safely. [Apps Script scheduling](https://developers.google.com/apps-script/guides/triggers/installable)
- Send only file IDs and catalogue metadata to a server-side Supabase ingestion endpoint. Give the sync a dedicated credential that can write catalogue entries only. Validate the mapped folders and supported file types. Update by Drive file ID so retries and renames preserve watch progress and do not duplicate sessions. Use stable ordering for numbered sittings. Keep existing entries visible when a folder cannot be read and flag missing files for review before removing anything.
- Give the organiser a short runbook with the folder convention, the last successful sync, what failure looks like, and how to run it again. Keep the manual add path available if the sync needs attention.

**Done when** a test recording in a mapped folder appears under the right text within two scheduled checks. Running the sync twice leaves one replay, renaming it preserves progress, and a simulated access failure leaves the rest of the library usable.

### 4. Set the access policy and make upkeep repeatable

**Priority · Before sharing the beta link widely**

- **Confirm the Drive policy.** The current folders are public by choice, so the membership gate covers the dashboard and progress. A forwarded public Drive link still follows Google’s sharing settings. If recordings themselves need to be member-only, change the Drive sharing separately and test both a member’s Google account and an outside account before rollout. Correct the README to describe whichever policy is chosen. [Drive sharing and inheritance](https://support.google.com/drive/answer/7166529)
- Make roster updates repeatable from the active Memberful export. Preview additions and removals, normalise and deduplicate addresses, apply the confirmed changes, and keep a count and rollback path. Start with a documented manual import. The live membership check should enforce removals without deleting an account’s saved progress.
- Reconcile the manually applied SQL with versioned migrations after comparing the live schema. Record the baseline rather than rerunning existing DDL on production. Add a small CI check for the production build and focused tests for signup rejection, progress ownership, revoked access, and repeated Drive imports. Keep a one-page checklist for configuration, restoring access and rolling back a release.

**Done when** the organiser can add or remove a test member, restore the previous roster, and identify a failed sync without reading application code. A fresh checkout can reproduce the build and schema.

## Pilot and release gate

1. **Internal smoke test.** Use two approved test accounts and one unlisted address. Run claim, sign-in, reset, logout, a replay and PDF, cross-device progress, revocation, and a new recording import. Check that neither test member can read or change the other’s progress.
2. **Small member pilot.** Share the same claim link with roughly 10–20 active members, including a few who primarily use phones. Ask them to claim their account, find a particular sitting and return the next day. Record where they needed help. The free Resend allowance is 100 sends per day, so leave room for resends and password resets before widening access. [Resend pricing](https://resend.com/pricing)
3. **Widen access when the checks pass.** Confirm a hosted password reset, successful playback on desktop and phone, persistent progress, and one successful scheduled import. Resolve any issue that prevents a pilot member from signing in or watching. Share in batches that fit the lower of the Supabase and Resend sending limits.

Defer custom video hosting, exact timestamp resume, billing changes, a large admin dashboard and automatic Memberful membership sync. Revisit them if the pilot shows a specific need.
