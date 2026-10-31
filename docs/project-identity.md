# Project identity

**Single source of truth:** [`project.identity.json`](../project.identity.json)

Holds public pins only (Cloudflare account, Supabase ref, site hosts, Vercel/GitHub, R2 bucket names). Secrets stay in `.env.local` / Vercel / Cloudflare.

## Commands

```bash
npm run validate:identity          # env + wrangler vs identity
npm run validate:identity:login    # also checks `wrangler whoami`
npm run validate:wrangler          # identity + OpenNext wrangler bindings
npm run auth:setup                 # configure Supabase Auth from identity
npm run auth:verify                # verify auth against identity project
```

## Cloudflare deploy (Workers, via OpenNext)

Deploys never rely on `wrangler login`. `scripts/cf-run.mjs` reads
`CLOUDFLARE_API_TOKEN` from `.env.local`, verifies it belongs to
`cloudflare.accountId` (and to no `forbidden.cloudflareAccountIds`), then
runs wrangler / opennextjs-cloudflare with that token injected.

```bash
npm run cf:preflight        # token → account, R2 buckets (auto-create), workers.dev subdomain, env gaps
npm run cf:dry-run          # next build + OpenNext bundle + `wrangler deploy --dry-run` (no account writes)
npm run deploy              # preflight (strict env) → build → deploy priya-sarees Worker
npm run cf:secrets          # push server secrets from .env.local to the Worker (after first deploy)
npm run deploy:media-proxy  # R2 media proxy Worker (optional, for image resizing)
```

Database (fresh Supabase project) — run once before the first build:

```bash
npm run db:bootstrap:dry    # shows the plan; refuses any project ref other than identity.supabase.projectRef
npm run db:bootstrap        # drizzle push (empty schema only) → SQL RLS/policies/indexes → setup-supabase grants
```

One-time manual steps the API cannot do:

1. Cloudflare dashboard → **R2 → Enable** on the Priya account (card required by Cloudflare).
2. Cloudflare dashboard → **Workers & Pages → Plans → Workers Paid** ($5/mo). The OpenNext bundle is
   ~4.5 MiB gzipped; the Free plan rejects Workers above 3 MiB. (`npm run cf:dry-run` prints the size.)
3. Supabase dashboard → Settings → API: copy **anon** + **service_role** into `.env.local`.
4. Set `NEXT_PUBLIC_SITE_URL=https://localhost:3000` before a production build
   (client bundle bakes it in). Keep Workers URL in `authRedirectOrigins` for later cutover.

Why not Cloudflare Pages: this app uses Server Actions, ISR with an R2 incremental
cache, a Durable Object revalidation queue and Node APIs — Cloudflare now documents
Pages only for *static-export* Next.js and routes full-stack Next.js to Workers.

## Change process

1. Edit `project.identity.json` first.
2. Update wrangler / `.env.local` / Vercel to match.
3. Run `npm run validate:identity` (and `:login` if Cloudflare login changed).
4. Never use hosts/accounts listed under `forbidden`.

## Hosting: Vercel now, Cloudflare Workers later

**Canonical domain:** `https://localhost:3000` (DNS zone on Priya Cloudflare account).

### Validated vs THRY

| | **THRY (`thryco.com`)** | **Priya now (`localhost:3000`)** |
|--|-------------------------|----------------------------------|
| App host | Cloudflare **Workers** | **Vercel** |
| DNS | Cloudflare, **proxied (orange)** OK | Cloudflare DNS; keep apex/www pointing at Vercel |
| Why orange works on THRY | Origin is Cloudflare itself — no external SSL hop | If orange + bad SSL → Error **525** |
| Cache | Full Cloudflare CDN/WAF | Vercel CDN (`x-vercel-cache`); CF cache only if proxied + SSL Full working |
| Later | Already on Workers | Same repo → `npm run deploy` then orange like THRY |

### Robust production shape (now)

1. **Vercel** serves the Next.js shop (Hobby OK with daily crons).
2. **Cloudflare** holds the zone for `localhost:3000`.
3. DNS records (external DNS provider = Cloudflare):
   - `A @ → 76.76.21.21` (Vercel apex)
   - `A www → 76.76.21.21` *or* `CNAME www → cname.vercel-dns.com`
   - Prefer **DNS only (grey)** until SSL is issued; after Vercel cert exists, orange + **SSL Full** can work (traffic still hits Vercel on cache miss).
4. Issue/renew certs: `npx vercel certs issue localhost:3000 www.localhost:3000`
5. `NEXT_PUBLIC_SITE_URL=https://localhost:3000` + Supabase auth URLs for apex/www/vercel.app/workers.dev.

### Cloudflare cache in front of Vercel (optional)

Industry pattern: **Browser → Cloudflare cache/WAF → Vercel**.

1. Vercel SSL certs must exist (`npx vercel certs issue localhost:3000 www.localhost:3000`).
2. Cloudflare SSL = **Full**, Always HTTPS = **on**.
3. DNS `@` + `www` = **A 76.76.21.21** with **Proxied (orange)**.
4. Run: `npm run dns:cf-proxy` (needs Zone DNS Edit token) — sets proxy + cache-friendly settings.
5. Static `/_next/static/*` can be cached at CF; `/api`, `/cart`, `/checkout`, `/auth` bypass to Vercel.

If orange is on before certs → Error **525**. Grey first, issue certs, then orange.

| Now | Later cutover (THRY-like) |
|-----|---------------------------|
| App on **Vercel** | Same repo → `npm run deploy` (Workers / OpenNext) |
| DNS at Cloudflare → Vercel (`scripts/setup-vercel-dns.mjs`, `proxied: false`) | Worker custom domain; orange OK |
| Site URL stays `https://localhost:3000` | Same URL |

```bash
# After Priya Vercel project exists + token can edit DNS:
node --env-file=.env.local scripts/setup-vercel-dns.mjs
npx vercel certs issue localhost:3000 www.localhost:3000
npm run auth:setup
```

Set `NEXT_PUBLIC_SITE_URL=https://localhost:3000` before a production build
(client bundle bakes it in).
