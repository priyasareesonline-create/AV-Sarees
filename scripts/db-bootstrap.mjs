#!/usr/bin/env node
/**
 * Bootstrap the AV Sarees Supabase database from an EMPTY project.
 *
 * Order (matches WAY-A-OFFICIAL.md — never mix the raw 01 SQL schema with drizzle push):
 *   1. drizzle-kit push        → tables/columns from src/lib/supabase/schema.ts (app source of truth)
 *   2. SQL migrations          → RLS, policies, indexes, triggers, grants (all idempotent)
 *   3. scripts/setup-supabase  → pg_graphql grants, profile trigger, disposable-signup block
 *
 * Safety:
 *   - DATABASE_URL must point at identity.supabase.projectRef (forbidden refs rejected)
 *   - Every SQL step runs in a transaction and is recorded in public.schema_bootstrap_log,
 *     so re-running only applies what is missing
 *   - drizzle push runs ONLY when public has no tables (it would otherwise prompt to
 *     rename/drop SQL-managed tables it does not know about). On a non-empty DB the
 *     script applies just the pending SQL steps.
 *
 * Usage:
 *   node scripts/db-bootstrap.mjs --dry-run
 *   node scripts/db-bootstrap.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import postgres from "postgres";
import { PROJECT_ROOT, loadProjectIdentity } from "./lib/load-project-identity.mjs";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const LEDGER = "schema_bootstrap_log";

dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local") });
const identity = loadProjectIdentity();

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("[db-bootstrap] DATABASE_URL missing in .env.local");
  process.exit(1);
}

// --- Guard: the URL must belong to the identity project ---------------------
function projectRefFromUrl(url) {
  try {
    const parsed = new URL(url.replace(/^postgres(ql)?:/i, "http:"));
    const user = decodeURIComponent(parsed.username);
    const m1 = user.match(/^postgres\.([a-z0-9]{20})$/i);
    if (m1) return m1[1];
    const m2 = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/i);
    if (m2) return m2[1];
  } catch {
    /* fallthrough */
  }
  return "";
}
const ref = projectRefFromUrl(rawUrl);
if (ref !== identity.supabase.projectRef) {
  console.error(
    `[db-bootstrap] DATABASE_URL project ref "${ref || "?"}" ≠ identity ${identity.supabase.projectRef}. Refusing.`,
  );
  process.exit(1);
}
if ((identity.forbidden?.supabaseProjectRefs || []).includes(ref)) {
  console.error(`[db-bootstrap] project ref ${ref} is forbidden. Refusing.`);
  process.exit(1);
}

// Session pooler (5432) supports multi-statement transactions; transaction pooler (6543) does not.
const sessionUrl = rawUrl.replace(/pooler\.supabase\.com:6543\//i, "pooler.supabase.com:5432/");

// --- SQL step plan ------------------------------------------------------------
const manifestPath = path.join(PROJECT_ROOT, "supabase", ".priya-sarees-migrations.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const readSql = (rel) => fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf8");

const steps = [
  { name: "priya_sarees_04_testimonials", query: readSql("supabase/04-testimonials.sql") },
  { name: "priya_sarees_05_testimonials_video", query: readSql("supabase/05-testimonials-video.sql") },
  ...manifest,
  ...fs
    .readdirSync(path.join(PROJECT_ROOT, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: `priya_sarees_m_${f.replace(/\.sql$/, "")}`, query: readSql(`supabase/migrations/${f}`) })),
];

const sql = postgres(sessionUrl, { max: 1, ssl: "require", prepare: false });

async function tableNames() {
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  return rows.map((r) => r.table_name);
}

try {
  const before = await tableNames();
  console.log(`[db-bootstrap] project ${ref} — ${before.length} public tables: ${before.join(", ") || "(none)"}`);

  const isEmpty = before.length === 0;
  const hasAppTables = before.includes("products") || before.includes("orders");
  if (!isEmpty && !hasAppTables) {
    throw new Error(
      `public schema has tables (${before.join(", ")}) but no app tables — clean it up before bootstrapping (drizzle push must see an empty schema).`,
    );
  }

  const appliedRows = before.includes(LEDGER)
    ? await sql`select name from public.schema_bootstrap_log`
    : [];
  const applied = new Set(appliedRows.map((r) => r.name));
  const pending = steps.filter((s) => !applied.has(s.name));

  console.log(`[db-bootstrap] plan:`);
  console.log(`  1. drizzle-kit push:pg  ${isEmpty ? "(run — empty schema)" : "(skip — app tables exist)"}`);
  for (const s of steps) console.log(`  2. ${applied.has(s.name) ? "done " : "apply"} ${s.name}`);
  console.log(`  3. node scripts/setup-supabase.mjs (grants, triggers, RLS policies)`);
  if (DRY) {
    console.log("[db-bootstrap] dry run — nothing changed");
    await sql.end();
    process.exit(0);
  }

  // 1. drizzle push (empty schema only) -------------------------------------------
  if (isEmpty) {
    console.log("[db-bootstrap] running drizzle-kit push:pg …");
    const kit = path.join(PROJECT_ROOT, "node_modules", "drizzle-kit", "bin.cjs");
    const res = spawnSync(process.execPath, [kit, "push:pg", "--config=drizzle.config.ts"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: sessionUrl },
    });
    if (res.status !== 0) throw new Error(`drizzle-kit push failed (exit ${res.status})`);
  }

  // Ledger lives in public but is created only after push so drizzle never sees it.
  await sql`create table if not exists public.schema_bootstrap_log (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  // 2. SQL steps ----------------------------------------------------------------
  for (const step of pending) {
    process.stdout.write(`[db-bootstrap] ${step.name} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(step.query);
      await tx`insert into public.schema_bootstrap_log (name) values (${step.name}) on conflict do nothing`;
    });
    console.log("ok");
  }

  // 3. setup-supabase -------------------------------------------------------------
  console.log("[db-bootstrap] running scripts/setup-supabase.mjs …");
  const setup = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "scripts", "setup-supabase.mjs")], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: sessionUrl },
  });
  if (setup.status !== 0) throw new Error(`setup-supabase failed (exit ${setup.status})`);

  const after = await tableNames();
  console.log(`[db-bootstrap] done — ${after.length} public tables: ${after.join(", ")}`);
} catch (error) {
  console.error(`[db-bootstrap] FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
