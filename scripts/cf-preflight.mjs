#!/usr/bin/env node
/**
 * Cloudflare deploy preflight for AV Sarees.
 *
 * Verifies (and where safe, fixes) everything `npm run deploy` depends on:
 *   1. CLOUDFLARE_API_TOKEN → identity account only (never a forbidden account)
 *   2. R2 enabled on the account; media + next-cache buckets exist (auto-create)
 *   3. workers.dev subdomain registered (auto-create from identity)
 *   4. Build-time env present in .env.local (Supabase keys, site URL, R2 keys)
 *
 * Usage:
 *   node scripts/cf-preflight.mjs            # check + fix what the API allows
 *   node scripts/cf-preflight.mjs --no-fix   # report only
 *   node scripts/cf-preflight.mjs --build-env # also require production build env
 */
import {
  hostFromOrigin,
  loadProjectIdentity,
} from "./lib/load-project-identity.mjs";
import {
  assertTokenMatchesIdentity,
  cfFetch,
  loadEnvLocal,
} from "./lib/cloudflare-api.mjs";

const args = new Set(process.argv.slice(2));
const FIX = !args.has("--no-fix");
const REQUIRE_BUILD_ENV = args.has("--build-env");

const identity = loadProjectIdentity();
const blockers = [];
const warnings = [];
const ok = [];

function pass(message) {
  ok.push(message);
  console.log(`[cf-preflight] OK   ${message}`);
}
function block(message) {
  blockers.push(message);
  console.error(`[cf-preflight] FAIL ${message}`);
}
function warn(message) {
  warnings.push(message);
  console.warn(`[cf-preflight] WARN ${message}`);
}

loadEnvLocal();

// 1. Token / account -------------------------------------------------------
let token;
let accountId;
try {
  const verified = await assertTokenMatchesIdentity(identity);
  token = verified.token;
  accountId = verified.accountId;
  pass(`token → account ${accountId} (${verified.accountName})`);
} catch (error) {
  block(error instanceof Error ? error.message : String(error));
}

if (token) await checkAccount();
finish();

async function checkAccount() {
// 2. R2 + buckets -----------------------------------------------------------
const buckets = await cfFetch(`/accounts/${accountId}/r2/buckets`, {}, token);
if (buckets.status === 403 && buckets.json?.errors?.[0]?.code === 10042) {
  block(
    "R2 is not enabled on this account. One-time manual step: Cloudflare dashboard → R2 → " +
      "Enable (free tier; a payment method is required by Cloudflare even at $0). " +
      "The API cannot do this for you.",
  );
} else if (!buckets.ok) {
  block(`Cannot list R2 buckets: ${JSON.stringify(buckets.json?.errors)}`);
} else {
  const existing = new Set((buckets.json.result?.buckets || []).map((b) => b.name));
  for (const forbidden of identity.forbidden?.r2Buckets || []) {
    if (existing.has(forbidden)) {
      block(`Forbidden previous-shop bucket "${forbidden}" exists on this account`);
    }
  }
  const wanted = [
    identity.cloudflare.r2.mediaBucket,
    identity.cloudflare.r2.nextCacheBucket,
  ];
  for (const name of wanted) {
    if (existing.has(name)) {
      pass(`R2 bucket ${name} exists`);
      continue;
    }
    if (!FIX) {
      block(`R2 bucket ${name} missing (run without --no-fix to create)`);
      continue;
    }
    const created = await cfFetch(
      `/accounts/${accountId}/r2/buckets`,
      {
        method: "POST",
        body: JSON.stringify({ name, locationHint: "apac" }),
      },
      token,
    );
    if (created.ok) {
      pass(`R2 bucket ${name} created (apac)`);
    } else {
      block(`Could not create R2 bucket ${name}: ${JSON.stringify(created.json?.errors)}`);
    }
  }
}

// 3. workers.dev subdomain -------------------------------------------------
const wantedSub = identity.cloudflare.workersDevSubdomain;
const canonicalHost = hostFromOrigin(identity.site.canonicalOrigin);
const sub = await cfFetch(`/accounts/${accountId}/workers/subdomain`, {}, token);
if (sub.ok && sub.json.result?.subdomain) {
  const current = sub.json.result.subdomain;
  if (wantedSub && current !== wantedSub) {
    block(`workers.dev subdomain is "${current}" but identity expects "${wantedSub}"`);
  } else {
    pass(`workers.dev subdomain ${current}`);
  }
} else if (wantedSub && FIX) {
  const put = await cfFetch(
    `/accounts/${accountId}/workers/subdomain`,
    { method: "PUT", body: JSON.stringify({ subdomain: wantedSub }) },
    token,
  );
  if (put.ok) pass(`workers.dev subdomain ${wantedSub} registered`);
  else block(`Could not register workers.dev subdomain: ${JSON.stringify(put.json?.errors)}`);
} else {
  block("No workers.dev subdomain and identity.cloudflare.workersDevSubdomain is unset");
}
if (wantedSub && canonicalHost.endsWith(".workers.dev")) {
  const expectedHost = `${identity.cloudflare.workerName}.${wantedSub}.workers.dev`;
  if (canonicalHost !== expectedHost) {
    block(`site.canonicalOrigin host ${canonicalHost} ≠ ${expectedHost}`);
  }
}

// 4. Existing worker / forbidden names -------------------------------------
const scripts = await cfFetch(`/accounts/${accountId}/workers/scripts`, {}, token);
if (scripts.ok) {
  const names = (scripts.json.result || []).map((s) => s.id);
  if (names.includes(identity.cloudflare.workerName)) {
    pass(`worker ${identity.cloudflare.workerName} already exists (will be updated)`);
  } else {
    warn(`worker ${identity.cloudflare.workerName} not deployed yet (first deploy)`);
  }
  const suspicious = names.filter((n) => /thry|hubofcraft|ssr-tex/i.test(n));
  if (suspicious.length) {
    block(`Previous-shop workers found on this account: ${suspicious.join(", ")}`);
  }
} else {
  warn(`Cannot list workers (token may lack Workers Scripts:Read): ${JSON.stringify(scripts.json?.errors)}`);
}

// 5. Build-time env ----------------------------------------------------------
const env = (k) => process.env[k]?.trim() || "";
const requiredForBuild = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_S3_BUCKET",
  "NEXT_PUBLIC_CDN_URL",
];
const requiredSecrets = [
  "DATABASE_URL",
  "DATABASE_SERVICE_ROLE",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const missingBuild = requiredForBuild.filter((k) => !env(k));
const missingSecrets = requiredSecrets.filter((k) => !env(k));
const report = REQUIRE_BUILD_ENV ? block : warn;
if (missingBuild.length) report(`build env missing in .env.local: ${missingBuild.join(", ")}`);
else pass("build-time NEXT_PUBLIC_* env present");
if (missingSecrets.length) report(`worker secrets missing in .env.local: ${missingSecrets.join(", ")}`);
else pass("server secrets present for push-worker-secrets");

const siteHost = hostFromOrigin(env("NEXT_PUBLIC_SITE_URL"));
if (siteHost && siteHost !== canonicalHost) {
  (REQUIRE_BUILD_ENV ? block : warn)(
    `NEXT_PUBLIC_SITE_URL host "${siteHost}" ≠ identity canonical "${canonicalHost}". ` +
      "For a production build it must be the canonical origin (it is baked into the bundle).",
  );
}
if (env("NEXT_PUBLIC_SUPABASE_PROJECT_REF") && env("NEXT_PUBLIC_SUPABASE_PROJECT_REF") !== identity.supabase.projectRef) {
  block(`NEXT_PUBLIC_SUPABASE_PROJECT_REF ≠ identity ${identity.supabase.projectRef}`);
}
}

function finish() {
  console.log("");
  console.log(
    `[cf-preflight] ${ok.length} ok, ${warnings.length} warnings, ${blockers.length} blockers`,
  );
  if (blockers.length) {
    console.error("[cf-preflight] Deploy is BLOCKED until the FAIL items above are fixed.");
    process.exitCode = 1;
  } else {
    console.log("[cf-preflight] READY");
    process.exitCode = 0;
  }
}
