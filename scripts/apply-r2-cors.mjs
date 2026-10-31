/**
 * Apply production R2 CORS for browser digital Zip PUTs (admin on localhost:3000).
 *
 * Auth: CLOUDFLARE_API_TOKEN from .env.local, verified against
 * project.identity.json. The wrangler OAuth login is never used.
 *
 * Usage:
 *   node scripts/apply-r2-cors.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTokenMatchesIdentity } from "./lib/cloudflare-api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Convert S3-style CORS JSON to Cloudflare R2 Management API `rules` body. */
function toApiRules(corsJson) {
  const entries = Array.isArray(corsJson) ? corsJson : corsJson.rules || [];
  return {
    rules: entries.map((rule, index) => ({
      id: rule.id || `priya-sarees-cors-${index + 1}`,
      allowed: {
        origins: rule.AllowedOrigins || rule.allowed?.origins || [],
        methods: rule.AllowedMethods || rule.allowed?.methods || [
          "GET",
          "PUT",
          "HEAD",
        ],
        headers: rule.AllowedHeaders ||
          rule.allowed?.headers || ["Content-Type", "Content-Length"],
      },
      exposeHeaders: rule.ExposeHeaders || rule.exposeHeaders || ["ETag"],
      maxAgeSeconds: rule.MaxAgeSeconds || rule.maxAgeSeconds || 86400,
    })),
  };
}

const identity = JSON.parse(
  readFileSync(join(root, "project.identity.json"), "utf8"),
);
const { token, accountId } = await assertTokenMatchesIdentity(identity);
const bucket = identity.cloudflare.r2.mediaBucket;
const corsJson = JSON.parse(
  readFileSync(join(root, "scripts", "r2-cors.new-account.json"), "utf8"),
);
const body = toApiRules(corsJson);

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);
const json = await res.json().catch(() => ({}));
console.log("status", res.status);
console.log("success", json.success);
if (json.errors?.length) console.log("errors", JSON.stringify(json.errors));
if (!res.ok || !json.success) process.exit(1);

const getRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const getJson = await getRes.json().catch(() => ({}));
console.log(
  "cors rules",
  JSON.stringify(getJson.result ?? getJson, null, 2).slice(0, 4000),
);
console.log(`Applied CORS on ${bucket} (${accountId})`);
