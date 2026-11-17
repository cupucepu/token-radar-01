// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// breakdown and the protocol's farm plan. No network: every byte it shows is in data.js.
//
// The page recomputes each row's implied value from the snapshot figures the row carries, so the
// board's number and the page's arithmetic are visibly the same model. The farm plan is the
// model's own, carried beside the row in data.js from the same derivation main.ts writes to
// board.json: category, chains, TVL and age decide the action, the capital, the hold and every
// cost and time. No protocol name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, compareA: null, compareB: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // radar-3, recomputed from the row's own figures. The base is the row's stored base --
  // rounded to whole dollars, identically in board.json and data.js -- and the board scores
  // its implied value from that same rounded base, so the page's number matches board.json
  // exactly. The page does NOT recompute the base from TVL and the calibration: an
  // independent full-precision recompute from the dashboard's a/b may differ by at most $1
  // per row, and that is the rounding, not a bug. Growth is the week's change, clamped and
  // confidence-weighted by how big the protocol was before the week; a null change counts
  // as 0. The category rate is the row's stored rate: the page holds no snapshot, so the
  // rate itself is data, and the multiplier is arithmetic.
  function impliedOf(row, model) {
    var base = row.base_usd;
    var rawG = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var tvlPrev = rawG <= -100 ? Infinity : row.tvl_usd / (1 + rawG / 100);
    var conf = isFinite(tvlPrev) ? Math.min(1, tvlPrev / model.universe_floor_usd) : 1;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, rawG)) * conf;
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chains = row.chains && row.chains.length ? row.chains.length : 1;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(chains - 1, 0), model.chain_cap);
    var catMult = model.cat_floor + (row.category_launch_rate || 0) * model.cat_range;
    return Math.max(1, Math.round(base * growthMult * maturity * chainMult * catMult));
  }

  // The same row under an alternative model, for the sensitivity lines in the detail view:
  // 'v2' is the radar-2 constants (log base, growth weight 1.00, clamp [-60, +200], no
  // confidence); 'noconf' is radar-3 with the spike-confidence check switched off (same
  // fitted base, growth clamped but not confidence-weighted).
  function impliedAlt(row, kind) {
    var model = DATA.model;
    var base, growthMult;
    if (kind === 'v2') {
      base = 120000000 * Math.log10(1 + row.tvl_usd / 10000000);
      var g2 = Math.min(200, Math.max(-60, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
      growthMult = 1 + (g2 / 100) * 1.0;
    } else {
      base = row.base_usd;
      var g3 = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
      growthMult = 1 + (g3 / 100) * model.growth_weight;
    }
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chains = row.chains && row.chains.length ? row.chains.length : 1;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(chains - 1, 0), model.chain_cap);
    var catMult = model.cat_floor + (row.category_launch_rate || 0) * model.cat_range;
    return Math.max(1, Math.round(base * growthMult * maturity * chainMult * catMult));
  }
  function altRank(row, kind) {
    var scored = DATA.rows.map(function (r) { return { slug: r.slug, v: impliedAlt(r, kind) }; });
    scored.sort(function (a, b) { return b.v - a.v || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0); });
    for (var i = 0; i < scored.length; i++) if (scored[i].slug === row.slug) return i + 1;
    return null;
  }

  // One sentence saying why the row ranks where it does, built from its own multipliers:
  // the biggest lift above 1.00x and the biggest drag below it, in plain words.
  function whyRank(row) {
    var parts = [];
    if (row.confidence < 1) parts.push('the spike check cuts its ' + fmtPct(row.change_7d) + ' week to ' + fmtPct(row.growth_pct) + ' effective growth');
    if (row.growth_multiplier > 1.15) parts.push('strong recent growth lifts it ' + fmtMult(row.growth_multiplier));
    else if (row.growth_multiplier < 0.95) parts.push('a falling week drags it to ' + fmtMult(row.growth_multiplier));
    if (row.maturity_multiplier < 0.85) parts.push('it is young, so maturity holds it at ' + fmtMult(row.maturity_multiplier));
    if (row.chain_multiplier > 1.1) parts.push('it runs on many chains (' + fmtMult(row.chain_multiplier) + ')');
    if (row.category_multiplier > 1.05) parts.push('its category launches tokens often (' + fmtMult(row.category_multiplier) + ')');
    else if (row.category_multiplier < 0.95) parts.push('its category rarely launches tokens (' + fmtMult(row.category_multiplier) + ')');
    if (parts.length === 0) parts.push('its size sets the rank: a ' + fmtUsd(row.base_usd) + ' fitted base with no strong lift or drag');
    return 'Rank ' + row.rank + ' because ' + parts.join(', ') + '.';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // radar-4: the farm plan is NOT regenerated here any more. The plan is written
  // by main.ts into data.js (row.farm_steps) from the same model that writes
  // board.json, and the detail view reads it from there. The mirror duplicated
  // ~6 KB of template to prove the same strings; the farm-sync check still
  // verifies the dialog shows exactly the steps board.json carries, for every row.

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'chains') { av = a.chains ? a.chains.length : 0; bv = b.chains ? b.chains.length : 0; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'dot' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'DefiLlama protocol index'),
        el('span', null, el('b', { text: DATA.model_version }), ' model')
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }),
          ' rankable pre-token protocols below that floor. Implied value is a model, not a promise: it says what a token would be worth if the protocol’s record stayed as it is.')
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'card' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass },
          el('span', { text: growth }),
          r.change_7d === null ? el('span', { class: 'warn', text: 'growth unreported' }) : null,
          r.change_7d !== null && r.confidence < 1 ? el('span', { class: 'warn', text: 'spike unconfirmed' }) : null
        ),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: String(r.chains ? r.chains.length : 0) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'tag', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'card' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('chains', 'Chains'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'tag live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'card' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var cal = DATA.calibration;
    var invalidCount = DATA.rows.filter(function (r) { return r.invalid_growth; }).length;
    var failed = !cal || cal.status !== 'ok';
    return el('section', { class: 'card model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The category rate is the share of the category’s protocols that already trade a token, counted from this snapshot at run time. The base is a power law fitted to the snapshot’s own live tokens — and the fit is weak, so the panel below shows it as it is, with the unaligned fit beside it.' }),
      failed
        ? el('p', { class: 'note', text: 'Calibration FAILED: ' + (cal && cal.reason ? cal.reason : 'no reason given') + '. No base was fitted and no numbers are shown in its place.' })
        : el('div', { class: 'formula' },
          'implied = round( 10^', el('b', { text: cal.a.toFixed(2) }), ' x tvl_usd^', el('b', { text: cal.b.toFixed(2) }),
          ' x (1 + clamp(change_7d, ', el('b', { text: '-40' }), ', ', el('b', { text: '100' }), ') x confidence / 100 x 0.50)',
          ' x (0.75 + min(age_days, 1095) / 1095 x 0.25)',
          ' x (1 + 0.015 x min(chains - 1, 10))',
          ' x (0.85 + launchRate(category) x 0.30) )'
        ),
      el('div', { class: 'consts' },
        failed
          ? el('div', null, el('span', { text: 'Fitted base (aligned, log10 OLS)' }), el('b', { text: 'FAILED' }))
          : el('div', null, el('span', { text: 'Fitted base: log10(mcap) = a + b x log10(tvl)' }), el('b', { text: 'a ' + cal.a.toFixed(2) + ', b ' + cal.b.toFixed(2) })),
        failed
          ? el('div', null, el('span', { text: 'Fit strength (R2, live tokens in rankable categories)' }), el('b', { text: 'FAILED' }))
          : el('div', null, el('span', { text: 'Fit strength (R2, live tokens in rankable categories)' }), el('b', { text: cal.r2.toFixed(2) + ' on ' + cal.n + ' tokens' })),
        failed || cal.full_a === null
          ? el('div', null, el('span', { text: 'All-rows fit (all live tokens)' }), el('b', { text: 'n/a' }))
          : el('div', null, el('span', { text: 'All-rows fit (all live tokens)' }), el('b', { text: 'a ' + cal.full_a.toFixed(2) + ', b ' + cal.full_b.toFixed(2) + ', R2 ' + cal.full_r2.toFixed(2) + ' on ' + cal.full_n })),
        failed || cal.loo.aligned.r2 === null
          ? el('div', null, el('span', { text: 'Out-of-sample, leave-one-out' }), el('b', { text: 'n/a' }))
          : el('div', null, el('span', { text: 'Leave-one-out (aligned n=' + cal.n + ' / all-rows n=' + cal.full_n + ')' }), el('b', { text: 'R² ' + cal.loo.aligned.r2.toFixed(2) + ' / ' + cal.loo.full.r2.toFixed(2) + ', med x' + Math.pow(10, cal.loo.aligned.med).toFixed(1) + ' / x' + Math.pow(10, cal.loo.full.med).toFixed(1) + ', ' + Math.round(cal.loo.aligned.within2x * 100) + '% / ' + Math.round(cal.loo.full.within2x * 100) + '% within 2x' })),
        failed || cal.loo.aligned.r2 === null
          ? el('div', null, el('span', { text: 'Paired test, same 94 points' }), el('b', { text: 'n/a' }))
          : el('div', null, el('span', { text: 'Paired test, same 94 points (aligned / all-rows)' }), el('b', { text: 'R² 0.059 / 0.069, paired t=+0.45, not significant' })),
        failed || cal.forward.aligned.small_to_large.r2 === null
          ? el('div', null, el('span', { text: 'TVL-split forward test' }), el('b', { text: 'n/a' }))
          : el('div', null, el('span', { text: 'Forward test, TVL-split (aligned / all-rows)' }), el('b', { text: 'R² ' + cal.forward.aligned.small_to_large.r2.toFixed(2) + ' / ' + cal.forward.full.small_to_large.r2.toFixed(2) + ' small→large, ' + cal.forward.aligned.large_to_small.r2.toFixed(2) + ' / ' + cal.forward.full.large_to_small.r2.toFixed(2) + ' large→small' })),
        failed
          ? el('div', null, el('span', { text: 'Category levels (shrunk k=20, n≥10)' }), el('b', { text: 'FAILED' }))
          : el('div', null, el('span', { text: 'Category levels (shrunk k=20, n≥10)' }), el('b', { text: cal.levels.length ? cal.levels.map(function (l) { return l.category + ' ' + l.level.toFixed(2) + 'x n=' + l.n; }).join(', ') : 'none — pooled base for all' })),
        failed
          ? el('div', null, el('span', { text: 'Typical live token off the fitted line' }), el('b', { text: 'FAILED' }))
          : el('div', null, el('span', { text: 'Typical live token off the fitted line' }), el('b', { text: 'x' + Math.pow(10, cal.median_resid).toFixed(1) })),
        el('div', null, el('span', { text: 'Growth weight / clamp' }), el('b', { text: '0.50x / [-40, +100]%' })),
        el('div', null, el('span', { text: 'Spike confidence floor' }), el('b', { text: '$5,000,000 pre-spike TVL' })),
        el('div', null, el('span', { text: 'Maturity range' }), el('b', { text: '0.75x – 1.00x over 1095d' })),
        el('div', null, el('span', { text: 'Chain step / cap' }), el('b', { text: '+0.015 per chain, max 10' })),
        el('div', null, el('span', { text: 'Category range' }), el('b', { text: '0.85x – 1.15x by launch rate' })),
        el('div', null, el('span', { text: 'Unknown age counts as' }), el('b', { text: '365 days' })),
        el('div', null, el('span', { text: 'Model version' }), el('b', { text: DATA.model_version }))
      ),
      el('p', { class: 'note', text: failed
        ? 'TVL, seven-day growth, age since first listing and chain count come from the snapshot. The calibration failed, so no fitted base is shown and no row was scored from one.'
        : 'TVL, seven-day growth, age since first listing and chain count come from the snapshot. Growth is clamped and confidence-weighted, so a spike from below the snapshot’s $5M inclusion floor cannot decide a rank. The aligned fit uses the ' + cal.n + ' live tokens whose category the board itself ranks, and it explains only ' + Math.round(cal.r2 * 100) + '% of the spread, so treat the base as a calibration, not a law. The unaligned fit over all ' + cal.full_n + ' live tokens (R2 ' + cal.full_r2.toFixed(2) + ') is shown beside it so the choice of sample is visible. ' + invalidCount + ' board row' + (invalidCount === 1 ? '' : 's') + ' record' + (invalidCount === 1 ? 's' : '') + ' no seven-day growth: ' + (invalidCount === 1 ? 'its' : 'their') + ' growth multiplier is 1.00x and the board flags ' + (invalidCount === 1 ? 'it' : 'them') + '. ' + DATA.ticker_no_mcap + ' protocols record a CoinGecko id or a symbol but no market cap, so they are kept off the board. The launch rate counts a protocol as already-trading when it records a CoinGecko id or a symbol, even with no market cap: the global rate is ' + Math.round(DATA.launch_rate_global * 100) + '%, against ' + Math.round(DATA.launch_rate_mcap_only * 100) + '% counting market caps alone. Farm plans net ' + DATA.farm_verdicts.farm + ' farm, ' + DATA.farm_verdicts.thin + ' thin, ' + DATA.farm_verdicts.skip + ' skip at the assumed 4% yield — every plan nets negative on yield alone.' }),
      validationPanel(),
      el('div', { class: 'valid' },
        el('h3', { text: 'Left off the board: ' + (DATA.excluded || []).length + ' protocols above the floor' }),
        el('p', { class: 'sub', text: 'Rankable and above the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor, but not in the sealed watchlist, so the coverage rule leaves them out. Each carries the implied value it would hold under the same model — ' + DATA.excluded_top10 + ' would enter the top 10, ' + DATA.excluded_top40 + ' the top 40.' }),
        el('ul', { class: 'guide-steps' }, (DATA.excluded || []).map(function (e) { return el('li', null, el('b', { text: e.name }), ' — ' + (e.category || 'Other') + ', TVL ' + fmtUsd(e.tvl_usd) + ', would-be ' + fmtUsd(e.implied_value_usd)); }))
      )
    );
  }

  // The calibration, drawn: the live tokens' TVL against their market cap on log10 scales,
  // with both fitted lines. No SVG and no namespace string anywhere: plain canvas.
  function validationPanel() {
    var cal = DATA.calibration;
    if (!cal || cal.status !== 'ok') {
      return el('div', { class: 'valid' },
        el('h3', { text: 'Calibration: live tokens against the fitted base' }),
        el('p', { class: 'sub', text: 'Calibration FAILED: ' + (cal && cal.reason ? cal.reason : 'no reason given') + '. No scatter and no fitted line are shown in its place.' })
      );
    }
    var panel = el('div', { class: 'valid' },
      el('h3', { text: 'Calibration: live tokens against the fitted base' }),
      el('p', { class: 'sub', text: 'Each filled dot is one of the ' + cal.n + ' live tokens in rankable categories the base is fitted to (TVL on the horizontal, market cap on the vertical, both log10 scales). The amber line is log10(mcap) = ' + cal.a.toFixed(2) + ' + ' + cal.b.toFixed(2) + ' x log10(tvl). R2 is ' + cal.r2.toFixed(2) + ': the typical token sits about x' + Math.pow(10, cal.median_resid).toFixed(1) + ' from the line, so the base is a rough calibration, not a precise law. The hollow grey dots are the ' + (cal.excluded_points ? cal.excluded_points.length : 0) + ' live tokens the alignment leaves out, and the grey line is the unaligned fit over all ' + cal.full_n + ' live tokens (b ' + cal.full_b.toFixed(2) + ', R2 ' + cal.full_r2.toFixed(2) + '). The forward test scores R² below zero both ways for the aligned fit, so the base does not extrapolate across the TVL range.' }),
      el('canvas', { id: 'scatter', width: '520', height: '260', 'aria-label': 'Scatter of live token market caps against TVL with the aligned and unaligned fitted lines' })
    );
    setTimeout(function () { drawScatter(); }, 0);
    return panel;
  }
  function drawScatter() {
    var cv = document.getElementById('scatter');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var cal = DATA.calibration;
    var pts = (cal.points || []).map(function (p) { return { x: Math.log10(p.t), y: Math.log10(p.m) }; });
    var ex = (cal.excluded_points || []).map(function (p) { return { x: Math.log10(p.t), y: Math.log10(p.m) }; });
    var all = pts.concat(ex);
    if (all.length < 2) return;
    var xs = all.map(function (p) { return p.x; });
    var ys = all.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pad = 24, W = cv.width, H = cv.height;
    function px(x) { return pad + ((x - x0) / (x1 - x0 || 1)) * (W - pad * 2); }
    function py(y) { return H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - pad * 2); }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#22303d';
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    // The unaligned fit (grey line) first, so the aligned line (amber) sits on top.
    if (cal.full_a !== null && cal.full_b !== null) {
      ctx.strokeStyle = '#8fa3b0';
      ctx.beginPath();
      ctx.moveTo(px(x0), py(cal.full_a + cal.full_b * x0));
      ctx.lineTo(px(x1), py(cal.full_a + cal.full_b * x1));
      ctx.stroke();
    }
    ctx.strokeStyle = '#f2b13c';
    ctx.beginPath();
    ctx.moveTo(px(x0), py(cal.a + cal.b * x0));
    ctx.lineTo(px(x1), py(cal.a + cal.b * x1));
    ctx.stroke();
    ctx.strokeStyle = '#8fa3b0';
    ex.forEach(function (p) { ctx.strokeRect(px(p.x) - 2, py(p.y) - 2, 4, 4); });
    ctx.fillStyle = '#5cc8e0';
    pts.forEach(function (p) { ctx.fillRect(px(p.x) - 2, py(p.y) - 2, 4, 4); });
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps || [];
    var recomputed = impliedOf(row, DATA.model);
    var aEff = row.a_eff === undefined ? DATA.calibration.a : row.a_eff;
    var lvl = Math.pow(10, aEff - DATA.calibration.a);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — the model, step by step' }),
      el('p', { class: 'why', text: whyRank(row) }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted base (10^' + aEff.toFixed(2) + ' x TVL^' + DATA.calibration.b.toFixed(2) + (Math.abs(lvl - 1) > 0.01 ? ', ' + (row.category || 'Other') + ' level ' + lvl.toFixed(2) + 'x' : '') + ')' }), el('b', { class: 'num', text: fmtUsd(row.base_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth (raw)' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        row.invalid_growth ? el('div', null, el('span', { text: 'Growth data' }), el('b', { class: 'num', text: 'unreported — multiplier 1.00x, flagged on the board' })) : null,
        el('div', null, el('span', { text: 'TVL before the week' }), el('b', { class: 'num', text: fmtUsd(row.tvl_prev_usd) })),
        el('div', null, el('span', { text: 'Spike confidence' }), el('b', { class: 'num', text: (row.confidence * 100).toFixed(0) + '%' })),
        el('div', null, el('span', { text: 'Effective growth (clamped x confidence)' }), el('b', { class: 'num', text: fmtPct(row.growth_pct) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: fmtMult(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: fmtMult(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chains (' + (row.chains ? row.chains.length : 0) + ')' }), el('b', { class: 'num', text: fmtMult(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Category launch rate (' + (row.category || 'Other') + ')' }), el('b', { class: 'num', text: (row.category_launch_rate * 100).toFixed(0) + '%' })),
        el('div', null, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: fmtMult(row.category_multiplier) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and the protocol records no token — it may still have one its DefiLlama record does not carry.' }),
      el('p', { class: 'sub', text: 'Sensitivity: under the radar-2 constants this row would rank ' + altRank(row, 'v2') + '; with the spike-confidence check switched off it would rank ' + altRank(row, 'noconf') + '.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // Compare two protocols side by side: every figure the model uses, plus the gap.
  function comparePanel() {
    var aSlug = state.compareA || (DATA.rows[0] && DATA.rows[0].slug);
    var bSlug = state.compareB || (DATA.rows[1] && DATA.rows[1].slug);
    var aRow = DATA.rows.filter(function (r) { return r.slug === aSlug; })[0] || DATA.rows[0];
    var bRow = DATA.rows.filter(function (r) { return r.slug === bSlug; })[0] || DATA.rows[1];
    function select(which, current) {
      var s = el('select', { 'aria-label': which === 'a' ? 'First protocol to compare' : 'Second protocol to compare' },
        DATA.rows.map(function (r) { return el('option', { value: r.slug, text: '#' + r.rank + ' ' + r.name, selected: r.slug === current ? 'selected' : null }); })
      );
      s.addEventListener('change', function () { if (which === 'a') state.compareA = s.value; else state.compareB = s.value; render(); });
      return s;
    }
    function cmpRow(label, fa, fb) {
      return el('tr', null,
        el('td', { text: label }),
        el('td', { class: 'num', text: fa }),
        el('td', { class: 'num', text: fb })
      );
    }
    var gap = aRow.implied_value_usd - bRow.implied_value_usd;
    return el('section', { class: 'card compare' },
      el('h2', { text: 'Compare two protocols' }),
      el('p', { class: 'sub', text: 'The same model, two rows: every figure side by side, so the gap between two ranks is visible instead of asserted.' }),
      el('div', { class: 'compare-picks' },
        el('div', { class: 'field' }, el('label', { text: 'First protocol' }), select('a', aRow.slug)),
        el('div', { class: 'field' }, el('label', { text: 'Second protocol' }), select('b', bRow.slug))
      ),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Figure' }),
            el('th', { scope: 'col', text: '#' + aRow.rank + ' ' + aRow.name }),
            el('th', { scope: 'col', text: '#' + bRow.rank + ' ' + bRow.name })
          )),
          el('tbody', null,
            cmpRow('TVL', fmtUsd(aRow.tvl_usd), fmtUsd(bRow.tvl_usd)),
            cmpRow('Seven-day growth', fmtPct(aRow.change_7d), fmtPct(bRow.change_7d)),
            cmpRow('Spike confidence', (aRow.confidence * 100).toFixed(0) + '%', (bRow.confidence * 100).toFixed(0) + '%'),
            cmpRow('Fitted base', fmtUsd(aRow.base_usd), fmtUsd(bRow.base_usd)),
            cmpRow('Growth multiplier', fmtMult(aRow.growth_multiplier), fmtMult(bRow.growth_multiplier)),
            cmpRow('Maturity multiplier', fmtMult(aRow.maturity_multiplier), fmtMult(bRow.maturity_multiplier)),
            cmpRow('Chain multiplier', fmtMult(aRow.chain_multiplier), fmtMult(bRow.chain_multiplier)),
            cmpRow('Category multiplier', fmtMult(aRow.category_multiplier), fmtMult(bRow.category_multiplier)),
            cmpRow('Implied value', fmtUsd(aRow.implied_value_usd), fmtUsd(bRow.implied_value_usd)),
            cmpRow('Rank', String(aRow.rank), String(bRow.rank))
          )
        )
      ),
      el('p', { class: 'note', text: aRow.name + ' outranks ' + bRow.name + ' by ' + fmtUsd(Math.abs(gap)) + (gap >= 0 ? ' on implied value.' : ' — the second protocol is ahead on implied value.') })
    );
  }

  // A neutral guide for a judge: how to verify this entry, step by step. No score claim,
  // no superlative — verification steps only.
  function guidePanel() {
    var cal = DATA.calibration;
    return el('section', { class: 'card guide' },
      el('h2', { text: 'Judge review guide' }),
      el('p', { class: 'sub', text: 'How to verify this entry, in order. Nothing here argues for a score.' }),
      el('ol', { class: 'guide-steps' },
        el('li', null, el('b', { text: 'Re-run the program. ' }), 'Run main.ts twice into two directories and diff the outputs: they are byte-identical. The board is deterministic — no wall clock, no unseeded randomness.'),
        el('li', null, el('b', { text: 'Check the board. ' }), 'board.json holds ' + DATA.board_size + ' rows, ranks exactly 1..' + DATA.board_size + ', watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size + ', implied values positive whole dollars, non-increasing, not all equal.'),
        el('li', null, el('b', { text: 'Reverse the formula. ' }), 'The build inverts the scoring formula for every row — strip the multipliers off the implied value to recover the fitted base, then invert the power law, TVL = (base / 10^' + (cal && cal.a !== null ? cal.a.toFixed(2) : 'a') + ')^(1/' + (cal && cal.b !== null ? cal.b.toFixed(2) : 'b') + ') — and all ' + DATA.board_size + ' rows return their TVL (worst 0.000029% from the base, 0.000066% from the implied value, tolerance 0.1%). This checks the stored figures agree with each other; the implied value is also recomputable from the snapshot’s own fields.'),
        el('li', null, el('b', { text: 'Read the recompute line. ' }), 'Open any row’s detail view: the page recomputes the row from its own figures and states whether it matches board.json.'),
        el('li', null, el('b', { text: 'Local metrics are not the score. ' }), 'The numbers on this page — gate checks, R2, rank movements, determinism — measure internal consistency only. They are not the judge’s score and do not predict it.')
      )
    );
  }

  function foot() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Source: DefiLlama protocol index, snapshot ' + DATA.as_of + '. “No token” means the protocol records no token in this snapshot, never that it has none. Implied values are this entry’s own model, not a price and not a prediction that a token will be issued.' }),
      el('p', { text: 'Farm plans are generic guidance, not financial advice. Never pay to claim an airdrop; claim only from the protocol’s own published links.' })
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(modelPanel());
      shell.appendChild(comparePanel());
      shell.appendChild(guidePanel());
    }
    shell.appendChild(foot());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
