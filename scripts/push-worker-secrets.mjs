#!/usr/bin/env node
/**
 * Push server-side secrets from .env.local to the production Worker via
 * `wrangler secret bulk`, using the identity-pinned API token.
 *
 * NEXT_PUBLIC_* values are NOT pushed — they are baked in at build time.
 * Run after the first `npm run deploy` (the Worker must exist).
 *
 * Usage:
 *   node scripts/push-worker-secrets.mjs            # production worker
 *   node scripts/push-worker-secrets.mjs --dry-run  # list keys only
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT, loadProjectIdentity } from "./lib/load-project-identity.mjs";
import {
  assertTokenMatchesIdentity,
  loadEnvLocal,
  wranglerEnv,
} from "./lib/cloudflare-api.mjs";

const DRY = process.argv.includes("--dry-run");

/** Server-only keys the Worker needs at runtime. */
const SECRET_KEYS = [
  "DATABASE_URL",
  "DATABASE_SERVICE_ROLE",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY", // also read server-side by env.mjs
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "R2_MEDIA_PROXY_URL",
  "R2_MEDIA_PROXY_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

/** Public runtime values the server code also reads via process.env. */
const RUNTIME_PUBLIC_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_S3_BUCKET",
  "NEXT_PUBLIC_S3_REGION",
  "NEXT_PUBLIC_CDN_URL",
  "NEXT_PUBLIC_IMAGE_DELIVERY_MODE",
  "NEXT_PUBLIC_MEDIA_CDN_ORIGIN",
];

loadEnvLocal();
const identity = loadProjectIdentity();

const payload = {};
const skipped = [];
for (const key of [...SECRET_KEYS, ...RUNTIME_PUBLIC_KEYS]) {
  const value = process.env[key]?.trim();
  if (value) payload[key] = value;
  else skipped.push(key);
}

const requiredMissing = ["DATABASE_URL", "DATABASE_SERVICE_ROLE", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(
  (k) => !payload[k],
);
if (requiredMissing.length) {
  console.error(
    `[push-worker-secrets] Refusing: required secrets missing in .env.local: ${requiredMissing.join(", ")}`,
  );
  process.exit(1);
}

console.log(`[push-worker-secrets] keys: ${Object.keys(payload).join(", ")}`);
if (skipped.length) console.log(`[push-worker-secrets] skipped (empty): ${skipped.join(", ")}`);
if (DRY) process.exit(0);

let verified;
try {
  verified = await assertTokenMatchesIdentity(identity);
} catch (error) {
  console.error(`[push-worker-secrets] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `priya-sarees-secrets-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
try {
  const wranglerBin = path.join(PROJECT_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
  const result = spawnSync(
    process.execPath,
    [
      wranglerBin,
      "secret",
      "bulk",
      tmp,
      "--config",
      identity.cloudflare.productionWranglerConfig,
      "--name",
      identity.cloudflare.workerName,
    ],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: wranglerEnv(verified.token, verified.accountId),
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(tmp, { force: true });
}
