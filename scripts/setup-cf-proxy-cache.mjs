/**
 * Enable Cloudflare proxy (orange cloud) in front of Vercel + tune cache/SSL.
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone DNS Edit on priyasaree.com.
 * Usage: node --env-file=.env.local scripts/setup-cf-proxy-cache.mjs
 *
 * Architecture (industry-standard Vercel + Cloudflare):
 *   Browser → Cloudflare (cache static / WAF) → Vercel (Next.js)
 *   SSL mode: Full  |  Proxy: ON  |  Dynamic HTML/API still hit Vercel
 */
import { loadProjectIdentity, hostFromOrigin } from "./lib/load-project-identity.mjs";

const identity = loadProjectIdentity();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const zoneId = identity.cloudflare.zoneId;
const zoneName =
  identity.cloudflare.zoneName || hostFromOrigin(identity.site.canonicalOrigin);
const accountId = identity.cloudflare.accountId;

if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}
if (!zoneId) {
  console.error("Missing cloudflare.zoneId");
  process.exit(1);
}

const DESIRED = [
  {
    type: "A",
    name: zoneName,
    content: "76.76.21.21",
    proxied: true,
    ttl: 1,
  },
  {
    type: "A",
    name: `www.${zoneName}`,
    content: "76.76.21.21",
    proxied: true,
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
    throw new Error(`${method} ${path}: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

async function patchSetting(name, value) {
  try {
    const result = await cf(
      "PATCH",
      `/zones/${zoneId}/settings/${name}`,
      { value },
    );
    console.log("setting", name, "→", result.value ?? value);
  } catch (e) {
    console.warn("setting skip", name, String(e.message || e));
  }
}

async function upsertCacheRules() {
  // Cache Rules (new) — static Next assets at CF edge; bypass app/API
  const phase = "http_request_cache_settings";
  let entry;
  try {
    entry = await cf(
      "GET",
      `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`,
    );
  } catch (e) {
    console.warn(
      "Cache Rules API not available on this token/plan:",
      String(e.message || e),
    );
    return;
  }

  const rules = [
    {
      action: "set_cache_settings",
      description: "Priya — cache Next static assets at Cloudflare",
      enabled: true,
      expression: `(http.host eq "${zoneName}" or http.host eq "www.${zoneName}") and starts_with(http.request.uri.path, "/_next/static/")`,
      action_parameters: {
        cache: true,
        edge_ttl: { mode: "override_origin", default: 2592000 },
        browser_ttl: { mode: "override_origin", default: 86400 },
      },
    },
    {
      action: "set_cache_settings",
      description: "Priya — bypass cache for app/API/auth/cart",
      enabled: true,
      expression: `(http.host eq "${zoneName}" or http.host eq "www.${zoneName}") and (starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/auth/") or starts_with(http.request.uri.path, "/cart") or starts_with(http.request.uri.path, "/checkout") or starts_with(http.request.uri.path, "/admin"))`,
      action_parameters: {
        cache: false,
      },
    },
  ];

  if (entry?.id) {
    await cf("PUT", `/zones/${zoneId}/rulesets/${entry.id}`, {
      rules: [...rules, ...(entry.rules || []).filter((r) => !String(r.description || "").startsWith("Priya —"))],
    });
    console.log("updated Cache Rules entrypoint", entry.id);
  } else {
    console.warn("No cache settings entrypoint — create Cache Rules in dashboard if needed");
  }
}

async function main() {
  console.log("Account", accountId);
  console.log("Zone", zoneName, zoneId);

  // SSL + performance for proxied Vercel origin
  await patchSetting("ssl", "full");
  await patchSetting("always_use_https", "on");
  await patchSetting("cache_level", "standard");
  await patchSetting("browser_cache_ttl", 14400);
  await patchSetting("brotli", "on");
  await patchSetting("early_hints", "on");
  await patchSetting("rocket_loader", "off");
  await patchSetting("email_obfuscation", "off");

  let existing;
  try {
    existing = await cf("GET", `/zones/${zoneId}/dns_records?per_page=100`);
  } catch (e) {
    console.error(String(e));
    console.error(
      "\nNeed Zone → DNS → Edit token, OR in Cloudflare DNS turn BOTH @ and www clouds ORANGE (Proxied).",
    );
    process.exit(2);
  }

  for (const want of DESIRED) {
    const matches = existing.filter(
      (r) => r.type === want.type && r.name === want.name,
    );
    if (matches.length === 0) {
      const created = await cf("POST", `/zones/${zoneId}/dns_records`, want);
      console.log("created", created.type, created.name, "proxied=", created.proxied);
      continue;
    }
    const primary = matches[0];
    const needs =
      primary.content !== want.content ||
      Boolean(primary.proxied) !== Boolean(want.proxied);
    if (needs) {
      const updated = await cf(
        "PUT",
        `/zones/${zoneId}/dns_records/${primary.id}`,
        want,
      );
      console.log(
        "updated",
        updated.type,
        updated.name,
        "→",
        updated.content,
        "proxied=",
        updated.proxied,
      );
    } else {
      console.log("ok", primary.type, primary.name, "proxied=", primary.proxied);
    }
  }

  await upsertCacheRules();

  console.log("\nDone. Expect:");
  console.log("  Browser → Cloudflare (cache /_next/static) → Vercel (HTML/API)");
  console.log("  Test: curl -sI https://" + zoneName + " | findstr /i \"cf-cache server\"");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
