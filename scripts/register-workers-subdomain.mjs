/**
 * Register the workers.dev subdomain for the AV Sarees account.
 * Account + subdomain come from project.identity.json; auth from
 * CLOUDFLARE_API_TOKEN (.env.local). Idempotent.
 */
import { loadProjectIdentity } from "./lib/load-project-identity.mjs";
import { assertTokenMatchesIdentity, cfFetch } from "./lib/cloudflare-api.mjs";

const identity = loadProjectIdentity();
const subdomain = identity.cloudflare.workersDevSubdomain;
if (!subdomain) {
  console.error("identity.cloudflare.workersDevSubdomain is not set");
  process.exit(1);
}

const { token, accountId } = await assertTokenMatchesIdentity(identity);

const current = await cfFetch(`/accounts/${accountId}/workers/subdomain`, {}, token);
console.log("GET", current.status, JSON.stringify(current.json));

if (current.ok && current.json.result?.subdomain) {
  if (current.json.result.subdomain !== subdomain) {
    console.error(
      `Account already has subdomain "${current.json.result.subdomain}" ≠ identity "${subdomain}"`,
    );
    process.exit(1);
  }
  console.log(`workers.dev subdomain already ${subdomain}`);
  process.exit(0);
}

const put = await cfFetch(
  `/accounts/${accountId}/workers/subdomain`,
  { method: "PUT", body: JSON.stringify({ subdomain }) },
  token,
);
console.log("PUT", put.status, JSON.stringify(put.json));
process.exit(put.ok ? 0 : 1);
