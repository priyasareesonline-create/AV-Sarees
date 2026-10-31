#!/usr/bin/env node
/**
 * Run a wrangler / opennextjs-cloudflare command with credentials pinned to
 * the AV Sarees Cloudflare account.
 *
 * Why: `npx wrangler login` on this machine may be an OAuth session for a
 * previous shop. Wrangler prefers CLOUDFLARE_API_TOKEN over that session, so we
 * verify the token against project.identity.json and inject it explicitly.
 *
 * Usage:
 *   node scripts/cf-run.mjs -- wrangler deploy --config workers/r2-media-proxy/wrangler.jsonc
 *   node scripts/cf-run.mjs -- opennextjs-cloudflare deploy --config wrangler.workers.new-account.jsonc
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadProjectIdentity, PROJECT_ROOT } from "./lib/load-project-identity.mjs";
import { assertTokenMatchesIdentity, wranglerEnv } from "./lib/cloudflare-api.mjs";

const sep = process.argv.indexOf("--");
let cmd = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2);
if (cmd.length === 0) {
  console.error("Usage: node scripts/cf-run.mjs -- <command> [args...]");
  process.exit(2);
}

// Prefer local binaries so Windows does not need a global PATH entry.
const localBins = {
  wrangler: path.join(PROJECT_ROOT, "node_modules", "wrangler", "bin", "wrangler.js"),
  "opennextjs-cloudflare": path.join(
    PROJECT_ROOT,
    "node_modules",
    "@opennextjs",
    "cloudflare",
    "dist",
    "cli",
    "index.js",
  ),
};
if (localBins[cmd[0]]) {
  cmd = [process.execPath, localBins[cmd[0]], ...cmd.slice(1)];
}

const identity = loadProjectIdentity();
let verified;
try {
  verified = await assertTokenMatchesIdentity(identity);
} catch (error) {
  console.error(`[cf-run] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
console.log(
  `[cf-run] account ${verified.accountId} (${verified.accountName}) → ${cmd.slice(cmd[0] === process.execPath ? 2 : 0).join(" ")}`,
);

const result = spawnSync(cmd[0], cmd.slice(1), {
  stdio: "inherit",
  env: wranglerEnv(verified.token, verified.accountId),
  shell: process.platform === "win32" && cmd[0] !== process.execPath,
  cwd: PROJECT_ROOT,
});
process.exit(result.status ?? 1);
