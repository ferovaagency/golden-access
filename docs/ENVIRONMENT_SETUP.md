# Environment setup

Ferova OS requires no secrets in the browser. Configure server-side values in Supabase Edge Functions or the deployment environment only.

| Variable | Used by | Purpose |
|---|---|---|
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

1. Apply migrations in `supabase/migrations/` to the intended project.
2. Set the Edge Function secrets in the Supabase dashboard or CLI secret store.
3. Deploy every Edge Function referenced by the frontend.
4. Configure Google and Notion redirect URLs before exposing their connection screens.
5. Verify RLS with two separate test users before production use.

## Scheduled work

Scheduled backups and automated scans require a server-side scheduler (Supabase Cron or an external secure scheduler) to invoke authenticated Edge Functions. Do not depend on an open browser tab.
