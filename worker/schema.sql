-- The Family Sync database (Turso / libSQL).
--
-- The worker does NOT create or migrate this schema: it assumes the tables
-- exist. Until now they existed only inside the live database, which meant a
-- lost or recreated database could not be rebuilt from this repository, and no
-- contributor could stand the service up locally. This file is that truth,
-- captured from the production database on 28 Aug 2026.
--
-- Apply with:
--   turso db shell <database> < worker/schema.sql
--
-- Every statement is IF NOT EXISTS, so running it against the live database is
-- a no-op rather than a risk.

-- One row per family. `token_hash` belongs to the creating device; per-device
-- tokens live in device_tokens. Raw tokens are never stored anywhere.
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Bearer tokens, stored only as SHA-256 hashes: a database leak must not hand
-- anyone a working key to a family's log.
CREATE TABLE IF NOT EXISTS device_tokens (
  family_id TEXT NOT NULL REFERENCES families(id),
  token_hash TEXT PRIMARY KEY,
  -- Which phone this key belongs to, so one can be revoked without
  -- disturbing the others. Null on rows minted before revocation existed;
  -- those can still hand themselves back, or be cleared by "sign out all".
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  label TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT
);

-- Six-digit pairing codes: short-lived and single-use, which is why both an
-- expiry and a used_at are kept rather than deleting the row.
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- The synced entries. The primary key is (family_id, id) so the same activity
-- id can exist in two families without collision, and `deleted` carries
-- tombstones so a deletion travels between phones like any other change.
CREATE TABLE IF NOT EXISTS activities (
  family_id TEXT NOT NULL REFERENCES families(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, id)
);

-- Every pull is "rows for this family newer than a cursor". Without this the
-- query degrades to a full scan as families accumulate.
CREATE INDEX IF NOT EXISTS idx_activities_family_updated
  ON activities(family_id, updated_at);

-- The family's shared baby profile, with the stamp that decides whose copy is
-- fresher when two phones disagree.
CREATE TABLE IF NOT EXISTS family_meta (
  family_id TEXT PRIMARY KEY REFERENCES families(id),
  profile TEXT,
  updated_at TEXT
);

-- Messages sent from the app's "need anything?" form. Deliberately thin: a
-- message, and a contact ONLY if the sender chose to give one. No family id,
-- no device id, nothing that ties a note back to a baby's log — someone
-- reporting a bug should not be handing over their child's records with it.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  message TEXT NOT NULL,
  contact TEXT,
  -- Which build it came from, so a fixed bug can be told from a live one.
  app_version TEXT,
  handled INTEGER NOT NULL DEFAULT 0
);
