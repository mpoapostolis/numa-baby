/// <reference types="@cloudflare/workers-types" />
import { WORKER_BUILD } from "./buildInfo";
// Everything the database can honestly say about the service.
//
// One rule survives the expansion, and it is the important one: this is an
// operations dashboard, not a window into anybody's child. Every row in
// `activities` is a health record about a real infant, and `family_meta`
// holds their name. So nothing here selects `payload`, nothing selects
// `profile`, and nothing selects a device label — labels are derived from a
// baby's name. Family ids are truncated to eight characters: enough to follow
// one family down a column, not enough to be a directory of who.
//
// The one thing derived from inside a payload is `$.type` — "how many of the
// entries in the whole service are feeds" — counted across every family at
// once and never per family. That is a shape, not a record.
//
// Everything else is counts, dates and buckets.

import type { Client } from "@libsql/client/web";

/** An ISO stamp `n` days ago, in exactly the format the tables store — the
    shorter `datetime()` returns a space where the rows have a T, which
    compares as a string by luck rather than by design. */
const ago = (days: number) => `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${days} days')`;
const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

export const TREND_DAYS = 30;

type Row = Record<string, unknown>;

async function safe(client: Client, sql: string): Promise<Row[]> {
  // A missing table (a database older than a feature) is an empty section on
  // the page, never a broken dashboard.
  return client
    .execute(sql)
    .then((result) => result.rows as unknown as Row[])
    .catch(() => []);
}

export async function collectStats(client: Client, now: number) {
  const [
    totals,
    activityByDay,
    familiesByDay,
    devicesByDay,
    retention,
    deviceFreshness,
    cohorts,
    spread,
    kinds,
    invites,
    hours,
    families,
    feedback,
    auditLog,
    lockouts,
    sessions,
    knownBrowsers,
  ] = await Promise.all([
    safe(
      client,
      `select
         (select count(*) from families) as families,
         (select count(*) from devices) as devices,
         (select count(*) from device_tokens) as keys,
         (select count(*) from activities) as entries,
         (select count(*) from activities where deleted = 1) as tombstones,
         (select count(*) from family_meta) as profiles,
         (select count(*) from feedback) as messages,
         (select count(*) from feedback where handled = 0) as messages_open,
         (select coalesce(sum(length(payload)), 0) from activities) as payload_bytes,
         (select count(*) from (select family_id from devices group by family_id having count(*) > 1)) as paired,
         (select count(distinct family_id) from activities where updated_at >= ${ago(1)}) as active_1d,
         (select count(distinct family_id) from activities where updated_at >= ${ago(7)}) as active_7d,
         (select count(distinct family_id) from activities where updated_at >= ${ago(30)}) as active_30d`,
    ),

    // Is anyone still here? Entries and distinct families, per day.
    safe(
      client,
      `select substr(updated_at, 1, 10) as day, count(*) as entries,
              count(distinct family_id) as families
       from activities where updated_at >= ${ago(TREND_DAYS - 1)}
       group by day order by day`,
    ),

    safe(
      client,
      `select substr(created_at, 1, 10) as day, count(*) as n
       from families where created_at >= ${ago(TREND_DAYS - 1)} group by day order by day`,
    ),

    safe(
      client,
      `select substr(joined_at, 1, 10) as day, count(*) as n
       from devices where joined_at >= ${ago(TREND_DAYS - 1)} group by day order by day`,
    ),

    // The honest retention picture: of every family that ever existed, when
    // did they last write anything?
    safe(
      client,
      `select
         count(*) as total,
         sum(case when last_at >= ${ago(1)} then 1 else 0 end) as d1,
         sum(case when last_at >= ${ago(7)} then 1 else 0 end) as d7,
         sum(case when last_at >= ${ago(30)} then 1 else 0 end) as d30,
         sum(case when last_at is null then 1 else 0 end) as never
       from (select f.id, (select max(a.updated_at) from activities a where a.family_id = f.id) as last_at
             from families f)`,
    ),

    safe(
      client,
      `select
         count(*) as total,
         sum(case when last_seen_at >= ${ago(1)} then 1 else 0 end) as d1,
         sum(case when last_seen_at >= ${ago(7)} then 1 else 0 end) as d7,
         sum(case when last_seen_at >= ${ago(30)} then 1 else 0 end) as d30,
         sum(case when last_seen_at is null then 1 else 0 end) as never
       from devices`,
    ),

    // Weekly cohorts — the only view that separates "people keep arriving"
    // from "people keep staying".
    safe(
      client,
      `select
         strftime('%Y-W%W', f.created_at) as week,
         min(substr(f.created_at, 1, 10)) as starts,
         count(*) as joined,
         sum(case when exists(select 1 from activities a
                              where a.family_id = f.id and a.updated_at >= ${ago(7)})
                  then 1 else 0 end) as active_7d,
         sum(case when (select count(*) from devices d where d.family_id = f.id) > 1
                  then 1 else 0 end) as paired,
         sum(case when exists(select 1 from activities a where a.family_id = f.id)
                  then 1 else 0 end) as ever_logged
       from families f group by week order by week desc limit 12`,
    ),

    // How deep does usage go? A service where everyone logs twice and leaves
    // looks identical to a healthy one in the totals.
    safe(
      client,
      `select
         sum(case when n = 0 then 1 else 0 end) as b0,
         sum(case when n between 1 and 9 then 1 else 0 end) as b1,
         sum(case when n between 10 and 49 then 1 else 0 end) as b10,
         sum(case when n between 50 and 199 then 1 else 0 end) as b50,
         sum(case when n between 200 and 999 then 1 else 0 end) as b200,
         sum(case when n >= 1000 then 1 else 0 end) as b1000,
         max(n) as most, avg(n) as mean
       from (select (select count(*) from activities a where a.family_id = f.id and a.deleted = 0) as n
             from families f)`,
    ),

    // Aggregate shape only: which features carry the service. Counted across
    // every family at once, never per family.
    safe(
      client,
      `select coalesce(json_extract(payload, '$.type'), 'unknown') as kind, count(*) as n
       from activities where deleted = 0 group by kind order by n desc limit 20`,
    ),

    safe(
      client,
      `select count(*) as total,
              sum(case when used_at is not null then 1 else 0 end) as used,
              sum(case when used_at is null and expires_at > ${NOW} then 1 else 0 end) as open,
              sum(case when used_at is null and expires_at <= ${NOW} then 1 else 0 end) as expired
       from invites`,
    ),

    // When are people awake with the baby? Local time is unknown, so this is
    // UTC — still useful for reading the night shift.
    safe(
      client,
      `select substr(updated_at, 12, 2) as hour, count(*) as n
       from activities where updated_at >= ${ago(30)} group by hour order by hour`,
    ),

    // Per family: size and recency. No labels, no payloads, no profile — only
    // whether one exists.
    safe(
      client,
      `select
         substr(f.id, 1, 8) as family,
         substr(f.created_at, 1, 10) as created,
         (select count(*) from devices d where d.family_id = f.id) as devices,
         (select count(*) from activities a where a.family_id = f.id and a.deleted = 0) as entries,
         (select count(*) from activities a where a.family_id = f.id and a.deleted = 1) as deleted,
         (select substr(min(a.updated_at), 1, 10) from activities a where a.family_id = f.id) as first_entry,
         (select substr(max(a.updated_at), 1, 16) from activities a where a.family_id = f.id) as last_entry,
         (select substr(max(d.last_seen_at), 1, 16) from devices d where d.family_id = f.id) as last_seen,
         (select count(*) from family_meta m where m.family_id = f.id and m.profile is not null) as has_profile
       from families f order by f.created_at desc limit 500`,
    ),

    safe(
      client,
      `select id, substr(created_at, 1, 16) as sent, message, contact, app_version, handled
       from feedback order by created_at desc limit 200`,
    ),

    safe(
      client,
      `select substr(at, 1, 19) as at, event, ip, country, asn, user_agent
       from admin_audit order by id desc limit 60`,
    ),

    safe(
      client,
      `select scope, failures, strikes, substr(window_start, 1, 19) as window_start,
              substr(locked_until, 1, 19) as locked_until
       from admin_lockouts where locked_until is not null and locked_until > ${NOW}
       order by locked_until desc limit 40`,
    ),

    safe(
      client,
      `select substr(created_at, 1, 16) as created, substr(expires_at, 1, 16) as expires,
              substr(last_seen_at, 1, 16) as last_seen, ip, country, user_agent
       from admin_sessions where expires_at > ${NOW} order by created_at desc limit 20`,
    ),

    safe(
      client,
      `select substr(created_at, 1, 10) as trusted, substr(last_seen_at, 1, 16) as last_seen,
              ip, country, user_agent
       from admin_known where expires_at > ${NOW} order by last_seen_at desc limit 20`,
    ),
  ]);

  // The median is the one figure SQLite will not give cheaply, and it is the
  // one that says most about a long tail — so it is computed here from the
  // per-family counts already fetched.
  const counts = families.map((f) => Number(f.entries ?? 0)).sort((a, b) => a - b);
  const median = counts.length
    ? counts.length % 2
      ? counts[(counts.length - 1) / 2]
      : Math.round((counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2)
    : 0;

  return {
    totals: totals[0] ?? {},
    invites: invites[0] ?? {},
    retention: retention[0] ?? {},
    deviceFreshness: deviceFreshness[0] ?? {},
    spread: { ...(spread[0] ?? {}), median },
    activityByDay,
    familiesByDay,
    devicesByDay,
    cohorts,
    kinds,
    hours,
    families,
    feedback,
    auditLog,
    lockouts,
    sessions,
    knownBrowsers,
    trendDays: TREND_DAYS,
    workerBuild: WORKER_BUILD,
    generatedAt: new Date(now).toISOString(),
  };
}
