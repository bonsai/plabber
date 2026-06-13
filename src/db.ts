import { Database } from "bun:sqlite";

export type EntryRow = {
  uid: string;
  title: string;
  url: string;
  published: string;
  summary: string;
  company: string;
  source: string;
};

export function openDb(): Database {
  const db = new Database(":memory:");
  db.exec(
    `CREATE TABLE IF NOT EXISTS entries (
      uid       TEXT PRIMARY KEY,
      title     TEXT NOT NULL DEFAULT '',
      url       TEXT NOT NULL DEFAULT '',
      published TEXT NOT NULL DEFAULT '',
      summary   TEXT NOT NULL DEFAULT '',
      company   TEXT NOT NULL DEFAULT '',
      source    TEXT NOT NULL DEFAULT ''
    )`
  );
  return db;
}

export function seedFromJson(db: Database, rows: unknown[]): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO entries (uid, title, url, published, summary, company, source)
     VALUES ($uid, $title, $url, $published, $summary, $company, $source)`
  );
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const e = row as Partial<EntryRow>;
    stmt.run({
      $uid: e.uid ?? crypto.randomUUID(),
      $title: e.title ?? "",
      $url: e.url ?? "",
      $published: e.published ?? "",
      $summary: e.summary ?? "",
      $company: e.company ?? "",
      $source: e.source ?? "",
    });
  }
}

export function upsertEntries(db: Database, rows: EntryRow[]): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO entries (uid, title, url, published, summary, company, source)
     VALUES ($uid, $title, $url, $published, $summary, $company, $source)`
  );
  for (const e of rows) {
    stmt.run({
      $uid: e.uid,
      $title: e.title,
      $url: e.url,
      $published: e.published,
      $summary: e.summary,
      $company: e.company,
      $source: e.source,
    });
  }
}

export function getAllEntries(db: Database): EntryRow[] {
  return db
    .query<EntryRow, []>(
      `SELECT uid, title, url, published, summary, company, source
       FROM entries ORDER BY published DESC, uid ASC`
    )
    .all();
}
