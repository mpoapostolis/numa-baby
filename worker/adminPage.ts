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
    --bg:#fdf5f2; --card:#fffdfc; --field:#fff; --ink:#221a1d; --ink-2:#6b5a60; --ink-3:#9c8a90;
    --line:#e8d6cf; --signal:#8d2f57; --signal-2:#c98aa4; --on-signal:#fff;
    --good:#2f7d55; --warn:#a8631a; --bad:#b3261e;
  }
  /* Dark is not "the same page with the lights off": the card has to lift off
     the background and a text field has to look like somewhere you can type,
     which needs its own fill rather than the page's. */
  @media (prefers-color-scheme: dark) {
    :root { --bg:#100b0d; --card:#1e1519; --field:#2a1f24; --ink:#f4e9ec; --ink-2:#b3a0a7; --ink-3:#8a767d;
            --line:#3b2c32; --signal:#f0a8c0; --signal-2:#8d5069; --on-signal:#241017;
            --good:#7fd0a2; --warn:#e0a860; --bad:#f0938c; }
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
  /* The report reads before it counts, so its sentences get the room. */
  .report ul { margin:0 0 16px; padding:0 0 0 18px; display:grid; gap:8px; }
  .report li { line-height:1.5; }
  .report b { font-weight:600; font-variant-numeric:tabular-nums; }
  .report em { font-style:normal; font-size:.8125rem; font-weight:600; padding:1px 6px;
    border-radius:999px; margin-left:2px; }
  .report em.up { color:var(--good); background:color-mix(in oklab, var(--good) 14%, transparent); }
  .report em.down { color:var(--bad); background:color-mix(in oklab, var(--bad) 14%, transparent); }
  .report em.flat { color:var(--ink-3); background:color-mix(in oklab, var(--ink-3) 14%, transparent); }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:14px; }

  /* A ten-thousand-pixel page needs signposts. Each band names what the cards
     under it are for, so the wall of identical cards stops being a wall. */
  .band { display:flex; align-items:center; gap:12px; margin:14px 2px 0; }
  .band h3 { margin:0; font-size:.6875rem; font-weight:600; text-transform:uppercase;
    letter-spacing:.1em; color:var(--ink-3); white-space:nowrap; }
  .band hr { flex:1; height:1px; border:0; background:var(--line); }

  /* The cohort grid. Colour carries the percentage so a bad month is visible
     before a single figure has been read; the number stays, because colour
     alone is never the answer. */
  .heat td.h { position:relative; text-align:right; }
  .heat td.h u { position:absolute; inset:3px 4px; border-radius:6px; display:block;
    background:var(--signal); }
  .heat td.h span { position:relative; }
  .heat td.h b { font-weight:600; font-variant-numeric:tabular-nums; }
  .heat td.h i { font-style:normal; color:var(--ink-3); font-size:.6875rem; margin-left:5px; }

  /* Night is the shift this app is for, so the chart says where it is. */
  .bars { position:relative; }
  .bars .night { position:absolute; top:0; bottom:0; background:color-mix(in oklab, var(--ink) 5%, transparent);
    border-radius:4px; pointer-events:none; }
  .peak { color:var(--ink-3); font-size:.6875rem; margin:6px 0 0; }
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
  /* A sortable header is a button that still looks like a header. The arrow
     is the state, and the inactive one is a hint that the column can move. */
  th .sortby { background:none; border:0; padding:0; min-height:0; color:inherit; font:inherit;
    cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
  th .sortby:hover { color:var(--ink); filter:none; }
  th .sortby i { font-style:normal; opacity:.35; font-size:.8em; }
  th .sortby.on { color:var(--signal); }
  th .sortby.on i { opacity:1; }
  th.num .sortby { flex-direction:row-reverse; }
  .filter { margin-bottom:10px; max-width:280px; font-size:.875rem; padding:8px 11px; }
  input, button, select { font:inherit; border-radius:10px; border:1px solid var(--line); padding:11px 13px; }
  input { width:100%; background:var(--field); color:var(--ink); font-size:16px; }
  input:focus-visible { outline:2px solid color-mix(in oklab, var(--signal) 55%, transparent);
    outline-offset:1px; border-color:var(--signal); }
  button { background:var(--signal); color:var(--on-signal); border:0; font-weight:600; cursor:pointer; min-height:46px; }
  button:hover { filter:brightness(1.06); }

  /* The sign-in screen is its own screen, not a card stranded at the top of an
     empty page. */
  .gate { min-height:72vh; display:grid; place-items:center; }
  .gate .card { width:100%; max-width:372px; padding:24px; }
  .brand { display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:600;
    letter-spacing:-.01em; }
  .brand svg { flex:0 0 30px; color:var(--signal); }
  .field { display:grid; gap:6px; }
  .field > span { font-size:.75rem; font-weight:500; color:var(--ink-2); }
  .link { background:none; border:0; padding:6px 0; min-height:0; color:var(--ink-2);
    font-size:.8125rem; font-weight:500; text-decoration:underline; text-underline-offset:3px;
    cursor:pointer; justify-self:center; }
  .link:hover { color:var(--ink); filter:none; }
  button.ghost { background:transparent; color:var(--ink-2); border:1px solid var(--line); min-height:36px;
    padding:6px 12px; font-size:.8125rem; font-weight:500; }
  button.ghost:hover { color:var(--ink); border-color:var(--ink-3); }
  .row { display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
  /* The tools were at the top of a page ten screens tall: to refresh, you
     scrolled back. */
  #head { position:sticky; top:0; z-index:5; margin:-20px -16px 0; padding:12px 16px;
    background:color-mix(in oklab, var(--bg) 88%, transparent);
    border-bottom:1px solid var(--line); backdrop-filter:blur(8px); }
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
  .msg { border-top:1px solid var(--line); padding:14px 0; display:grid; gap:8px; }
  .msg:first-child { border-top:0; padding-top:0; }
  .msg p { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  /* A conversation reads like one: theirs on the left, yours on the right. */
  .bub { max-width:640px; padding:9px 12px; border-radius:14px 14px 14px 4px; display:grid; gap:3px;
    background:color-mix(in oklab, var(--ink) 6%, transparent); justify-self:start; }
  .bub.me { justify-self:end; border-radius:14px 14px 4px 14px;
    background:color-mix(in oklab, var(--signal) 13%, transparent); }
  .reply { display:grid; gap:8px; margin-top:2px; }
  textarea { width:100%; min-height:84px; resize:vertical; background:var(--field); color:var(--ink);
    font:inherit; font-size:16px; border-radius:10px; border:1px solid var(--line); padding:11px 13px; }
  textarea:focus-visible { outline:2px solid color-mix(in oklab, var(--signal) 55%, transparent);
    outline-offset:1px; border-color:var(--signal); }
  .reply .row { justify-content:flex-start; }
  .reply label { display:inline-flex; gap:7px; align-items:center; font-size:.8125rem; color:var(--ink-2); }
  .reply input[type=checkbox] { width:18px; height:18px; padding:0; accent-color:var(--signal); }
  .reply button.send { min-height:40px; padding:8px 16px; }
  .note-ok { color:var(--good); }
  .note-bad { color:var(--bad); }
  .pill { display:inline-block; padding:1px 8px; border-radius:99px; font-size:.6875rem;
    border:1px solid var(--line); color:var(--ink-2); }
  .pill.ok { color:var(--good); border-color:color-mix(in oklab, var(--good) 40%, transparent); }
  .pill.bad { color:var(--bad); border-color:color-mix(in oklab, var(--bad) 40%, transparent); }
  .err { color:var(--bad); font-size:.8125rem; margin:0; padding:10px 12px; border-radius:10px;
    background:color-mix(in oklab, var(--bad) 10%, transparent);
    border:1px solid color-mix(in oklab, var(--bad) 30%, transparent); }
  .hide { display:none !important; }
  .fieldset { display:grid; gap:10px; margin-top:12px; }
  .foot { text-align:center; }
</style>
</head>
<body>
<main>
  <div class="row hide" id="head">
    <div>
      <h1>Numa · service</h1>
      <p class="muted" id="sub">Aggregate only — no entry contents, no names.</p>
    </div>
    <div class="tools" id="tools">
      <button class="ghost" id="refresh">Refresh</button>
      <button class="ghost" id="recompute">Recompute</button>
      <button class="ghost" id="copy">Copy JSON</button>
      <button class="ghost" id="out">Sign out</button>
      <button class="ghost" id="outall">Sign out everywhere</button>
    </div>
  </div>

  <section class="gate" id="gate">
    <form id="login" class="card">
      <div class="brand">
        <svg viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true">
          <circle cx="16" cy="17" r="10.5" stroke="currentColor" stroke-width="1.6" />
          <circle cx="16" cy="5.5" r="2.4" stroke="currentColor" stroke-width="1.6" />
          <circle cx="12.4" cy="16" r="1.2" fill="currentColor" />
          <circle cx="19.6" cy="16" r="1.2" fill="currentColor" />
          <path d="M12.8 20.6c1.8 1.5 4.6 1.5 6.4 0" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" />
        </svg>
        Numa · service
      </div>
      <p class="muted" style="margin-top:6px">The sync service, in numbers.</p>
      <div class="fieldset">
        <label class="field" for="pw"><span>Password</span>
          <input id="pw" type="password" autocomplete="current-password" autofocus />
        </label>
        <button id="go">Sign in</button>
        <p id="err" class="err hide"></p>
      </div>
    </form>
  </section>

  <div id="dash" class="hide" style="display:grid;gap:16px"></div>
  <p class="muted foot" id="stamp"></p>
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
  function barChart(rows, key, second, labelKey, names, nightBand) {
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
    // The night shift, marked where it happens. Hours are UTC and the chart
    // says so; the band is 22:00-06:00, which is the stretch this whole app
    // was written for.
    if (nightBand && rows.length === 24) {
      out = out.replace('<div class="bars">',
        '<div class="bars"><span class="night" style="left:0;width:' + ((6 / 24) * 100) + '%"></span>' +
        '<span class="night" style="left:' + ((22 / 24) * 100) + '%;width:' + ((2 / 24) * 100) + '%"></span>');
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

  /* A stamp somebody can read: the operator's own clock, not a UTC string. */
  function when(iso) {
    if (!iso) return "just now";
    var at = new Date(iso);
    return isNaN(at.getTime()) ? String(iso) : at.toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  /* "Busiest at 03:00" — the one sentence the 24 bars are there to say. */
  function peakLine(rows) {
    if (!rows || !rows.length) return "";
    var best = rows[0], total = 0, i;
    for (i = 0; i < rows.length; i++) {
      total += Number(rows[i].n || 0);
      if (Number(rows[i].n || 0) > Number(best.n || 0)) best = rows[i];
    }
    var night = 0;
    for (i = 0; i < rows.length; i++) {
      var h = Number(rows[i].hour);
      if (h >= 22 || h < 6) night += Number(rows[i].n || 0);
    }
    return "Busiest at " + esc(best.hour) + ":00 UTC · " + pct(night, total) +
      " of everything logged falls in the shaded night hours.";
  }

  function band(title) {
    return '<div class="band"><h3>' + esc(title) + '</h3><hr /></div>';
  }

  /* A percentage cell that carries its own colour, scaled against the best
     week in its own column — 88% and 92% painted the same shade is a coloured
     table, not a heatmap. The number stays: colour is never the answer. */
  function heat(value, of, best) {
    var share = Number(of || 0) ? Number(value || 0) / Number(of) : 0;
    var alpha = best > 0 ? 0.05 + (share / best) * 0.30 : 0.05;
    return '<td class="h"><u style="opacity:' + alpha.toFixed(3) + '"></u>' +
      '<span><b>' + n(value) + '</b><i>' + pct(value, of) + '</i></span></td>';
  }

  /* The best ratio in a column, so the column can be scaled to itself. */
  function bestShare(rows, key, ofKey) {
    var best = 0;
    for (var i = 0; i < rows.length; i++) {
      var of = Number(rows[i][ofKey] || 0);
      if (of > 0) best = Math.max(best, Number(rows[i][key] || 0) / of);
    }
    return best;
  }

  /* A header cell is a button when the column names a sort key. The arrow is
     the state: no arrow means this column is not the one in force. */
  function headCell(col, sort) {
    var label = esc(col.label || col);
    if (!col.sort) return '<th' + (col.num ? ' class="num"' : '') + '>' + label + '</th>';
    var active = sort && sort.key === col.sort;
    return '<th' + (col.num ? ' class="num"' : '') + '>' +
      '<button type="button" class="sortby' + (active ? ' on' : '') + '" data-sort="' + esc(col.sort) + '">' +
      label + '<i>' + (active ? (sort.dir < 0 ? "\u2193" : "\u2191") : "\u2195") + '</i></button></th>';
  }

  function table(head, rows, cells, cls, sort) {
    if (!rows.length) return '<p class="muted">Nothing yet.</p>';
    var out = '<div class="scroll"><table class="' + (cls || "") + '"><thead><tr>';
    for (var h = 0; h < head.length; h++) {
      out += headCell(head[h], sort);
    }
    out += '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) out += '<tr>' + cells(rows[r]) + '</tr>';
    return out + '</tbody></table></div>';
  }

  // The week in sentences.
  //
  // Every other card on this page is a number waiting for somebody to work
  // out what it means. This one does the working out: who arrived, how many
  // of them ever wrote anything, who came back, and how many are gone. The
  // arrows compare with the seven days before, because a count with nothing
  // beside it cannot say whether things are getting better.
  function delta(now, before) {
    var a = Number(now || 0), b = Number(before || 0);
    if (!b) return a ? '<em class="up">new</em>' : "";
    var change = Math.round(((a - b) / b) * 100);
    if (change === 0) return '<em class="flat">level</em>';
    return '<em class="' + (change > 0 ? "up" : "down") + '">' +
      (change > 0 ? "+" : "") + change + '%</em>';
  }

  /* "+9" against the stored snapshot, not a fresh query. */
  function since(now, before) {
    if (before == null) return "";
    var change = Number(now || 0) - Number(before || 0);
    if (!change) return ' <span class="tiny">level</span>';
    return ' <em class="' + (change > 0 ? "up" : "down") + '">' +
      (change > 0 ? "+" : "") + n(change) + '</em>';
  }

  function report(d) {
    var t = d.totals || {}, f = d.funnel || {}, life = d.lifespan || {}, ret = d.retention || {};
    var prev = d.previous || null;
    var prevTotals = prev ? (prev.totals || {}) : {};
    var joined = Number(f.joined_7d || 0);
    var activated = Number(f.activated_7d || 0);
    var lost = Math.max(0, Number(ret.total || 0) - Number(ret.d30 || 0) - Number(ret.never || 0));
    var prevJoined = Number(f.joined_prev_7d || 0);
    var stayed = Number(f.stayed_a_week || 0);

    var lines = [];
    lines.push('<b>' + n(joined) + '</b> ' + (joined === 1 ? "family" : "families") +
      ' turned on Family Sync in the last seven days ' + delta(joined, prevJoined) + '.');
    lines.push('<b>' + n(activated) + '</b> of them (' + pct(activated, joined) +
      ') went on to log something. ' +
      (joined - activated > 0
        ? n(joined - activated) + ' set it up and never wrote an entry.'
        : 'Every one of them wrote at least one.'));
    lines.push('<b>' + n(f.returning_7d) + '</b> ' +
      (Number(f.returning_7d || 0) === 1 ? "family that was already here came back" : "families that were already here came back") +
      ' and logged this week.');
    lines.push('Of the ' + n(prevJoined) + ' who arrived the week before, <b>' + n(stayed) +
      '</b> (' + pct(stayed, prevJoined) + ') were still logging seven days later.');
    lines.push('<b>' + n(life.one_day) + '</b> ' + (Number(life.one_day || 0) === 1 ? "family has" : "families have") +
      ' entries from one single day and nothing since — they tried it once. ' +
      '<b>' + n(lost) + '</b> logged for longer and then went quiet more than a month ago.');
    lines.push('<b>' + n(f.paired_7d) + '</b> of the arrivals this week added a second phone (' +
      pct(f.paired_7d, joined) + '). Across the whole service it is ' + pct(t.paired, t.families) + '.');
    if (prev) {
      lines.push('Against the last snapshot: <b>' + n(t.families) + '</b> families' +
        since(t.families, prevTotals.families) + ' and <b>' + n(t.entries) + '</b> entries' +
        since(t.entries, prevTotals.entries) + '.');
    }

    var stamp = '<p class="tiny" style="margin:-4px 0 14px">Computed ' + esc(when(d.heavyComputedAt)) +
      (prev ? ' · compared with the snapshot from ' + esc(when(prev.at)) : '') + '.</p>';

    return '<div class="card report"><h2>The week in words</h2>' + stamp +
      '<ul>' + lines.map(function (line) { return "<li>" + line + "</li>"; }).join("") + '</ul>' +
      '<div class="grid">' +
        stat("Arrived", n(joined), "last 7 days") +
        stat("Logged something", n(activated), pct(activated, joined) + " of arrivals") +
        stat("Came back", n(f.returning_7d), "already here, logged this week") +
        stat("Tried once", n(life.one_day), "one day of entries, ever") +
        stat("Gone quiet", n(lost), "silent 30+ days") +
        stat("Never logged", n(ret.never), "synced, wrote nothing") +
      '</div>' +
      '<p class="tiny" style="margin:12px 0 0">This counts only families who turned Family Sync ON — ' +
      'the app works without it and those phones are invisible here, by design. ' +
      'For everyone else there is only the anonymous usage counter, and only where it was allowed.</p>' +
      '</div>';
  }

  /* The messages, as conversations. Every message a phone sent since replies
     existed carries the same thread (the start of a hash of a key only that
     phone holds), so its messages and the answers to them read as one
     exchange. An older message is a conversation of one. */
  // Doubled backslashes: this is inside a template string on the server.
  var EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
  function conversations(d) {
    var byKey = {}, order = [], threadOf = {};
    for (var i = 0; i < d.feedback.length; i++) {
      var f = d.feedback[i];
      var key = f.thread ? "t:" + f.thread : "m:" + f.id;
      threadOf[f.id] = key;
      var c = byKey[key];
      if (!c) {
        // Newest first from the server, so the first row met is the latest:
        // the one a reply answers and a tick marks.
        c = byKey[key] = { key: key, items: [], open: false, latest: "", contact: "", email: "",
          inApp: Boolean(f.thread), lastId: f.id, version: f.app_version };
        order.push(c);
      }
      c.items.push({ me: false, at: String(f.at || f.sent || ""), sent: f.sent, text: f.message });
      if (!Number(f.handled)) c.open = true;
      if (!c.contact && f.contact) c.contact = String(f.contact);
      // The server looks across the whole conversation (thread_contact), as
      // the reply itself will; this row's own contact covers an older app.
      var addr = String(f.thread_contact || f.contact || "").trim();
      if (!c.email && addr && EMAIL_RE.test(addr)) c.email = addr.toLowerCase();
      if (!c.contact && c.email) c.contact = c.email;
      if (String(f.at || f.sent || "") > c.latest) c.latest = String(f.at || f.sent || "");
    }
    var replies = d.replies || [];
    for (var r = 0; r < replies.length; r++) {
      var x = replies[r];
      var k = x.thread ? "t:" + x.thread : threadOf[x.feedback_id];
      // An answer to a message older than the two hundred shown.
      if (!k || !byKey[k]) continue;
      byKey[k].items.push({ me: true, at: String(x.at || x.sent || ""), sent: x.sent, text: x.body, emailed: x.emailed_to });
      if (String(x.at || x.sent || "") > byKey[k].latest) byKey[k].latest = String(x.at || x.sent || "");
    }
    for (var o = 0; o < order.length; o++) {
      order[o].items.sort(function (a, b) { return a.at < b.at ? -1 : (a.at > b.at ? 1 : 0); });
    }
    // Waiting for an answer first; within each, the latest word first.
    order.sort(function (a, b) {
      if (a.open !== b.open) return a.open ? -1 : 1;
      return a.latest < b.latest ? 1 : (a.latest > b.latest ? -1 : 0);
    });
    return order;
  }

  // What the operator was typing, kept across the re-renders a refresh, a
  // sort or a tick causes — losing a half-written answer is the worst thing
  // this page could do. Keyed by the CONVERSATION, which keeps its key when
  // the parent writes again; the message an answer goes to (data-id) is the
  // newest one on screen and moves. "sending" keeps a button that is already
  // on its way from being pressed again on a re-drawn page.
  var drafts = {}, noMail = {}, notes = {}, sending = {};
  // The name each answer is sent under, kept until it is known to have
  // arrived: a retry after a dropped connection sends the same name, and the
  // server stores and mails it once. New words get a new name.
  var replyIds = {};
  function newReplyId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
  }

  function messagesCard(d) {
    var list = conversations(d), waiting = 0, html = "";
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.open) waiting++;
      // The triage chip the owner asked for: which build the report came
      // from, and whether that build predates what is live right now —
      // "is this already fixed?" answered at a glance.
      var buildBit = '';
      if (c.version) {
        var stale = d.workerBuild && String(c.version) < String(d.workerBuild);
        buildBit = ' · build ' + esc(c.version) +
          (stale ? ' <span style="color:#c96">· before current deploy</span>'
                 : ' <span style="color:#7a6">· current</span>');
      }
      var bubbles = '';
      for (var j = 0; j < c.items.length; j++) {
        var it = c.items[j];
        bubbles += '<div class="bub' + (it.me ? ' me' : '') + '"><div class="tiny">' +
          (it.me ? 'You · ' : '') + esc(String(it.sent || '').replace('T', ' ')) +
          (it.me && it.emailed ? ' · emailed to ' + esc(it.emailed) : '') +
          // Email was the only way to this parent, and it is not confirmed:
          // still sending, or it failed — it did not reach them.
          (it.me && !it.emailed && !c.inApp ? ' · not confirmed as emailed' : '') +
          '</div><p>' + esc(it.text) + '</p></div>';
      }
      var id = esc(c.lastId), conv = esc(c.key);
      var mail = Boolean(c.email);
      var reach;
      if (c.inApp) {
        reach = 'They will see it in the app, with a dot on the speech bubble' +
          (mail ? '' : ' (no email left)') + '.';
      } else if (mail) {
        reach = 'Sent from an older version of the app: the answer can only go by email.';
      } else {
        reach = '';
      }
      var form = (c.inApp || mail)
        ? '<div class="reply">' +
            '<textarea class="reply-box" data-conv="' + conv + '" maxlength="4000" placeholder="Reply…"></textarea>' +
            '<div class="row">' +
              '<button class="send" data-id="' + id + '" data-conv="' + conv + '">Send reply</button>' +
              (mail ? '<label><input type="checkbox" class="reply-mail" data-conv="' + conv + '"' +
                (c.inApp ? '' : ' disabled') + ' checked> Also email ' + esc(c.email) + '</label>' : '') +
            '</div>' +
            '<div class="tiny reach">' + esc(reach) + '</div>' +
            '<div class="tiny reply-note" data-conv="' + conv + '"></div>' +
          '</div>'
        : '<div class="tiny">Sent from an older version of the app, with no email: there is no way to answer ' +
          'this one directly. Answer it in News.</div>';
      html += '<div class="msg"><div class="tiny">' +
        '<span class="pill' + (c.open ? ' bad' : ' ok') + '">' + (c.open ? 'Waiting' : 'Handled') + '</span> ' +
        (c.contact ? '<b>' + esc(c.contact) + '</b>' : 'no contact') +
        buildBit + '</div>' +
        bubbles + form +
        '<div><button class="ghost mark" data-id="' + id + '" data-to="' + (c.open ? 1 : 0) + '">' +
        (c.open ? 'Mark handled' : 'Handled ✓ — undo') + '</button></div></div>';
    }
    return '<div class="card"><h2>Messages · ' + list.length +
      (waiting ? ' · ' + waiting + ' waiting' : '') + '</h2>' +
      (d.workerBuild ? '<p class="tiny">Live build: ' + esc(d.workerBuild) + '</p>' : '') +
      html + '</div>';
  }

  /* The half that is always live: messages must be markable and the security
     panels must tell the truth of this minute. Small, indexed reads — they
     are not part of the nightly computation and never wait for it. */
  function liveSections(d) {
    var parts = [];
  if (d.feedback.length) parts.push(messagesCard(d));
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
  sec += '<p class="muted" style="margin:14px 0 8px">Browsers that skip the lockout</p>' +
    table([{ label: "Trusted since" }, { label: "Last seen" }, { label: "From" }, { label: "Browser" }],
      d.knownBrowsers || [], function (k) {
        return '<td>' + esc(k.trusted) + '</td><td>' + esc(k.last_seen || "—") + '</td>' +
          '<td>' + esc(k.ip) + ' ' + esc(k.country) + '</td>' +
          '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">' +
          esc(k.user_agent || "—") + '</td>';
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

  // The alarm clock. If "armed" is zero while phones exist, reminders are
  // being registered and never scheduled — which is silent everywhere else.
  var push = d.push || {};
  parts.push('<div class="card"><h2>Reminder alarm clock</h2><div class="grid">' +
    stat("Phones", n(push.phones), "subscribed to reminders") +
    stat("Feed armed", n(push.feed_armed), "waiting to ring") +
    stat("Nappy armed", n(push.diaper_armed), "waiting to ring") +
    stat("Failing", n(push.failing), "push service refused") +
    '</div><p class="tiny" style="margin:12px 0 0">Newest schedule ' +
    esc(push.newest || "\u2014") + '. The table holds an endpoint, its keys and up to two ' +
    'future times \u2014 no family, no entry, nothing about a baby.</p>' +
    // The identity every push is signed with. It is minted on the first ask
    // and then fixed for ever, so it is worth being able to see that it
    // exists \u2014 and to notice if it ever changed, which would mean every
    // subscribed phone had gone quiet.
    '<p class="tiny" style="margin:6px 0 0">' + (d.vapid
      ? 'Signing key <code>' + esc(String(d.vapid.publicKey).slice(0, 12)) + '\u2026</code> since ' +
        esc(String(d.vapid.createdAt).slice(0, 10)) + '. Never rotate it: phones subscribed to that key.'
      : 'No signing key yet \u2014 the first phone to ask for one mints it.') +
    '</p>' +
    // Sending is deliberately not a button on this page: it is a program you
    // start on a laptop (see tools/broadcast). But what went out has to be
    // visible where the operator already looks, one still going out included.
    (!(d.announcements || []).length ? '' :
      '<h3 class="tiny" style="margin:18px 0 6px">Announcements</h3>' +
      table(
        [{ label: "When" }, { label: "Title" }, { label: "Sent", num: 1 }, { label: "Dropped", num: 1 }, { label: "Refused", num: 1 }],
        d.announcements,
        function (a) {
          return '<td>' + esc(String(a.createdAt).slice(0, 16).replace('T', ' ')) + '</td>' +
            '<td>' + esc(a.title) + (a.finishedAt ? '' : ' <span class="pill">sending</span>') + '</td>' +
            '<td class="num">' + n(a.sent) + '</td><td class="num">' + n(a.gone) + '</td>' +
            '<td class="num">' + n(a.failed) + '</td>';
        },
      )) +
    '</div>');

    return parts.join("");
  }

  /* The listeners the live half needs. */
  function byConv(selector, conv) {
    var all = document.querySelectorAll(selector);
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute("data-conv") === conv) return all[i];
    return null;
  }

  function showNote(conv, text, kind) {
    if (kind) notes[conv] = { text: text, kind: kind };
    var out = byConv(".reply-note", conv);
    if (out) { out.textContent = text; out.className = "tiny reply-note " + (kind || "note-bad"); }
  }

  function wireLive() {
    var marks = document.querySelectorAll(".mark");
    for (var i = 0; i < marks.length; i++) {
      marks[i].addEventListener("click", function (e) {
        var b = e.currentTarget;
        fetch("/api/admin/feedback", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: b.getAttribute("data-id"), handled: Number(b.getAttribute("data-to")) })
        }).then(function () { load(); });
      });
    }

    var boxes = document.querySelectorAll(".reply-box");
    for (var j = 0; j < boxes.length; j++) {
      var key = boxes[j].getAttribute("data-conv");
      if (drafts[key]) boxes[j].value = drafts[key];
      boxes[j].addEventListener("input", function (e) {
        var c = e.currentTarget.getAttribute("data-conv");
        drafts[c] = e.currentTarget.value;
        delete replyIds[c];
      });
    }
    var mails = document.querySelectorAll(".reply-mail");
    for (var m = 0; m < mails.length; m++) {
      if (noMail[mails[m].getAttribute("data-conv")] && !mails[m].disabled) mails[m].checked = false;
      mails[m].addEventListener("change", function (e) {
        noMail[e.currentTarget.getAttribute("data-conv")] = !e.currentTarget.checked;
      });
    }
    var shownNotes = document.querySelectorAll(".reply-note");
    for (var q = 0; q < shownNotes.length; q++) {
      var note = notes[shownNotes[q].getAttribute("data-conv")];
      if (note) { shownNotes[q].textContent = note.text; shownNotes[q].className = "tiny reply-note " + note.kind; }
    }

    var sends = document.querySelectorAll(".reply button.send");
    for (var k = 0; k < sends.length; k++) {
      var sendConv = sends[k].getAttribute("data-conv");
      if (sending[sendConv]) { sends[k].disabled = true; sends[k].textContent = "Sending…"; }
      sends[k].addEventListener("click", function (e) {
        var b = e.currentTarget, id = b.getAttribute("data-id"), conv = b.getAttribute("data-conv");
        if (sending[conv]) return;
        var area = byConv(".reply-box", conv), tick = byConv(".reply-mail", conv);
        var text = area ? area.value.trim() : "";
        if (!text) { showNote(conv, "Write the reply first."); return; }
        sending[conv] = true;
        delete notes[conv];
        if (!replyIds[conv]) replyIds[conv] = newReplyId();
        b.disabled = true;
        b.textContent = "Sending…";
        // Looked up again when the answer comes: the page may have been
        // redrawn meanwhile, and the old button is no longer on it.
        function button() { return byConv(".reply button.send", conv); }
        fetch("/api/admin/feedback/reply", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: id, text: text, email: tick ? tick.checked : false, replyId: replyIds[conv] })
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (r) { return { ok: res.ok, r: r }; });
        }).then(function (x) {
          delete sending[conv];
          var again = button();
          if (!x.ok || !x.r.ok) {
            // The server answered "no": the next press is a new try, under a
            // new name.
            delete replyIds[conv];
            if (again) { again.disabled = false; again.textContent = "Send reply"; }
            showNote(conv, (x.r && x.r.error) || "That did not send.", "note-bad");
            return;
          }
          var r = x.r;
          delete replyIds[conv];
          var said = r.inApp && r.emailedTo ? "Sent ✓ — in the app and to " + r.emailedTo + "."
            : r.inApp ? "Sent ✓ — they will see it in the app."
            : "Sent ✓ — emailed to " + r.emailedTo + ".";
          if (r.emailError) said = "In the app ✓ — but the email did not go: " + r.emailError;
          if (r.unticked) said += " It could not be ticked off — tick it by hand.";
          if (r.already) {
            said = "Already sent ✓ — the first try had arrived; nothing went twice.";
            if (r.emailError) said = "In the app ✓ (the first try had arrived) — but " + r.emailError;
          }
          // Shown and cleared at once, before the reload: if the reload
          // fails, the page must still say it went, or it invites a resend.
          delete drafts[conv];
          var box2 = byConv(".reply-box", conv);
          if (box2) box2.value = "";
          if (again) { again.disabled = false; again.textContent = "Send reply"; }
          showNote(conv, said, r.emailError || r.unticked ? "note-bad" : "note-ok");
          load();
        }).catch(function () {
          // No answer is not "not sent": the server may have stored and
          // mailed it before the connection dropped. Reload to show what is
          // there; a second press re-sends under the same name, so it can
          // never arrive twice.
          delete sending[conv];
          var again = button();
          if (again) { again.disabled = false; again.textContent = "Send reply"; }
          showNote(conv, "No answer from the server — it may have gone. Check the conversation above; " +
            "pressing Send again cannot send it twice.", "note-bad");
          load();
        });
      });
    }
  }

  // The families table opens short, newest first; these remember how the
  // operator left it, so a re-render (a refresh, a mark-handled) does not
  // throw the sort away.
  var allFamilies = false;
  var familySort = { key: "created", dir: -1 };
  var familyFilter = "";

  /* Text sorts as text, everything else as a number, and a missing value
     always sorts last whichever way the arrow points — an empty cell is not
     a small one. */
  function sortRows(rows, sort) {
    var numeric = { devices: 1, entries: 1, deleted: 1, has_profile: 1 };
    return rows.slice().sort(function (a, b) {
      var x = a[sort.key], y = b[sort.key];
      var xEmpty = x == null || x === "";
      var yEmpty = y == null || y === "";
      if (xEmpty || yEmpty) return xEmpty && yEmpty ? 0 : (xEmpty ? 1 : -1);
      if (numeric[sort.key]) return (Number(x) - Number(y)) * sort.dir;
      return String(x) < String(y) ? -sort.dir : (String(x) > String(y) ? sort.dir : 0);
    });
  }

  function render(d) {
    var t = d.totals || {}, ret = d.retention || {}, sp = d.spread || {}, inv = d.invites || {};
    var df = d.deviceFreshness || {};
    var parts = [];

    if (!d.heavyComputedAt) {
      // Nothing has ever run. The page says so and offers the button — it
      // does NOT quietly spend a hundred thousand row reads filling itself in,
      // which is the whole reason the computation moved to a nightly job.
      parts.push('<div class="card"><h2>Not computed yet</h2>' +
        '<p class="muted">The heavy figures — cohorts, retention, per-family — are worked out ' +
        'once a night and stored, so that opening this page costs nothing. Nothing has been ' +
        'stored yet. Press Recompute above to do it now; after that the nightly run keeps it fresh.</p>' +
        '</div>');
      parts.push(band("Live"));
      parts.push(liveSections(d));
      $("dash").innerHTML = parts.join("");
      $("stamp").textContent = "Waiting for the first nightly run.";
      wireLive();
      return;
    }

    parts.push(band("This week"));
    parts.push(report(d));

    parts.push(band("The service"));
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

    // Colour on the three ratios: the week a cohort stopped sticking is
    // visible before a single number has been read.
    var bestLogged = bestShare(d.cohorts, "ever_logged", "joined");
    var bestPaired = bestShare(d.cohorts, "paired", "joined");
    var bestActive = bestShare(d.cohorts, "active_7d", "joined");
    parts.push('<div class="card"><h2>Weekly cohorts</h2>' +
      table([{ label: "Week" }, { label: "From" }, { label: "Arrived", num: 1 },
             { label: "Ever logged", num: 1 }, { label: "Second phone", num: 1 }, { label: "Active 7d", num: 1 }],
        d.cohorts, function (c) {
          return '<td>' + esc(c.week) + '</td><td>' + esc(c.starts) + '</td>' +
            '<td class="num">' + n(c.joined) + '</td>' +
            heat(c.ever_logged, c.joined, bestLogged) +
            heat(c.paired, c.joined, bestPaired) +
            heat(c.active_7d, c.joined, bestActive);
        }, "heat") +
      '<p class="tiny" style="margin:10px 0 0">Each week of arrivals, and what became of them. ' +
      'The newest row is still filling up.</p></div>');

    parts.push(band("What they do"));

    var kindTotal = 0;
    for (var k = 0; k < d.kinds.length; k++) kindTotal += Number(d.kinds[k].n || 0);
    parts.push('<div class="split">' +
      '<div class="card"><h2>What gets logged</h2>' +
        meter(d.kinds.map(function (x) { return [x.kind, x.n]; }), kindTotal) +
        '<p class="tiny" style="margin:10px 0 0">Entry type only, counted across every family at once.</p></div>' +
      '<div class="card"><h2>Hour of day · UTC · 30 days</h2>' +
        barChart(d.hours, "n", null, "hour", null, true) +
        '<div class="axis tiny"><span>00</span><span>12</span><span>23</span></div>' +
        '<p class="peak">' + peakLine(d.hours) + '</p></div>' +
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


    parts.push('<div class="card"><h2>Recover a family</h2>' +
      '<p class="muted" style="margin-bottom:8px">For a parent who lost their phone or deleted the app but had Family Sync on. ' +
      'Exact name and birth date as they entered them; one match mints a single-use 48h join link. Every lookup is audited.</p>' +
      '<form id="recover" class="recover-row">' +
      '<input id="rec-name" placeholder="Baby name" autocomplete="off" />' +
      '<input id="rec-dob" type="date" />' +
      '<button type="submit">Find &amp; mint link</button></form>' +
      '<p id="rec-out" class="muted" style="margin-top:8px"></p></div>');

    // A note to ONE family. The broadcast reaches everyone and can aim at
    // nobody, which is what makes it safe to keep on a laptop; this one aims,
    // so it lives here where the family ids are, and every send is audited
    // with the id it went to.
    parts.push('<div class="card"><h2>Send a note to one family</h2>' +
      '<p class="muted" style="margin-bottom:8px">Paste a family id from the table below — the first eight ' +
      'characters are enough. Only families with Family Sync on can be reached, and only their phones that ' +
      'turned reminders on. Still no name and no baby: the server does not know one. It cannot be recalled.</p>' +
      '<form id="notify" class="fieldset">' +
      '<input id="not-id" placeholder="Family id" autocomplete="off" spellcheck="false" />' +
      '<input id="not-title" placeholder="Title" maxlength="60" autocomplete="off" />' +
      '<input id="not-body" placeholder="Message" maxlength="160" autocomplete="off" />' +
      '<button type="submit">Send to this family</button></form>' +
      '<p id="not-out" class="muted" style="margin-top:8px"></p></div>');

    // Five hundred rows is four screens of table nobody reads. Sorted the way
    // the operator asked, filtered if they typed something, then the first
    // twenty-five and a button for the rest — the sort runs over ALL of them,
    // so "top 25 by entries" means what it says.
    var pool = d.families;
    if (familyFilter) {
      var needle = familyFilter.toLowerCase();
      pool = pool.filter(function (f) {
        return String(f.family).toLowerCase().indexOf(needle) >= 0 ||
          String(f.created).indexOf(needle) >= 0;
      });
    }
    pool = sortRows(pool, familySort);
    var shown = allFamilies ? pool : pool.slice(0, 25);
    parts.push('<div class="card"><h2>Families · ' + n(d.families.length) +
      (familyFilter ? ' <span class="tiny">· ' + n(pool.length) + ' matching</span>' : '') + '</h2>' +
      '<input id="ffilter" class="filter" placeholder="Filter by id or date\u2026" value="' +
      esc(familyFilter) + '" autocomplete="off" />' +
      table([{ label: "Id", sort: "family" }, { label: "Created", sort: "created" },
             { label: "Phones", num: 1, sort: "devices" },
             { label: "Entries", num: 1, sort: "entries" }, { label: "Deleted", num: 1, sort: "deleted" },
             { label: "First", sort: "first_entry" }, { label: "Last entry", sort: "last_entry" },
             { label: "Profile", sort: "has_profile" }],
        shown, function (f) {
          return '<td>' + esc(f.family) + '</td><td>' + esc(f.created) + '</td>' +
            '<td class="num">' + n(f.devices) + '</td><td class="num">' + n(f.entries) + '</td>' +
            '<td class="num">' + n(f.deleted) + '</td>' +
            '<td>' + esc(f.first_entry || "—") + '</td><td>' + esc(f.last_entry || "—") + '</td>' +
            '<td>' + (Number(f.has_profile) ? "yes" : "—") + '</td>';
        }, "", familySort) +
      (pool.length > 25
        ? '<button class="ghost" id="more" style="margin-top:12px">' +
          (allFamilies ? "Show the first 25" : "Show all " + n(pool.length)) + '</button>'
        : "") +
      '</div>');

    parts.push(band("Operations"));
    parts.push(liveSections(d));


    $("dash").innerHTML = parts.join("");
    $("stamp").textContent = "Nightly figures computed " + when(d.heavyComputedAt) +
      " · this page read them at " + when(d.generatedAt) +
      " · opening it costs no computation";

    var more = $("more");
    if (more) {
      more.addEventListener("click", function () { allFamilies = !allFamilies; render(last); });
    }

    // Click a header to sort by it; click it again to turn it round. A new
    // column starts on the answer people usually want: biggest and newest
    // first for numbers and dates, A to Z for text.
    var sorters = document.querySelectorAll(".sortby");
    for (var q = 0; q < sorters.length; q++) {
      sorters[q].addEventListener("click", function (e) {
        var key = e.currentTarget.getAttribute("data-sort");
        if (familySort.key === key) familySort = { key: key, dir: -familySort.dir };
        else familySort = { key: key, dir: key === "family" ? 1 : -1 };
        render(last);
      });
    }

    var filter = $("ffilter");
    if (filter) {
      filter.addEventListener("input", function (e) {
        familyFilter = e.currentTarget.value.trim();
        render(last);
        // The re-render replaces the field, so the caret goes back where it
        // was — otherwise typing a second character is impossible.
        var again = $("ffilter");
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }

    wireLive();
  }

  // Re-wired after every render: the form is rebuilt with the dashboard.
  function wireRecovery() {
    var form = $("recover");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("rec-out");
      out.textContent = "Looking\u2026";
      fetch("/api/admin/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: $("rec-name").value, birthDate: $("rec-dob").value }),
      }).then(function (res) { return res.json(); }).then(function (r) {
        if (r.error) { out.textContent = r.error; return; }
        if (r.matches === 0) { out.textContent = "No family matches that name and date."; return; }
        if (r.matches > 1) {
          out.textContent = r.matches + " families match \u2014 refusing to guess. Ask the parent for something more.";
          return;
        }
        var link = "https://numalog.app/#join=" + r.code;
        out.innerHTML = "One match \u00b7 " + r.entries + " entries, last " + esc(String(r.lastEntryAt || "\u2014")) +
          "<br><strong>" + link + "</strong><br>Single use, expires in 48 hours. Send it to the parent; " +
          "opening it on their phone rejoins their family and downloads everything.";
      }).catch(function () { out.textContent = "Something went wrong."; });
    });
  }

  // Rebuilt with the dashboard like the recovery form, and confirmed once —
  // naming the household, because "are you sure" is a question nobody reads.
  function wireNotify() {
    var form = $("notify");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("not-out");
      var id = $("not-id").value.trim();
      var title = $("not-title").value.trim();
      if (!confirm("Send “" + title + "” to every phone in family " + id + "?\\n\\nIt cannot be recalled."))
        return;
      out.textContent = "Sending…";
      fetch("/api/admin/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId: id, title: title, body: $("not-body").value.trim() }),
      }).then(function (res) { return res.json(); }).then(function (r) {
        if (r.error) { out.textContent = r.error; return; }
        out.textContent = "Sent to " + r.sent + " of " + r.phones + " phone" + (r.phones === 1 ? "" : "s") +
          (r.gone ? " · " + r.gone + " dead subscription removed" : "") +
          (r.failed ? " · " + r.failed + " refused" : "") + ".";
        $("not-title").value = "";
        $("not-body").value = "";
      }).catch(function () { out.textContent = "Something went wrong."; });
    });
  }

  function load() {
    return fetch("/api/admin/stats").then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (d) {
        last = d;
        render(d);
        wireRecovery();
        wireNotify();
        $("gate").className = "gate hide";
        $("dash").className = "";
        $("head").className = "row";
        // Five minutes, and only while the tab is actually looked at. At
        // 60s this dashboard alone was ~1M row-reads per open hour — the
        // operator watching the numbers WAS most of the numbers.
        // Not while an answer is being typed, either: the rebuild would take
        // the caret out of the box mid-word.
        if (!timer) timer = setInterval(function () {
          var typing = document.activeElement && document.activeElement.className === "reply-box";
          if (!document.hidden && !typing) load();
        }, 300000);
        return true;
      });
    }).catch(function () { return false; });
  }

  $("login").addEventListener("submit", function (e) {
    e.preventDefault();
    $("go").disabled = true;
    fetch("/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("pw").value })
    }).then(function (res) {
      $("go").disabled = false;
      if (res.ok) { $("pw").value = ""; $("err").className = "err hide"; load(); return; }
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
  // "Not tomorrow, now": the operator asking for the nightly computation on
  // demand. It is the one button on this page that costs real money, so it
  // says what it is doing and comes back with the answer.
  $("recompute").addEventListener("click", function () {
    var b = $("recompute");
    b.disabled = true;
    b.textContent = "Computing\u2026";
    fetch("/api/admin/stats/refresh", { method: "POST" })
      .then(function (res) { return res.ok ? load() : false; })
      .then(function () { b.disabled = false; b.textContent = "Recompute"; })
      .catch(function () { b.disabled = false; b.textContent = "Recompute"; });
  });
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
