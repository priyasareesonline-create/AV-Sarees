/**
 * Cloudflare API access pinned to project.identity.json.
 *
 * Rules (robustness against previous-shop accounts):
 * - Auth comes ONLY from CLOUDFLARE_API_TOKEN (env or .env.local).
 *   The wrangler OAuth login is never read — it may belong to a forbidden account.
 * - Before anything else, the token is checked against the Cloudflare API and
 *   must resolve to identity.cloudflare.accountId and nothing in forbidden.*.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PROJECT_ROOT, loadProjectIdentity } from "./load-project-identity.mjs";

export const CF_API = "https://api.cloudflare.com/client/v4";

/** Load .env.local into process.env without overriding already-set vars. */
export function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export function getApiToken() {
  loadEnvLocal();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || "";
  if (!token) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is missing. Add it to .env.local (never commit it). " +
        "The wrangler OAuth login is intentionally ignored for this project.",
    );
  }
  return token;
}

export async function cfFetch(pathname, init = {}, token = getApiToken()) {
  const res = await fetch(`${CF_API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, ok: res.ok && json.success !== false, json };
}

/**
 * Verify the token belongs to the identity account and not a forbidden one.
 * Returns { accountId, accountName }.
 */
export async function assertTokenMatchesIdentity(identity = loadProjectIdentity()) {
  const token = getApiToken();
  const expected = identity.cloudflare.accountId;
  const forbiddenIds = new Set(identity.forbidden?.cloudflareAccountIds || []);

  const verify = await cfFetch(`/accounts/${expected}/tokens/verify`, {}, token);
  if (!verify.ok || verify.json?.result?.status !== "active") {
    throw new Error(
      `CLOUDFLARE_API_TOKEN is not valid/active for account ${expected}: ` +
        JSON.stringify(verify.json?.errors || verify.status),
    );
  }

  const accounts = await cfFetch("/accounts", {}, token);
  if (!accounts.ok) {
    throw new Error(
      `Token cannot list accounts (needs Account Settings:Read): ${JSON.stringify(
        accounts.json?.errors,
      )}`,
    );
  }
  const visible = accounts.json.result || [];
  for (const acct of visible) {
    if (forbiddenIds.has(acct.id)) {
      throw new Error(
        `CLOUDFLARE_API_TOKEN can see forbidden account ${acct.id} (${acct.name}). ` +
          "Use a token created inside the AV Sarees account only.",
      );
    }
  }
  const match = visible.find((acct) => acct.id === expected);
  if (!match) {
    throw new Error(
      `CLOUDFLARE_API_TOKEN does not belong to account ${expected}. Visible: ${
        visible.map((a) => `${a.id} (${a.name})`).join(", ") || "none"
      }`,
    );
  }

  const envAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (envAccount && envAccount !== expected) {
    throw new Error(
      `CLOUDFLARE_ACCOUNT_ID=${envAccount} ≠ identity ${expected}. Fix .env.local.`,
    );
  }

  return { accountId: match.id, accountName: match.name, token };
}

/** Env to hand to wrangler / opennext so they never use the OAuth login. */
export function wranglerEnv(token, accountId) {
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    WRANGLER_SEND_METRICS: "false",
  };
  // Must delete — empty strings make the Cloudflare SDK think apiKey auth was chosen.
  delete env.CLOUDFLARE_API_KEY;
  delete env.CLOUDFLARE_EMAIL;
  delete env.CF_API_TOKEN; // avoid stale aliases
  return env;
}
