// Game deep dive (box scores, team stats, context) and the dominant players summary for each era.
(() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const f1 = d3.format('.1f'), pct = (m, a) => (a ? d3.format('.1%')(m / a) : '—');
  const fmtDate = (s) => d3.utcFormat('%A, %B %-d, %Y')(new Date(s + 'T00:00:00Z'));
  const info = () => { const t = dash.data('teams'); return t.status === 'ok' ? new Map(t.data.map((r) => [r.team, r])) : new Map(); };
  const nameOf = (code) => (info().get(code) || {}).name || code;
  const franchiseOf = (code) => (info().get(code) || {}).franchise || code;

  // Box scores load per season, on demand.
  const boxCache = new Map();
  nx.box = (season) => {
    if (season < 1997) return Promise.resolve(null);
    if (!boxCache.has(season)) {
      boxCache.set(season, fetch(`data/box/${season}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    }
    return boxCache.get(season);
  };
  // Player row fields: side, name, pos, starter, min, pts, reb, ast, stl, blk, tov, fgm, fga, 3pm, 3pa, ftm, fta, +/-, oreb, pf
  const P = {side: 0, name: 1, pos: 2, starter: 3, min: 4, pts: 5, reb: 6, ast: 7, stl: 8, blk: 9, tov: 10, fgm: 11, fga: 12, tpm: 13, tpa: 14, ftm: 15, fta: 16, pm: 17, oreb: 18, pf: 19};
  nx.topScorer = (box) => (box && box.p.length ? box.p.slice().sort((a, b) => b[P.pts] - a[P.pts])[0] : null);

  // Elo after the game, using the same formula as the ratings (K = 20, 100-point home edge, margin multiplier).
  const eloShift = (g) => {
    const homeWon = g.home_pts > g.away_pts;
    const diff = g.home_elo + (g.neutral ? 0 : 100) - g.away_elo;
    const mult = Math.pow(g.margin + 3, 0.8) / (7.5 + 0.006 * (homeWon ? diff : -diff));
    const p = homeWon ? g.winner_odds / 100 : 1 - g.winner_odds / 100;
    return 20 * mult * ((homeWon ? 1 : 0) - p);
  };

  // ---------- The panel ----------
  const panel = el('div', 'nx-gp'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Game details');
  const backdrop = el('div', 'nx-gp-backdrop');
  const sheet = el('div', 'nx-gp-sheet');
  const close = el('button', 'nx-gp-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close game details');
  const body = el('div', 'nx-gp-body');
  sheet.append(close, body); panel.append(backdrop, sheet);
  document.body.append(panel);
  let lastFocus = null;
  const hide = () => {
    panel.classList.remove('nx-open');
    setTimeout(() => { panel.hidden = true; }, nx.dur(320));
    document.documentElement.classList.remove('nx-noscroll');
    if (location.hash.startsWith('#game-')) history.replaceState(null, '', '#' + (dash.params().tab || 'eras'));
    if (lastFocus) lastFocus.focus();
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) hide(); });

  const section = (title) => { const s = el('section', 'nx-gp-sec'); s.append(el('h3', 'nx-gp-h', title)); return s; };

  nx.openGame = (id) => {
    const all = dash.data('games_plus');
    if (all.status !== 'ok') return;
    const g = all.data.find((x) => x.game_id === id);
    if (!g) return;
    lastFocus = document.activeElement;
    body.replaceChildren();
    body.scrollTop = 0; sheet.scrollTop = 0;
    history.replaceState(null, '', '#game-' + id);

    // Scoreboard
    const head = el('div', 'nx-gp-board');
    head.append(el('div', 'nx-gp-meta', fmtDate(g.date) + ' · ' + g.type + (g.neutral ? ' · Neutral site' : '')));
    const row = el('div', 'nx-gp-teams');
    for (const [code, pts, where] of [[g.away, g.away_pts, 'Away'], [g.home, g.home_pts, 'Home']]) {
      const [c1, c2] = nx.teamColors(code);
      const t = el('div', 'nx-gp-team' + (code === g.winner ? ' nx-win' : ''));
      t.style.setProperty('--team', c1); t.style.setProperty('--team2', c2);
      const who = el('div', 'nx-gp-who'); who.append(el('span', 'nx-gp-where', where + ' · ' + code), el('span', 'nx-gp-name', nameOf(code)));
      const sc = el('span', 'nx-gp-score', '0');
      t.append(who, sc); row.append(t);
      nx.countTo(sc, pts, (x) => String(Math.round(x)));
    }
    head.append(row);
    const upset = g.winner_odds < 35;
    head.append(el('div', 'nx-gp-final', 'Final · ' + nameOf(g.winner) + ' by ' + g.margin + (upset ? ' · Upset' : '')));
    body.append(head);

    // Pre-game odds and Elo
    const odds = section('Before tip-off');
    const homeP = g.winner === g.home ? g.winner_odds : 100 - g.winner_odds;
    const bar = el('div', 'nx-gp-odds');
    const [ca] = nx.teamColors(g.away), [ch] = nx.teamColors(g.home);
    const aw = el('div', 'nx-gp-odds-a'); aw.style.background = ca; aw.style.width = '50%';
    const hw = el('div', 'nx-gp-odds-h'); hw.style.background = ch; hw.style.width = '50%';
    bar.append(aw, hw);
    requestAnimationFrame(() => requestAnimationFrame(() => { aw.style.width = (100 - homeP) + '%'; hw.style.width = homeP + '%'; }));
    const lab = el('div', 'nx-gp-odds-lab');
    lab.append(el('span', '', g.away + ' ' + f1(100 - homeP) + '%'), el('span', 'nx-muted', 'Elo win chance'), el('span', '', g.home + ' ' + f1(homeP) + '%'));
    const shift = eloShift(g);
    const elo = el('div', 'nx-gp-elo');
    for (const [code, pre, d] of [[g.away, g.away_elo, -shift], [g.home, g.home_elo, shift]]) {
      const c = el('div', 'nx-gp-elo-card');
      c.append(nx.chip(code), el('span', 'nx-gp-elo-num', String(pre)), el('span', 'nx-gp-elo-arrow ' + (d >= 0 ? 'nx-up' : 'nx-down'), (d >= 0 ? '▲ +' : '▼ ') + f1(d) + ' → ' + Math.round(pre + d)));
      elo.append(c);
    }
    odds.append(bar, lab, elo);
    body.append(odds);

    // Records going in and head to head
    const ctx = section('Context');
    const season = all.data.filter((x) => x.season === g.season && x.type === 'Regular season' && x.date < g.date);
    const rec = (code) => {
      const gs = season.filter((x) => x.home === code || x.away === code);
      const w = gs.filter((x) => x.winner === code).length, last = gs.slice(-10), lw = last.filter((x) => x.winner === code).length;
      return [w + '-' + (gs.length - w), last.length ? lw + '-' + (last.length - lw) : '—'];
    };
    const grid = el('div', 'nx-gp-ctx');
    for (const code of [g.away, g.home]) {
      const [r, l10] = rec(code);
      const c = el('div', 'nx-gp-ctx-card');
      c.append(nx.chip(code), el('span', 'nx-gp-ctx-big', r), el('span', 'nx-muted', 'Record going in · last 10: ' + l10));
      grid.append(c);
    }
    ctx.append(grid);
    const fa = franchiseOf(g.away), fh = franchiseOf(g.home);
    const meetings = all.data.filter((x) => { const a = franchiseOf(x.home), b = franchiseOf(x.away); return (a === fa && b === fh) || (a === fh && b === fa); });
    const wA = meetings.filter((x) => franchiseOf(x.winner) === fa).length;
    ctx.append(el('p', 'nx-gp-h2h', `All-time meetings: ${meetings.length}. ${nameOf(g.away)} ${wA}, ${nameOf(g.home)} ${meetings.length - wA}.`));
    const i = meetings.findIndex((x) => x.game_id === g.game_id);
    const near = meetings.slice(Math.max(0, i - 3), i).concat(meetings.slice(i + 1, i + 4));
    if (near.length) {
      const list = el('div', 'nx-gp-meets');
      for (const m of near) {
        const b = el('button', 'nx-gp-meet'); b.type = 'button';
        b.textContent = `${m.season_label} · ${m.away} ${m.away_pts} @ ${m.home} ${m.home_pts}`;
        b.addEventListener('click', () => nx.openGame(m.game_id));
        list.append(b);
      }
      ctx.append(el('p', 'nx-muted', 'Nearby meetings (open one to jump to it):'), list);
    }
    body.append(ctx);

    // Box score, loaded on demand
    const boxSec = section('Box score');
    const note = el('p', 'nx-muted', g.season >= 1997 ? 'Loading box score…' : 'Box scores start with the 1996-97 season.');
    boxSec.append(note);
    body.append(boxSec);
    panel.hidden = false;
    document.documentElement.classList.add('nx-noscroll');
    requestAnimationFrame(() => panel.classList.add('nx-open'));
    close.focus();

    nx.box(g.season).then((data) => {
      if (body.contains(note) === false) return;
      const box = data && data[g.game_id];
      if (!box) { if (g.season >= 1997) note.textContent = 'No box score for this game.'; return; }
      note.remove();
      renderBox(boxSec, g, box);
    });
  };

  const renderBox = (sec, g, box) => {
    const sides = [g.home, g.away]; // side 0 = home, 1 = away
    // Top performers
    const leaders = el('div', 'nx-gp-leaders');
    for (const [k, label] of [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists']]) {
      const top = box.p.slice().sort((a, b) => b[P[k]] - a[P[k]])[0];
      if (!top) continue;
      const code = sides[top[P.side]], [c1, c2] = nx.teamColors(code);
      const c = el('div', 'nx-gp-leader'); c.style.setProperty('--team', c1); c.style.setProperty('--team2', c2);
      const n = el('span', 'nx-gp-leader-num', '0');
      c.append(el('span', 'nx-gp-leader-lab', label + ' leader'), n, el('span', 'nx-gp-leader-name', top[P.name]),
        el('span', 'nx-gp-leader-line', `${code} · ${top[P.pts]} pts, ${top[P.reb]} reb, ${top[P.ast]} ast · ${top[P.fgm]}-${top[P.fga]} FG`));
      leaders.append(c);
      nx.countTo(n, top[P[k]], (x) => String(Math.round(x)));
    }
    sec.append(leaders);

    // Team stat comparison (away left, home right). Turnovers and fouls are summed from players.
    const sum = (side, k) => box.p.filter((r) => r[P.side] === side).reduce((a, r) => a + (r[P[k]] || 0), 0);
    const T = (side, i) => { const v = box.t[side][i]; return v == null || v < 0 ? null : v; };
    const lines = [
      ['Field goal %', (s) => (T(s, 1) ? T(s, 0) / T(s, 1) : null), (s) => `${T(s, 0)}-${T(s, 1)} (${pct(T(s, 0), T(s, 1))})`],
      ['Threes made', (s) => T(s, 2), (s) => `${T(s, 2)}-${T(s, 3)} (${pct(T(s, 2), T(s, 3))})`],
      ['Free throws made', (s) => T(s, 4), (s) => `${T(s, 4)}-${T(s, 5)}`],
      ['Rebounds', (s) => T(s, 7) ?? sum(s, 'reb'), (s) => String(T(s, 7) ?? sum(s, 'reb'))],
      ['Offensive rebounds', (s) => sum(s, 'oreb'), (s) => String(sum(s, 'oreb'))],
      ['Assists', (s) => sum(s, 'ast'), (s) => String(sum(s, 'ast'))],
      ['Steals', (s) => sum(s, 'stl'), (s) => String(sum(s, 'stl'))],
      ['Blocks', (s) => sum(s, 'blk'), (s) => String(sum(s, 'blk'))],
      ['Turnovers', (s) => sum(s, 'tov'), (s) => String(sum(s, 'tov'))],
      ['Points in the paint', (s) => T(s, 13), (s) => String(T(s, 13))],
      ['Fast break points', (s) => T(s, 14), (s) => String(T(s, 14))],
      ['Largest lead', (s) => T(s, 15), (s) => String(T(s, 15))],
    ];
    const cmp = el('div', 'nx-gp-cmp');
    const head = el('div', 'nx-gp-cmp-head'); head.append(nx.chip(g.away), el('span', 'nx-muted', 'Team stats'), nx.chip(g.home)); cmp.append(head);
    const [ca] = nx.teamColors(g.away), [ch] = nx.teamColors(g.home);
    lines.forEach(([label, val, text], i) => {
      const a = val(1), h = val(0);
      if (a == null || h == null) return;
      const total = (a + h) || 1;
      const r = el('div', 'nx-gp-cmp-row');
      const bars = el('div', 'nx-gp-cmp-bars');
      const ba = el('div', 'nx-gp-cmp-a'), bh = el('div', 'nx-gp-cmp-h');
      ba.style.background = ca; bh.style.background = ch;
      ba.style.transitionDelay = bh.style.transitionDelay = (i * 40) + 'ms';
      bars.append(ba, bh);
      r.append(el('span', 'nx-gp-cmp-v' + (a > h ? ' nx-strong' : ''), text(1)), el('div', 'nx-gp-cmp-mid', label), el('span', 'nx-gp-cmp-v nx-r' + (h > a ? ' nx-strong' : ''), text(0)), bars);
      cmp.append(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { ba.style.width = (50 * a / total) + '%'; bh.style.width = (50 * h / total) + '%'; }));
    });
    sec.append(cmp);

    // Player tables
    for (const side of [1, 0]) {
      const code = sides[side], [c1] = nx.teamColors(code);
      const wrap = el('div', 'nx-gp-box');
      const title = el('div', 'nx-gp-box-title'); title.style.borderColor = c1;
      title.append(nx.chip(code), el('span', '', nameOf(code)));
      wrap.append(title);
      const tw = el('div', 'nx-table-wrap nx-gp-tw');
      const table = el('table', 'nx-table nx-gp-table');
      const thead = el('thead'), trh = el('tr');
      for (const [h, c] of [['Player', ''], ['MIN', 'nx-num'], ['PTS', 'nx-num'], ['REB', 'nx-num'], ['AST', 'nx-num'], ['STL', 'nx-num'], ['BLK', 'nx-num'], ['TO', 'nx-num'], ['FG', 'nx-num'], ['3PT', 'nx-num'], ['FT', 'nx-num'], ['+/-', 'nx-num']]) trh.append(el('th', c, h));
      thead.append(trh); table.append(thead);
      const tb = el('tbody');
      const rows = box.p.filter((r) => r[P.side] === side);
      const best = Math.max(...rows.map((r) => r[P.pts]));
      for (const r of rows) {
        const tr = el('tr', r[P.starter] ? 'nx-starter' : '');
        const td = el('td'); td.append(el('span', 'nx-gp-pname', r[P.name]), el('span', 'nx-gp-pos', r[P.pos] || ''));
        tr.append(td);
        const ptsTd = el('td', 'nx-num' + (r[P.pts] === best ? ' nx-hot' : ''), String(r[P.pts]));
        tr.append(el('td', 'nx-num', String(r[P.min] ?? '')), ptsTd);
        for (const k of ['reb', 'ast', 'stl', 'blk', 'tov']) tr.append(el('td', 'nx-num', String(r[P[k]] ?? '')));
        tr.append(el('td', 'nx-num', `${r[P.fgm]}-${r[P.fga]}`), el('td', 'nx-num', `${r[P.tpm]}-${r[P.tpa]}`), el('td', 'nx-num', `${r[P.ftm]}-${r[P.fta]}`),
          el('td', 'nx-num', r[P.pm] == null ? '' : (r[P.pm] > 0 ? '+' : '') + r[P.pm]));
        tb.append(tr);
      }
      const tot = el('tr', 'nx-total');
      const s = (k) => rows.reduce((a, r) => a + (r[P[k]] || 0), 0);
      const teamReb = box.t[side][7];
      tot.append(el('td', '', 'Team'), el('td', 'nx-num', ''), el('td', 'nx-num', String(s('pts'))), el('td', 'nx-num', String(teamReb != null && teamReb >= 0 ? teamReb : s('reb'))));
      for (const k of ['ast', 'stl', 'blk', 'tov']) tot.append(el('td', 'nx-num', String(s(k))));
      tot.append(el('td', 'nx-num', `${s('fgm')}-${s('fga')}`), el('td', 'nx-num', `${s('tpm')}-${s('tpa')}`), el('td', 'nx-num', `${s('ftm')}-${s('fta')}`), el('td', 'nx-num', ''));
      tb.append(tot);
      table.append(tb); tw.append(table); wrap.append(tw);
      sec.append(wrap);
    }
    sec.append(el('p', 'nx-muted', 'Box score from ESPN via SportsDataverse. Starters in bold; the game-high scorer on each team is highlighted.'));
  };

  // Open from game cards, game table rows and Finals game chips.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-game]');
    if (t) { nx.openGame(t.dataset.game); return; }
    const tr = e.target.closest('#game-list-card tbody tr[data-key]');
    if (tr) nx.openGame(decodeURIComponent(tr.dataset.key));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-game]')) { e.preventDefault(); nx.openGame(e.target.dataset.game); }
  });
  // Open a shared game link once the data is in.
  let opened = false;
  dash.onData(() => {
    if (opened || dash.data('games_plus').status !== 'ok' || dash.data('teams').status !== 'ok') return;
    opened = true;
    if (location.hash.startsWith('#game-')) nx.openGame(location.hash.slice(6));
  });

  // ---------- Top scorer on each game card ----------
  dash.draw('game-card-stars', (box) => {
    box.querySelectorAll('.nx-gcard[data-game]').forEach((card) => {
      const g = dash.data('games_plus').data.find((x) => x.game_id === card.dataset.game);
      if (!g || g.season < 1997 || card.querySelector('.nx-gcard-star')) return;
      nx.box(g.season).then((data) => {
        const top = nx.topScorer(data && data[g.game_id]);
        if (!top || card.querySelector('.nx-gcard-star')) return;
        const code = top[P.side] === 0 ? g.home : g.away;
        const s = el('div', 'nx-gcard-star');
        s.append(el('span', 'nx-gcard-star-lab', 'Top scorer'), el('span', 'nx-gcard-star-name', top[P.name] + ' (' + code + ')'), el('span', 'nx-gcard-star-line', `${top[P.pts]} pts · ${top[P.reb]} reb · ${top[P.ast]} ast`));
        card.querySelector('.nx-gcard-foot').before(s);
      });
    });
  });

  // ---------- Finals game strip ----------
  dash.draw('finals-games', (box) => {
    box.replaceChildren();
    if (nx.state(['champions', 'games_plus']) !== 'ok') return;
    const s = Number(dash.params().season);
    const c = dash.data('champions').data.find((r) => r.season === s);
    if (!c) return;
    const pair = new Set([c.champion, c.runner_up]);
    const games = dash.data('games_plus').data.filter((g) => g.season === s && g.type === 'Playoffs' && pair.has(g.home) && pair.has(g.away));
    box.append(el('span', 'nx-finals-strip-lab', 'Finals games · open one for the box score'));
    games.forEach((g, i) => {
      const b = el('button', 'nx-fgame'); b.type = 'button'; b.dataset.game = g.game_id;
      const [c1] = nx.teamColors(g.winner); b.style.setProperty('--team', c1);
      b.append(el('span', 'nx-fgame-n', 'G' + (i + 1)), el('span', 'nx-fgame-s', `${g.away} ${g.away_pts}-${g.home_pts} ${g.home}`));
      box.append(b);
    });
  });

  // ---------- Dominant players of the era ----------
  dash.draw('era-players', (box) => {
    if (nx.state(['players', 'era_summary', 'teams']) !== 'ok') { box.replaceChildren(); return; }
    const p = dash.params();
    const era = dash.data('era_summary').data.find((r) => r.era === p.era) || {first_season: 0, last_season: 9999};
    const type = p.type === 'Playoffs' ? 'Playoffs' : 'Regular season';
    const rows = dash.data('players').data.filter((r) => r.season_type === type && Number(r.season) >= era.first_season && Number(r.season) <= era.last_season);
    box.replaceChildren();
    if (!rows.length) {
      box.append(el('p', 'nx-muted', 'Player stats start with the 1996-97 season, so this era has no player data.'));
      return;
    }
    const first = d3.min(rows, (r) => Number(r.season));
    if (first > era.first_season) box.append(el('p', 'nx-muted', `Player stats cover ${nx.seasonLabel(first)} onward in this era.`));

    // Season leaders: highest per-game average among players with 70% of the most games played that season.
    const titles = new Map();
    for (const [, rs] of d3.group(rows, (r) => r.season)) {
      const maxGp = d3.max(rs, (r) => Number(r.gp));
      const q = rs.filter((r) => Number(r.gp) >= 0.7 * maxGp);
      for (const k of ['pts', 'reb', 'ast']) {
        const top = q.slice().sort((a, b) => Number(b[k]) - Number(a[k]))[0];
        if (!top) continue;
        const t = titles.get(top.player_key) || {pts: 0, reb: 0, ast: 0};
        t[k]++; titles.set(top.player_key, t);
      }
    }
    const agg = d3.rollups(rows, (v) => {
      const gp = d3.sum(v, (r) => Number(r.gp)), tot = (k) => d3.sum(v, (r) => Number(r[k]) * Number(r.gp));
      const best = v.slice().sort((a, b) => Number(b.pts) - Number(a.pts))[0];
      const team = d3.greatest(d3.rollups(v, (x) => d3.sum(x, (r) => Number(r.gp)), (r) => r.team), (d) => d[1])[0];
      return {name: v[v.length - 1].player, key: v[0].player_key, team, seasons: v.length, gp, pts: tot('pts'), reb: tot('reb'), ast: tot('ast'), fg3m: tot('fg3m'), best};
    }, (r) => r.player_key).map((d) => d[1]);

    // Era kings
    const kings = el('div', 'nx-kings');
    for (const [k, label] of [['pts', 'Most points'], ['reb', 'Most rebounds'], ['ast', 'Most assists'], ['fg3m', 'Most threes']]) {
      const top = agg.slice().sort((a, b) => b[k] - a[k])[0];
      if (!top || !top[k]) continue;
      const [c1, c2] = nx.teamColors(top.team);
      const c = el('button', 'nx-king'); c.type = 'button'; c.style.setProperty('--team', c1); c.style.setProperty('--team2', c2);
      const n = el('span', 'nx-king-num', '0');
      c.append(el('span', 'nx-king-lab', label), n, el('span', 'nx-king-name', top.name), el('span', 'nx-king-sub', `${top.team} · ${top.seasons} seasons`));
      c.addEventListener('click', () => { dash.setParams({tab: 'players', player: top.key}); dash.setLink('players'); scrollTo({top: 0, behavior: nx.dur() ? 'smooth' : 'auto'}); });
      kings.append(c);
      nx.countTo(n, Math.round(top[k]), (x) => d3.format(',')(Math.round(x)));
    }
    box.append(kings);

    // Top 10 by total points
    const top = agg.sort((a, b) => b.pts - a.pts).slice(0, 10);
    const list = el('ol', 'nx-dom');
    top.forEach((d, i) => {
      const li = el('li', 'nx-dom-row');
      if (nx.dur()) li.style.animationDelay = (i * 45) + 'ms'; else li.style.animation = 'none';
      const [c1] = nx.teamColors(d.team); li.style.setProperty('--team', c1);
      const b = el('button', 'nx-dom-btn'); b.type = 'button';
      b.addEventListener('click', () => { dash.setParams({tab: 'players', player: d.key}); dash.setLink('players'); scrollTo({top: 0, behavior: nx.dur() ? 'smooth' : 'auto'}); });
      const who = el('div', 'nx-dom-who');
      who.append(el('span', 'nx-dom-name', d.name), el('span', 'nx-dom-sub', `${d.seasons} seasons · ${d3.format(',')(d.gp)} games · best: ${d.best.season_label}, ${f1(Number(d.best.pts))} ppg`));
      const t = titles.get(d.key);
      const badges = el('div', 'nx-dom-badges');
      if (t) for (const [k, lab] of [['pts', 'scoring'], ['reb', 'rebounding'], ['ast', 'assists']]) if (t[k]) badges.append(el('span', 'nx-badge', `${t[k]}× ${lab} leader`));
      who.append(badges);
      const nums = el('div', 'nx-dom-nums');
      for (const [v, lab] of [[d.pts / d.gp, 'PPG'], [d.reb / d.gp, 'RPG'], [d.ast / d.gp, 'APG']]) { const s = el('span', 'nx-dom-num'); s.append(el('b', '', f1(v)), el('i', '', lab)); nums.append(s); }
      b.append(el('span', 'nx-dom-rank', String(i + 1)), nx.chip(d.team), who, nums, el('span', 'nx-dom-total', d3.format(',')(Math.round(d.pts)) + ' pts'));
      li.append(b); list.append(li);
    });
    box.append(list);
  });
})();
