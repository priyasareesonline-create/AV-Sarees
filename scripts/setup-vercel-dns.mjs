/**
 * Point Cloudflare DNS for priyasaree.com at Vercel (DNS-only, not proxied).
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone → DNS → Edit on the Priya zone.
 * Usage: node --env-file=.env.local scripts/setup-vercel-dns.mjs
 *
 * Later cutover to Workers: replace these records with Worker custom domain
 * (or CNAME to workers.dev) — see docs/project-identity.md.
 */
import {
  loadProjectIdentity,
  hostFromOrigin,
} from "./lib/load-project-identity.mjs";

const identity = loadProjectIdentity();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = identity.cloudflare.accountId;
const zoneId = identity.cloudflare.zoneId;
const zoneName = identity.cloudflare.zoneName || hostFromOrigin(identity.site.canonicalOrigin);

if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}
if (!zoneId) {
  console.error("Missing cloudflare.zoneId in project.identity.json");
  process.exit(1);
}

/** Vercel apex + www targets (Hobby / recommended A records). Prefer DNS-only (proxied=false). */
const DESIRED = [
  {
    type: "A",
    name: zoneName,
    content: "76.76.21.21",
    proxied: false,
    ttl: 1,
  },
  {
    type: "A",
    name: `www.${zoneName}`,
    content: "76.76.21.21",
    proxied: false,
    ttl: 1,
  },
];

async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    const msg = JSON.stringify(json.errors || json, null, 2);
    throw new Error(`${method} ${path} failed: ${msg}`);
  }
  return json.result;
}

async function main() {
  console.log("Account", accountId);
  console.log("Zone", zoneName, zoneId);

  const verify = await fetch(
    "https://api.cloudflare.com/client/v4/zones/" + zoneId,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  if (!verify.success) {
    throw new Error("Cannot read zone — check token Zone:Read: " + JSON.stringify(verify.errors));
  }
  if (verify.result?.account?.id && verify.result.account.id !== accountId) {
    throw new Error(
      `Zone account ${verify.result.account.id} ≠ identity ${accountId}`,
    );
  }

  let existing;
  try {
    existing = await cf(
      "GET",
      `/zones/${zoneId}/dns_records?per_page=100`,
    );
  } catch (e) {
    console.error(String(e));
    console.error(
      "\nToken needs Zone → DNS → Edit for",
      zoneName,
      "\nCreate a token at https://dash.cloudflare.com/profile/api-tokens",
      "\nTemplate: Edit zone DNS — include only this zone.",
    );
    process.exit(2);
  }

  for (const want of DESIRED) {
    const matches = existing.filter(
      (r) =>
        r.type === want.type &&
        r.name === want.name,
    );
    if (matches.length === 0) {
      const created = await cf("POST", `/zones/${zoneId}/dns_records`, want);
      console.log("created", created.type, created.name, "→", created.content);
      continue;
    }
    const primary = matches[0];
    const needsUpdate =
      primary.content !== want.content ||
      Boolean(primary.proxied) !== Boolean(want.proxied);
    if (needsUpdate) {
      const updated = await cf(
        "PUT",
        `/zones/${zoneId}/dns_records/${primary.id}`,
        want,
      );
      console.log("updated", updated.type, updated.name, "→", updated.content);
    } else {
      console.log("ok", primary.type, primary.name, "→", primary.content);
    }
    for (const extra of matches.slice(1)) {
      await cf("DELETE", `/zones/${zoneId}/dns_records/${extra.id}`);
      console.log("deleted duplicate", extra.type, extra.name, extra.id);
    }
  }

  console.log("\nDNS ready for Vercel. Next:");
  console.log("  1. Vercel project → Domains → add priyasaree.com + www");
  console.log("  2. npm run auth:setup");
  console.log("  3. Redeploy so NEXT_PUBLIC_SITE_URL is baked in");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
