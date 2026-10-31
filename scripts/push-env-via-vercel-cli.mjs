/**
 * Push .env.local keys to linked Vercel project (production + preview).
 * Usage: node scripts/push-env-via-vercel-cli.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  loadProjectIdentity,
  PROJECT_ROOT,
} from "./lib/load-project-identity.mjs";

const identity = loadProjectIdentity();
const KEYS = [
  "SKIP_ENV_VALIDATION",
  "NEXT_PUBLIC_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_SERVICE_ROLE",
  "DATABASE_URL",
  "NEXT_PUBLIC_S3_BUCKET",
  "NEXT_PUBLIC_S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "NEXT_PUBLIC_CDN_URL",
  "NEXT_PUBLIC_SITE_URL",
  "ORDER_ACCESS_SECRET",
  "CRON_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECERT_KEY",
  "R2_MEDIA_PROXY_URL",
  "R2_MEDIA_PROXY_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

const envPath = path.join(PROJECT_ROOT, ".env.local");
const raw = fs.readFileSync(envPath, "utf8");
const map = new Map();
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 1) continue;
  let val = line.slice(i + 1);
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  map.set(line.slice(0, i), val);
}
map.set("NEXT_PUBLIC_SITE_URL", identity.site.canonicalOrigin);

const targets = ["production", "preview"];

function run(args) {
  return spawnSync("npx", ["vercel", ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
  });
}

console.log("Pushing env →", identity.vercel.projectSlug);

let failed = 0;
for (const key of KEYS) {
  const value = map.get(key);
  if (value === undefined || value === "") {
    console.log("skip (missing)", key);
    continue;
  }

  for (const t of targets) {
    run(["env", "rm", key, t, "--yes"]);
    const r = run([
      "env",
      "add",
      key,
      t,
      "--yes",
      "--force",
      "--value",
      value,
    ]);
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (r.status !== 0 || /"status": "error"|missing_requirements/i.test(out)) {
      console.error("fail", key, t, out.slice(0, 600));
      failed++;
      continue;
    }
  }
  console.log("set", key);
}

if (failed) {
  console.error(`Finished with ${failed} failures`);
  process.exit(1);
}
console.log("Done.");
