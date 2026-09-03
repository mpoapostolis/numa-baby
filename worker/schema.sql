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
-- Two clocks on purpose: updated_at is the CLIENT's stamp and decides LWW
-- conflicts; received_at is the SERVER's arrival stamp and decides what a
-- pull has already seen — a restored backup pushes rows stamped months ago,
-- and only the arrival clock lets partners still receive them. (Live tables
-- gained received_at via a lazy ALTER in worker/index.ts.)
CREATE TABLE IF NOT EXISTS activities (
  family_id TEXT NOT NULL REFERENCES families(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  received_at TEXT,
  PRIMARY KEY (family_id, id)
);

-- Every pull is "rows for this family newer than a cursor". Without this the
-- query degrades to a full scan as families accumulate.
CREATE INDEX IF NOT EXISTS idx_activities_family_updated
  ON activities(family_id, updated_at);

-- Pulls filter on the ARRIVAL clock; this is the index that makes an empty
-- 60-second poll cost an index probe instead of the family's whole log.
CREATE INDEX IF NOT EXISTS idx_activities_family_received
  ON activities(family_id, received_at);

-- Pull pages are ordered by (received_at, id) so that rows sharing an arrival
-- stamp — every row the one-time backfill touched shares one — page through
-- instead of repeating. This index is that order.
CREATE INDEX IF NOT EXISTS idx_activities_family_received_id
  ON activities(family_id, received_at, id);

-- The lookups the device, invite and recovery paths actually make. Small
-- tables today; indexed so they stay cheap when they are not.
CREATE INDEX IF NOT EXISTS idx_devices_family ON devices(family_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_family ON device_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_invites_family ON invites(family_id);

-- The 6-digit invite space is a million codes in a 15-minute window — fine
-- against fingers, farmable by a loop. Thirty tries an hour per address
-- (the first 64 bits of an IPv6 address count as one), plus one budget for
-- the whole door under the key "global" — wrong codes only — so buying more
-- addresses buys nothing.
CREATE TABLE IF NOT EXISTS join_budget (
  ip TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  tries INTEGER NOT NULL
);

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

-- ---------------------------------------------------------------------------
-- The operator's door. These four are created by the worker on first use as
-- well, so an older database heals itself; they are written down here for the
-- same reason as everything above — a database that cannot be rebuilt from
-- this repository is a database held hostage by itself.

-- A signed-in browser. Only the hash of the cookie is kept, so a leak of this
-- table hands nobody a working session, and "sign out everywhere" is a DELETE
-- rather than a hope.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  ip TEXT, country TEXT, user_agent TEXT
);

-- The thing that actually stops a brute force. One row per address plus one
-- row for the endpoint as a whole, so buying more addresses buys fewer extra
-- guesses than it looks. `strikes` never resets, which is what makes the lock
-- double instead of forgiving a patient attacker every fifteen minutes.
CREATE TABLE IF NOT EXISTS admin_lockouts (
  scope TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  locked_until TEXT
);

-- Every knock at the door, right or wrong, so the dashboard can show who has
-- been trying. No password is ever recorded, correct or otherwise.
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  event TEXT NOT NULL,
  ip TEXT, country TEXT, asn TEXT, user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_at ON admin_audit(at);

-- Browsers that have signed in here before. Being on this list buys exactly
-- one thing — the lockout is skipped — and it is what stops the lockout from
-- becoming a way for a stranger to shut the owner out of their own dashboard.
-- It is not a way in: the password is still asked for, and still has to be
-- right. Stored as a hash, so the table is not a set of keys.
CREATE TABLE IF NOT EXISTS admin_known (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  ip TEXT, country TEXT, user_agent TEXT
);

-- "Continue with Google": one Google account may guard one family. The sub
-- is Google's stable account id (survives an email change); the email is
-- kept for showing the person which address guards their log. Nothing else
-- from Google is stored, ever.
CREATE TABLE IF NOT EXISTS recovery_identities (
  google_sub TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recovery_identities_family ON recovery_identities(family_id);

-- Magic-link recovery: which address guards which family, the outstanding
-- one-time tokens (hashes only), and the per-address send budget. The
-- worker modules create these lazily with IDENTICAL DDL; this file is the
-- canonical record.
CREATE TABLE IF NOT EXISTS recovery_emails (
  email TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recovery_emails_family ON recovery_emails(family_id);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  family_id TEXT,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS magic_budget (
  email TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  sends INTEGER NOT NULL
);

-- The admin dashboard's heavy statistics. Computed by the NIGHTLY CRON (see
-- the trigger in wrangler.jsonc) and read from here by every page load, tab
-- and refresh — a dashboard load runs no statistics at all. Seven loads once
-- cost ~790k row reads in six hours.
--
-- Two kinds of row: 'heavy' is what the page reads, and 'day:YYYY-MM-DD' is
-- that night's snapshot, kept 90 days, so the report can say what changed
-- since yesterday without asking the database anything extra.
CREATE TABLE IF NOT EXISTS stats_cache (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  computed_at TEXT NOT NULL
);

-- One row per phone that asked to be reminded. Created by the worker on
-- first use as well; written down here for the same reason as everything
-- above.
--
-- THIS TABLE IS AN ALARM CLOCK, NOT A LOG. It holds a push endpoint, its two
-- keys, and up to two future timestamps. No family id, no device id, no
-- baby, no entry — a phone tells the server WHEN to ring and nothing about
-- why, which is what keeps reminders compatible with an app whose entries
-- never leave the phone unless Family Sync is on.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Null means that reminder is off. Cleared the moment it is sent.
  feed_due_at TEXT,
  diaper_due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0
);

-- The cron asks one question every five minutes: what is due?
CREATE INDEX IF NOT EXISTS idx_push_feed_due ON push_subscriptions(feed_due_at);
CREATE INDEX IF NOT EXISTS idx_push_diaper_due ON push_subscriptions(diaper_due_at);
