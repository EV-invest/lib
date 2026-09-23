import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LEAD_SCHEMA_VERSION, type Lead } from "../src/index";
import {
  checkLeadStore,
  LeadStoreNotImplemented,
  openLeadStore,
  openSqliteLeadStore,
  parseLeadDb,
  parseServerEnv,
} from "../src/server/index";
import { describeLeadStoreContract } from "../src/testing/lead-store-contract";

const tmp = () => join(mkdtempSync(join(tmpdir(), "kitstart-leads-")), "leads.db");
const sqlite = () => {
  const mod = process.getBuiltinModule("node:sqlite");
  if (!mod) throw new Error("node:sqlite missing");
  return mod;
};
const SITE = { brand: { id: "aquafix" } };

describeLeadStoreContract("sqlite (file)", () => {
  const path = tmp();
  return { open: async () => openSqliteLeadStore(path), reopen: async () => openSqliteLeadStore(path) };
});

describeLeadStoreContract("sqlite (selected by LEADS_DB_URL)", () => {
  const url = `sqlite://${tmp()}`;
  return { open: async () => openLeadStore(parseLeadDb(url)), reopen: async () => openLeadStore(parseLeadDb(url)) };
});

describe("choosing the lead store", () => {
  it("reads the adapter off the scheme of LEADS_DB_URL", () => {
    expect(parseLeadDb("sqlite:///data/leads.db")).toEqual({ kind: "sqlite", path: "/data/leads.db" });
    expect(() => parseLeadDb("sqlite:leads.db")).toThrow(/absolute/);
    // Two slashes make `data` a host; the file would land at `/leads.db`.
    expect(() => parseLeadDb("sqlite://data/leads.db")).toThrow(/no host, query or fragment/);
    expect(() => parseLeadDb("sqlite:///data/leads.db?mode=ro")).toThrow(/no host, query or fragment/);
    expect(parseLeadDb("postgres://u:p@db/leads")).toEqual({ kind: "postgres", url: "postgres://u:p@db/leads" });
    expect(parseLeadDb("postgresql://db/leads")).toMatchObject({ kind: "postgres" });
    expect(() => parseLeadDb("mysql://db/leads")).toThrow(/unsupported scheme/);
  });

  it("refuses to open the postgres stub, naming the host but never the password", () => {
    const open = () => openLeadStore(parseLeadDb("postgres://u:secret@db.internal:5432/leads"));
    expect(open).toThrow(LeadStoreNotImplemented);
    expect(open).toThrow(/db\.internal:5432/);
    expect(open).not.toThrow(/secret/);
  });

  it("keeps LEADS_DB_PATH working and lets LEADS_DB_URL win", () => {
    const prod = { NODE_ENV: "production" };
    expect(parseServerEnv(SITE, { ...prod, LEADS_DB_PATH: "/data/leads.db" })).toMatchObject({
      leadsDb: { kind: "sqlite", path: "/data/leads.db" },
      leadsDbFrom: "LEADS_DB_PATH",
    });
    expect(parseServerEnv(SITE, { ...prod, LEADS_DB_PATH: "/data/leads.db", LEADS_DB_URL: "sqlite:///data/v2.db" })).toMatchObject({
      leadsDb: { kind: "sqlite", path: "/data/v2.db" },
      leadsDbFrom: "LEADS_DB_URL",
    });
  });

  it("refuses to boot in production with neither", () => {
    expect(() => parseServerEnv(SITE, { NODE_ENV: "production" })).toThrow(/LEADS_DB_URL or LEADS_DB_PATH is required/);
    expect(() => parseServerEnv(SITE, { NODE_ENV: "production", LEADS_DB_PATH: " " })).toThrow(/required/);
  });

  it("defaults to a per-brand file outside production, and reads the rest of the env", () => {
    const env = parseServerEnv(SITE, { LOCATIONS_API_URL: "https://live.example/", SMTP_URL: " " });
    expect(env).toMatchObject({ production: false, leadsDbFrom: "default", locationsApiUrl: "https://live.example", smtpUrl: null });
    expect(env.leadsDb).toMatchObject({ kind: "sqlite", path: expect.stringContaining("aquafix/leads.db") });
    expect(env.posthogHost).toBe("https://eu.i.posthog.com");
    expect(() => parseServerEnv(SITE, { POSTHOG_HOST: "nope" })).toThrow(/POSTHOG_HOST is not a URL/);
  });

  it("checks the store at boot and says which one won", async () => {
    const info = vi.fn();
    await checkLeadStore({ leadsDb: { kind: "sqlite", path: tmp() }, leadsDbFrom: "LEADS_DB_URL" }, { info });
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^leads: sqlite at .*, schema v4 \(from LEADS_DB_URL\)$/));
    await expect(checkLeadStore({ leadsDb: { kind: "postgres", url: "postgres://db/x" }, leadsDbFrom: "LEADS_DB_URL" }, { info })).rejects.toThrow(
      LeadStoreNotImplemented,
    );
  });
});

const lead = (over: Partial<Lead> = {}): Lead => ({
  subject: "blocked_drain",
  locality: "63130",
  mobile: "06 12 34 56 78",
  extras: {},
  placeSlug: "royat",
  spamVerdict: null,
  ...over,
});

/**
 * The store as it shipped before its schema was versioned: the Rust table,
 * then each column added if missing, `user_version` never touched.
 */
function unversioned(path: string, columns: readonly ("location_id" | "spam_verdict")[]): void {
  const db = new (sqlite().DatabaseSync)(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT NOT NULL, zip TEXT NOT NULL,
    mobile TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')))`);
  for (const column of columns) db.exec(`ALTER TABLE leads ADD COLUMN ${column} TEXT`);
  if (columns.length === 2) {
    db.prepare("INSERT INTO leads (job, zip, mobile, location_id, spam_verdict) VALUES (?, ?, ?, ?, ?)").run("tap_toilet", "69003", "0612345678", "desgenettes", "too-fast");
  } else {
    db.prepare("INSERT INTO leads (job, zip, mobile) VALUES (?, ?, ?)").run("tap_toilet", "69003", "0612345678");
  }
  db.close();
}

const columnsOf = (path: string): unknown[] => {
  const db = new (sqlite().DatabaseSync)(path);
  const names = db.prepare("PRAGMA table_info(leads)").all().map(r => (typeof r === "object" && r !== null ? Reflect.get(r, "name") : undefined));
  db.close();
  return names;
};

const ALL = ["id", "job", "zip", "mobile", "at", "location_id", "spam_verdict", "extras"];

describe("the sqlite store's migrations", () => {
  it("creates a fresh file at the latest version", async () => {
    const path = tmp();
    const store = openSqliteLeadStore(path);
    expect(store.version()).toBe(LEAD_SCHEMA_VERSION);
    await store.close();
    expect(columnsOf(path)).toEqual(ALL);
  });

  it("brings the Rust server's table forward in place, keeping its rows", async () => {
    const path = tmp();
    unversioned(path, []);
    const store = openSqliteLeadStore(path);
    expect(await store.insert(lead({ placeSlug: "lyon-nord", spamVerdict: "honeypot" }))).toBe(2);
    await store.close();
    const check = new (sqlite().DatabaseSync)(path);
    expect(check.prepare("SELECT location_id, spam_verdict FROM leads ORDER BY id").all()).toEqual([
      { location_id: null, spam_verdict: null },
      { location_id: "lyon-nord", spam_verdict: "honeypot" },
    ]);
    check.close();
  });

  it("recognises a file the unversioned Node store wrote, and keeps its rows", async () => {
    const path = tmp();
    unversioned(path, ["location_id", "spam_verdict"]);
    const store = openSqliteLeadStore(path);
    expect(store.version()).toBe(LEAD_SCHEMA_VERSION);
    expect(await store.insert(lead({ extras: { surface_m2: "40" } }))).toBe(2);
    await store.close();
    const check = new (sqlite().DatabaseSync)(path);
    expect(check.prepare("SELECT job, zip, location_id, spam_verdict, extras FROM leads ORDER BY id").all()).toEqual([
      { job: "tap_toilet", zip: "69003", location_id: "desgenettes", spam_verdict: "too-fast", extras: null },
      { job: "blocked_drain", zip: "63130", location_id: "royat", spam_verdict: null, extras: '{"surface_m2":"40"}' },
    ]);
    check.close();
  });

  it("finishes a file the unversioned store left halfway", async () => {
    const path = tmp();
    unversioned(path, ["location_id"]);
    await openSqliteLeadStore(path).close();
    expect(columnsOf(path)).toEqual(ALL);
  });

  it("refuses a `leads` table it does not recognise instead of altering it, and closes behind the error", () => {
    const path = tmp();
    const db = new (sqlite().DatabaseSync)(path);
    db.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT)");
    db.close();
    expect(() => openSqliteLeadStore(path)).toThrow(/unrecognised table/);
    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(columnsOf(path)).toEqual(["id", "name"]);
  });
});
