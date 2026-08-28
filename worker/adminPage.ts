/// <reference types="@cloudflare/workers-types" />
// The operator's page: one file, no bundle, no framework, no third-party
// request. It is served with a per-request nonce and a content policy that
// forbids loading anything at all from anywhere — which is easy to promise
// when the page has no dependencies to load.

export function adminPageHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Numa — service</title>
<style nonce="${nonce}">
  :root {
    color-scheme: light dark;
    --bg:#fdf5f2; --card:#fffdfc; --ink:#221a1d; --ink-2:#6b5a60; --ink-3:#9c8a90;
    --line:#efdfd9; --signal:#8d2f57; --signal-2:#c98aa4; --good:#2f7d55; --warn:#a8631a; --bad:#b3261e;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#120c0f; --card:#1b1418; --ink:#f4e9ec; --ink-2:#b3a0a7; --ink-3:#7d6b72;
            --line:#33262b; --signal:#f0a8c0; --signal-2:#7a4359; --good:#7fd0a2; --warn:#e0a860; --bad:#f0938c; }
  }
  * { box-sizing:border-box; }
  body { margin:0; padding:20px 16px 64px; background:var(--bg); color:var(--ink);
    font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing:antialiased; }
  main { max-width:1080px; margin:0 auto; display:grid; gap:16px; }
  h1 { font-size:1.25rem; margin:0; font-weight:600; letter-spacing:-.01em; }
  h2 { font-size:.75rem; margin:0 0 12px; font-weight:600; text-transform:uppercase;
    letter-spacing:.08em; color:var(--ink-2); }
  .muted { color:var(--ink-2); font-size:.8125rem; margin:0; }
  .tiny { color:var(--ink-3); font-size:.6875rem; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:14px; }
  .stat b { display:block; font-size:1.7rem; font-weight:650; line-height:1.15;
    font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
  .stat span { color:var(--ink-2); font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; }
  .stat small { display:block; color:var(--ink-3); font-size:.6875rem; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  th { text-align:left; font-size:.66rem; text-transform:uppercase; letter-spacing:.06em;
    color:var(--ink-3); font-weight:600; padding:4px 8px; white-space:nowrap; }
  td { padding:7px 8px; border-top:1px solid var(--line); font-size:.8125rem; white-space:nowrap; }
  td.num, th.num { text-align:right; }
  .scroll { overflow-x:auto; }
  input, button, select { font:inherit; border-radius:10px; border:1px solid var(--line); padding:11px 13px; }
  input { width:100%; background:var(--bg); color:var(--ink); font-size:16px; }
  button { background:var(--signal); color:#fff; border:0; font-weight:550; cursor:pointer; min-height:44px; }
  button.ghost { background:transparent; color:var(--ink-2); border:1px solid var(--line); min-height:36px;
    padding:6px 12px; font-size:.8125rem; font-weight:500; }
  button.ghost:hover { color:var(--ink); border-color:var(--ink-3); }
  .row { display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
  .tools { display:flex; gap:8px; flex-wrap:wrap; }
  .bars { display:flex; align-items:flex-end; gap:2px; height:78px; }
  /* One column per day. A column holds one or two bars, each scaled against
     its own series — mixing two scales in one stacked bar would say something
     that is not true. */
  .bars i { flex:1; height:100%; display:flex; align-items:flex-end; gap:1px; }
  .bars u { flex:1; display:block; min-height:2px; border-radius:3px 3px 0 0;
    background:var(--signal); opacity:.85; }
  .bars u.b { background:var(--signal-2); opacity:1; }
  .key { display:flex; gap:14px; margin-top:8px; }
  .key span { display:flex; align-items:center; gap:6px; color:var(--ink-3); font-size:.6875rem; }
  .key i { width:9px; height:9px; border-radius:2px; background:var(--signal); opacity:.85; }
  .key i.b { background:var(--signal-2); opacity:1; }
  .axis { display:flex; justify-content:space-between; margin-top:6px; }
  .split { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
  .meter { display:grid; gap:7px; }
  .meter div { display:grid; grid-template-columns:104px 1fr auto; gap:10px; align-items:center;
    font-size:.8125rem; }
  .meter span:first-child { color:var(--ink-2); }
  .meter u { display:block; height:8px; border-radius:99px; background:var(--signal); opacity:.85; min-width:2px; }
  .track { background:color-mix(in oklab, var(--signal) 12%, transparent); border-radius:99px; }
  .msg { border-top:1px solid var(--line); padding:12px 0; display:grid; gap:5px; }
  .msg:first-child { border-top:0; padding-top:0; }
  .msg p { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .pill { display:inline-block; padding:1px 8px; border-radius:99px; font-size:.6875rem;
    border:1px solid var(--line); color:var(--ink-2); }
  .pill.ok { color:var(--good); border-color:color-mix(in oklab, var(--good) 40%, transparent); }
  .pill.bad { color:var(--bad); border-color:color-mix(in oklab, var(--bad) 40%, transparent); }
  .err { color:var(--bad); font-size:.8125rem; margin:10px 0 0; }
  .hide { display:none !important; }
  .fieldset { display:grid; gap:10px; margin-top:12px; }
  .foot { text-align:center; }
</style>
</head>
<body>
<main>
  <div class="row">
    <div>
      <h1>Numa · service</h1>
      <p class="muted" id="sub">Aggregate only — no entry contents, no names.</p>
    </div>
    <div class="tools hide" id="tools">
      <button class="ghost" id="refresh">Refresh</button>
      <button class="ghost" id="copy">Copy JSON</button>
      <button class="ghost" id="out">Sign out</button>
      <button class="ghost" id="outall">Sign out everywhere</button>
    </div>
  </div>

  <form id="login" class="card" style="max-width:420px">
    <h2>Sign in</h2>
    <div class="fieldset">
      <div>
        <label class="tiny" for="pw">Password</label>
        <input id="pw" type="password" autocomplete="current-password" autofocus />
      </div>
      <div>
        <label class="tiny" for="code">One-time code <span style="opacity:.7">(only if enabled)</span></label>
        <input id="code" type="text" inputmode="numeric" autocomplete="one-time-code"
               maxlength="6" pattern="[0-9]*" />
      </div>
      <button id="go">Sign in</button>
    </div>
    <p id="err" class="err hide"></p>
  </form>

  <div id="dash" class="hide" style="display:grid;gap:16px"></div>
  <p class="muted foot" id="stamp"></p>
  <p class="tiny foot">Who and where lives in
    <a href="https://analytics.google.com/analytics/web/" rel="noreferrer noopener"
       style="color:var(--signal)">Google Analytics</a> — this page is the database.</p>
</main>
<script nonce="${nonce}">
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  };
  var n = function (v) { return Number(v || 0).toLocaleString("en-GB"); };
  var pct = function (a, b) { return b ? Math.round((a / b) * 100) + "%" : "—"; };
  var bytes = function (v) {
    v = Number(v || 0);
    if (v < 1024) return v + " B";
    if (v < 1048576) return (v / 1024).toFixed(1) + " KB";
    return (v / 1048576).toFixed(1) + " MB";
  };
  var last = null;
  var timer = null;

  function stat(label, value, note) {
    return '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span>' +
      (note ? '<small>' + esc(note) + '</small>' : '') + '</div>';
  }

  // A column per day, and where a second series is given, a second bar beside
  // the first. Each is scaled against its own maximum, because the question
  // "was this a busy week" and the question "was it busy for more than one
  // household" have different answers and deserve different bars.
  function barChart(rows, key, second, labelKey, names) {
    if (!rows.length) return '<p class="muted">Nothing yet.</p>';
    var maxA = 1, maxB = 1, i;
    for (i = 0; i < rows.length; i++) {
      maxA = Math.max(maxA, Number(rows[i][key] || 0));
      if (second) maxB = Math.max(maxB, Number(rows[i][second] || 0));
    }
    var out = '<div class="bars">';
    for (i = 0; i < rows.length; i++) {
      var a = Number(rows[i][key] || 0);
      var b = second ? Number(rows[i][second] || 0) : 0;
      var title = rows[i][labelKey] + ": " + a + (second ? " · " + b + " families" : "");
      out += '<i title="' + esc(title) + '">' +
        '<u style="height:' + Math.max(2, Math.round((a / maxA) * 100)) + '%"></u>' +
        (second ? '<u class="b" style="height:' + Math.max(2, Math.round((b / maxB) * 100)) + '%"></u>' : '') +
        '</i>';
    }
    out += '</div>';
    if (second && names) {
      out += '<div class="key"><span><i></i>' + esc(names[0]) + '</span>' +
        '<span><i class="b"></i>' + esc(names[1]) + '</span></div>';
    }
    return out;
  }

  function meter(pairs, total) {
    var out = '<div class="meter">';
    var max = 1;
    for (var i = 0; i < pairs.length; i++) max = Math.max(max, Number(pairs[i][1] || 0));
    for (i = 0; i < pairs.length; i++) {
      var v = Number(pairs[i][1] || 0);
      out += '<div><span>' + esc(pairs[i][0]) + '</span>' +
        '<span class="track"><u style="width:' + Math.max(1, Math.round((v / max) * 100)) + '%"></u></span>' +
        '<span>' + n(v) + (total ? ' <span class="tiny">' + pct(v, total) + '</span>' : '') + '</span></div>';
    }
    return out + '</div>';
  }

  function table(head, rows, cells) {
    if (!rows.length) return '<p class="muted">Nothing yet.</p>';
    var out = '<div class="scroll"><table><thead><tr>';
    for (var h = 0; h < head.length; h++) {
      out += '<th' + (head[h].num ? ' class="num"' : '') + '>' + esc(head[h].label || head[h]) + '</th>';
    }
    out += '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) out += '<tr>' + cells(rows[r]) + '</tr>';
    return out + '</tbody></table></div>';
  }

  function render(d) {
    var t = d.totals || {}, ret = d.retention || {}, sp = d.spread || {}, inv = d.invites || {};
    var df = d.deviceFreshness || {};
    var parts = [];

    parts.push('<div class="card"><h2>Pulse</h2><div class="grid">' +
      stat("Families", n(t.families), n(t.paired) + " with 2+ phones") +
      stat("Devices", n(t.devices), n(df.d7) + " seen this week") +
      stat("Entries", n(t.entries), n(t.tombstones) + " deleted") +
      stat("Active 7d", n(t.active_7d), pct(t.active_7d, t.families) + " of families") +
      stat("Messages", n(t.messages), n(t.messages_open) + " unread") +
      stat("Stored", bytes(t.payload_bytes), n(t.profiles) + " profiles") +
      '</div></div>');

    parts.push('<div class="card"><h2>Entries synced · last ' + d.trendDays + ' days</h2>' +
      barChart(d.activityByDay, "entries", "families", "day", ["entries", "families logging"]) +
      '<div class="axis tiny"><span>' + esc((d.activityByDay[0] || {}).day || "") + '</span>' +
      '<span>' + esc((d.activityByDay[d.activityByDay.length - 1] || {}).day || "") + '</span></div>' +
      '<p class="tiny" style="margin:8px 0 0">Active families: ' + n(t.active_1d) + ' today · ' +
      n(t.active_7d) + ' this week · ' + n(t.active_30d) + ' this month.</p></div>');

    parts.push('<div class="split">' +
      '<div class="card"><h2>New families · ' + d.trendDays + ' days</h2>' +
        barChart(d.familiesByDay, "n", null, "day") + '</div>' +
      '<div class="card"><h2>Phones paired · ' + d.trendDays + ' days</h2>' +
        barChart(d.devicesByDay, "n", null, "day") + '</div>' +
      '</div>');

    parts.push('<div class="split">' +
      '<div class="card"><h2>Are they still here?</h2>' +
        meter([["Logged today", ret.d1], ["This week", ret.d7], ["This month", ret.d30],
               ["Never logged", ret.never]], ret.total) +
        '<p class="tiny" style="margin:10px 0 0">Out of ' + n(ret.total) + ' families ever created.</p></div>' +
      '<div class="card"><h2>How much do they log?</h2>' +
        meter([["Nothing", sp.b0], ["1–9", sp.b1], ["10–49", sp.b10], ["50–199", sp.b50],
               ["200–999", sp.b200], ["1000+", sp.b1000]]) +
        '<p class="tiny" style="margin:10px 0 0">Median ' + n(sp.median) + ' · mean ' +
        n(Math.round(Number(sp.mean || 0))) + ' · most ' + n(sp.most) + '.</p></div>' +
      '</div>');

    parts.push('<div class="card"><h2>Weekly cohorts</h2>' +
      table([{ label: "Week" }, { label: "From" }, { label: "Families", num: 1 },
             { label: "Ever logged", num: 1 }, { label: "Paired", num: 1 }, { label: "Active 7d", num: 1 }],
        d.cohorts, function (c) {
          return '<td>' + esc(c.week) + '</td><td>' + esc(c.starts) + '</td>' +
            '<td class="num">' + n(c.joined) + '</td>' +
            '<td class="num">' + n(c.ever_logged) + ' <span class="tiny">' + pct(c.ever_logged, c.joined) + '</span></td>' +
            '<td class="num">' + n(c.paired) + '</td>' +
            '<td class="num">' + n(c.active_7d) + ' <span class="tiny">' + pct(c.active_7d, c.joined) + '</span></td>';
        }) + '</div>');

    var kindTotal = 0;
    for (var k = 0; k < d.kinds.length; k++) kindTotal += Number(d.kinds[k].n || 0);
    parts.push('<div class="split">' +
      '<div class="card"><h2>What gets logged</h2>' +
        meter(d.kinds.map(function (x) { return [x.kind, x.n]; }), kindTotal) +
        '<p class="tiny" style="margin:10px 0 0">Entry type only, counted across every family at once.</p></div>' +
      '<div class="card"><h2>Hour of day · UTC · 30 days</h2>' +
        barChart(d.hours, "n", null, "hour") +
        '<div class="axis tiny"><span>00</span><span>12</span><span>23</span></div></div>' +
      '</div>');

    parts.push('<div class="split">' +
      '<div class="card"><h2>Pairing</h2>' +
        meter([["Codes made", inv.total], ["Used", inv.used], ["Expired unused", inv.expired],
               ["Open now", inv.open]], inv.total) +
        '<p class="tiny" style="margin:10px 0 0">' + pct(inv.used, inv.total) +
        ' of invite codes were scanned.</p></div>' +
      '<div class="card"><h2>Phones</h2>' +
        meter([["Seen today", df.d1], ["This week", df.d7], ["This month", df.d30],
               ["Never synced", df.never]], df.total) +
        '<p class="tiny" style="margin:10px 0 0">' + n(t.keys) + ' keys issued for ' +
        n(df.total) + ' phones.</p></div>' +
      '</div>');

    if (d.feedback.length) {
      var msgs = "";
      for (var m = 0; m < d.feedback.length; m++) {
        var f = d.feedback[m];
        msgs += '<div class="msg"><div class="tiny">' + esc(f.sent) +
          (f.contact ? ' · <b>' + esc(f.contact) + '</b>' : ' · no contact') +
          (f.app_version ? ' · build ' + esc(f.app_version) : '') + '</div>' +
          '<p>' + esc(f.message) + '</p>' +
          '<div><button class="ghost mark" data-id="' + esc(f.id) + '" data-to="' +
          (Number(f.handled) ? 0 : 1) + '">' +
          (Number(f.handled) ? 'Handled ✓ — undo' : 'Mark handled') + '</button></div></div>';
      }
      parts.push('<div class="card"><h2>Messages · ' + d.feedback.length + '</h2>' + msgs + '</div>');
    }

    parts.push('<div class="card"><h2>Families · ' + d.families.length + '</h2>' +
      table([{ label: "Id" }, { label: "Created" }, { label: "Phones", num: 1 },
             { label: "Entries", num: 1 }, { label: "Deleted", num: 1 },
             { label: "First" }, { label: "Last entry" }, { label: "Profile" }],
        d.families, function (f) {
          return '<td>' + esc(f.family) + '</td><td>' + esc(f.created) + '</td>' +
            '<td class="num">' + n(f.devices) + '</td><td class="num">' + n(f.entries) + '</td>' +
            '<td class="num">' + n(f.deleted) + '</td>' +
            '<td>' + esc(f.first_entry || "—") + '</td><td>' + esc(f.last_entry || "—") + '</td>' +
            '<td>' + (Number(f.has_profile) ? "yes" : "—") + '</td>';
        }) + '</div>');

    var sec = '<div class="card"><h2>Who has been at this door</h2>';
    if (d.lockouts.length) {
      sec += '<p class="muted" style="margin-bottom:8px">Locked out right now</p>' +
        table([{ label: "Scope" }, { label: "Strikes", num: 1 }, { label: "Until" }],
          d.lockouts, function (l) {
            return '<td>' + esc(l.scope) + '</td><td class="num">' + n(l.strikes) + '</td>' +
              '<td>' + esc(l.locked_until) + '</td>';
          });
    }
    sec += '<p class="muted" style="margin:14px 0 8px">Open sessions</p>' +
      table([{ label: "Signed in" }, { label: "Last seen" }, { label: "Expires" },
             { label: "From" }, { label: "Browser" }],
        d.sessions, function (s) {
          return '<td>' + esc(s.created) + '</td><td>' + esc(s.last_seen || "—") + '</td>' +
            '<td>' + esc(s.expires) + '</td>' +
            '<td>' + esc(s.ip) + ' ' + esc(s.country) + '</td>' +
            '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis">' +
            esc(s.user_agent || "—") + '</td>';
        });
    sec += '<p class="muted" style="margin:14px 0 8px">Recent attempts</p>' +
      table([{ label: "When" }, { label: "Event" }, { label: "From" }, { label: "AS" }],
        d.auditLog, function (a) {
          var ok = String(a.event).indexOf("ok") >= 0;
          return '<td>' + esc(a.at) + '</td>' +
            '<td><span class="pill ' + (ok ? 'ok' : (String(a.event).indexOf('bad') >= 0 ||
              String(a.event).indexOf('lock') >= 0 ? 'bad' : '')) + '">' + esc(a.event) + '</span></td>' +
            '<td>' + esc(a.ip) + ' ' + esc(a.country) + '</td><td>' + esc(a.asn || "—") + '</td>';
        });
    parts.push(sec + '</div>');

    $("dash").innerHTML = parts.join("");
    $("stamp").textContent = "Generated " + d.generatedAt + " · refreshes every minute";

    var marks = document.querySelectorAll(".mark");
    for (var i = 0; i < marks.length; i++) {
      marks[i].addEventListener("click", function (e) {
        var b = e.currentTarget;
        fetch("/api/admin/feedback", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: b.getAttribute("data-id"), handled: Number(b.getAttribute("data-to")) })
        }).then(load);
      });
    }
  }

  function load() {
    return fetch("/api/admin/stats").then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (d) {
        last = d;
        render(d);
        $("login").style.display = "none";
        $("dash").className = "";
        $("tools").className = "tools";
        $("sub").textContent = "Aggregate only — no entry contents, no names.";
        if (!timer) timer = setInterval(function () { load(); }, 60000);
        return true;
      });
    }).catch(function () { return false; });
  }

  $("login").addEventListener("submit", function (e) {
    e.preventDefault();
    $("go").disabled = true;
    fetch("/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("pw").value, code: $("code").value })
    }).then(function (res) {
      $("go").disabled = false;
      if (res.ok) { $("pw").value = ""; $("code").value = ""; $("err").className = "err hide"; load(); return; }
      return res.json().catch(function () { return {}; }).then(function (body) {
        $("err").textContent = body.error || "That did not work.";
        $("err").className = "err";
      });
    }).catch(function () { $("go").disabled = false; });
  });

  function signOut(all) {
    fetch("/api/admin/logout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: !!all })
    }).then(function () { location.reload(); });
  }
  $("out").addEventListener("click", function () { signOut(false); });
  $("outall").addEventListener("click", function () { signOut(true); });
  $("refresh").addEventListener("click", function () { load(); });
  $("copy").addEventListener("click", function () {
    if (last) navigator.clipboard.writeText(JSON.stringify(last, null, 2));
  });

  load();
})();
</script>
</body>
</html>`;
}
