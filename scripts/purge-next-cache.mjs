/**
 * Empty the OpenNext ISR cache bucket so storefront pages regenerate.
 * Usage: node scripts/purge-next-cache.mjs
 */
import { AwsClient } from "aws4fetch";
import dotenv from "dotenv";
import { loadProjectIdentity } from "./lib/load-project-identity.mjs";

dotenv.config({ path: ".env.local" });
const identity = loadProjectIdentity();

const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
const bucket = identity.cloudflare.r2.nextCacheBucket;

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error("Missing S3_* credentials in .env.local");
  process.exit(1);
}

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: "s3",
  region: "auto",
});

const listUrl = `${endpoint}/${bucket}?list-type=2`;
const listRes = await client.fetch(listUrl);
const listXml = await listRes.text();
if (!listRes.ok) {
  console.error("List failed", listRes.status, listXml.slice(0, 500));
  process.exit(1);
}

const keys = [...listXml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
console.log(`Found ${keys.length} objects in ${bucket}`);

let deleted = 0;
for (const key of keys) {
  const delRes = await client.fetch(`${endpoint}/${bucket}/${key}`, {
    method: "DELETE",
  });
  if (delRes.ok || delRes.status === 204) deleted += 1;
  else console.warn("delete failed", key, delRes.status);
}
console.log(`Deleted ${deleted}/${keys.length}`);
