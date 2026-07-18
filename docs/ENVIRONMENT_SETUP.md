# Environment setup

Ferova OS needs two **public** build variables in the browser to create its Supabase client. The publishable key is designed for browser use and is constrained by Supabase RLS; it is not a server secret. Configure all other sensitive values only in Supabase Edge Functions or the secure deployment environment.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser build | Supabase project URL, for example `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser build | Supabase publishable key (`sb_publishable_...`); never substitute a secret or service-role key |
| `SUPABASE_URL` | Edge Functions | Supabase project URL |
| `SUPABASE_ANON_KEY` | Edge Functions | Validates the caller session |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Privileged server-side reads and writes; never expose it to the client |
| `LOVABLE_API_KEY` | AI Edge Functions | Lovable AI Gateway access |
| `GOOGLE_CLIENT_ID` | Google OAuth setup | Google OAuth client identifier |
| `GOOGLE_CLIENT_SECRET` | Google OAuth setup | Google OAuth client secret; server only |
| `GOOGLE_REDIRECT_URI` | Google OAuth setup | Registered OAuth callback URL |
| `NOTION_CLIENT_ID` | Notion OAuth preparation | Notion OAuth client identifier |
| `NOTION_CLIENT_SECRET` | Notion OAuth preparation | Notion OAuth client secret; server only |
| `NOTION_REDIRECT_URI` | Notion OAuth preparation | Registered OAuth callback URL |

## Deployment checklist

1. In Supabase Dashboard, open **Connect** (or **Settings > API Keys**) and copy the project URL and the **Publishable** key.
2. For a Lovable Cloud deployment, reconnect the Cloud project and publish a fresh deployment. Lovable Cloud must inject `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` during that build. These values are only needed manually for local or external builds.
3. Apply migrations in `supabase/migrations/` to the intended project.
4. Set the Edge Function secrets in the Supabase dashboard or CLI secret store.
5. Deploy every Edge Function referenced by the frontend.
6. Configure Google and Notion redirect URLs before exposing their connection screens.
7. Verify RLS with two separate test users before production use.

## Scheduled work

Scheduled backups and automated scans require a server-side scheduler (Supabase Cron or an external secure scheduler) to invoke authenticated Edge Functions. Do not depend on an open browser tab.
