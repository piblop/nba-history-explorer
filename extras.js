// NBA visuals and motion: team colors, hero scoreboard, Finals board, banners, game cards, player card.
(() => {
  // Primary and secondary colors for current franchises. Defunct franchises fall back to neutral tones.
  const TEAM_COLORS = {
    Hawks: ['#E03A3E', '#C1D32F'], Celtics: ['#007A33', '#BA9653'], Nets: ['#202020', '#9a9a9a'], Hornets: ['#1D1160', '#00788C'],
    Bulls: ['#CE1141', '#1a1a1a'], Cavaliers: ['#860038', '#FDBB30'], Mavericks: ['#00538C', '#B8C4CA'], Nuggets: ['#0E2240', '#FEC524'],
    Pistons: ['#C8102E', '#1D42BA'], Warriors: ['#1D428A', '#FFC72C'], Rockets: ['#CE1141', '#C4CED4'], Pacers: ['#002D62', '#FDBB30'],
    Clippers: ['#C8102E', '#1D428A'], Lakers: ['#552583', '#FDB927'], Grizzlies: ['#5D76A9', '#12173F'], Heat: ['#98002E', '#F9A01B'],
    Bucks: ['#00471B', '#EEE1C6'], Timberwolves: ['#0C2340', '#78BE20'], Pelicans: ['#0C2340', '#C8102E'], Knicks: ['#006BB6', '#F58426'],
    Thunder: ['#007AC1', '#EF3B24'], Magic: ['#0077C0', '#C4CED4'], '76ers': ['#006BB6', '#ED174C'], Suns: ['#1D1160', '#E56020'],
    'Trail Blazers': ['#E03A3E', '#1a1a1a'], Kings: ['#5A2D81', '#63727A'], Spurs: ['#2a2a2a', '#C4CED4'], Raptors: ['#CE1141', '#1a1a1a'],
    Jazz: ['#002B5C', '#F9A01B'], Wizards: ['#002B5C', '#E31837'],
  };
  const NEUTRAL = ['#5b6472', '#a7afbc'];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  nx.dur = (ms = 750) => (reduced.matches || dash.reason === 'resize' ? 0 : ms);

  // Animate SVG attributes from their current value to a target, staggered by index.
  nx.grow = (sel, attrs, delay = 0) => {
    const D = nx.dur();
    if (!D) { for (const [k, v] of Object.entries(attrs)) sel.attr(k, v); return sel; }
    const t = sel.transition().duration(D).ease(d3.easeCubicOut).delay(typeof delay === 'function' ? delay : () => delay);
    for (const [k, v] of Object.entries(attrs)) t.attr(k, v);
    return sel;
  };
  // Draw a path from start to end.
  nx.drawIn = (path, ms = 1100) => {
    const D = nx.dur(ms), node = path.node();
    if (!D || !node.getTotalLength) return path;
    const L = node.getTotalLength();
    path.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
      .transition().duration(D).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0)
      .on('end', () => path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
    return path;
  };
  // Count a number up from its last shown value.
  nx.countTo = (el, v, fmt) => {
    const prev = Number(el.dataset.v), D = nx.dur(650);
    el.dataset.v = v;
    if (!D || prev === v) { el.textContent = fmt(v); return; }
    const from = Number.isFinite(prev) ? prev : 0;
    d3.select(el).interrupt().transition().duration(D).ease(d3.easeCubicOut)
      .tween('text', () => { const i = d3.interpolateNumber(from, v); return (t) => { el.textContent = fmt(i(t)); }; });
  };
  nx.setStat = (el, k, v) => {
    const n = typeof v === 'number' ? v : NaN;
    if (Number.isFinite(n)) nx.countTo(el, n, (x) => nx.fmtStat(k, k === 'games' || k === 'wins' || k === 'seasons' || k === 'titles' || k === 'finals' || k === 'playoffs' ? Math.round(x) : x));
    else { delete el.dataset.v; el.textContent = nx.fmtStat(k, v); }
  };

  // Team lookups.
  const teamInfo = () => {
    const t = dash.data('teams');
    return t.status === 'ok' ? new Map(t.data.map((r) => [r.team, r])) : new Map();
  };
  nx.franchiseColors = (franchise) => TEAM_COLORS[franchise] || NEUTRAL;
  nx.teamColors = (code) => nx.franchiseColors((teamInfo().get(code) || {}).franchise);
  nx.chip = (code) => {
    const [c1, c2] = nx.teamColors(code);
    const s = document.createElement('span');
    s.className = 'nx-chip'; s.textContent = code;
    s.style.background = c1; s.style.boxShadow = `inset 0 -3px 0 ${c2}`;
    return s;
  };
  window.nxChipCell = (tr, code, text) => {
    const td = document.createElement('td');
    const wrap = document.createElement('span'); wrap.className = 'nx-teamcell';
    wrap.append(nx.chip(code), text);
    td.append(wrap); tr.append(td); return td;
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // Hero scoreboard.
  dash.draw('hero-stats', (box) => {
    const ids = ['games_plus', 'champions', 'players'];
    if (nx.state(ids) !== 'ok') { if (!box.childElementCount) box.replaceChildren(); return; }
    const games = dash.data('games_plus').data, champs = dash.data('champions').data, players = dash.data('players').data;
    const last = champs[champs.length - 1];
    const seasons = new Set(games.map((g) => g.season)).size;
    const tiles = [
      ['Games', games.length, d3.format(',')],
      ['Seasons', seasons, d3.format(',')],
      ['Player seasons', players.length, d3.format(',')],
    ];
    if (!box.childElementCount) {
      for (const [label] of tiles) { const t = el('div', 'nx-board'); t.append(el('span', 'nx-board-num', '0'), el('span', 'nx-board-label', label)); box.append(t); }
      const c = el('div', 'nx-board nx-board-champ');
      c.append(el('span', 'nx-board-num'), el('span', 'nx-board-label'));
      box.append(c);
    }
    const nums = box.querySelectorAll('.nx-board-num');
    tiles.forEach(([, v, f], i) => nx.countTo(nums[i], v, (x) => f(Math.round(x))));
    const champ = box.querySelector('.nx-board-champ');
    const [c1, c2] = nx.teamColors(last.champion);
    champ.style.setProperty('--team', c1); champ.style.setProperty('--team2', c2);
    champ.querySelector('.nx-board-num').textContent = last.champion_name;
    champ.querySelector('.nx-board-label').textContent = last.season_label + ' champions';
  });

  // Titles by franchise in the selected era.
  dash.draw('era-titles', (box) => {
    if (!nx.guard(box, ['champions', 'era_summary', 'teams'], 'chart')) return;
    box.replaceChildren();
    const p = dash.params();
    const era = dash.data('era_summary').data.find((r) => r.era === p.era);
    const info = teamInfo();
    const counts = d3.rollups(dash.data('champions').data.filter((r) => !era || (r.season >= era.first_season && r.season <= era.last_season)),
      (v) => ({n: v.length, code: v[v.length - 1].champion, seasons: v.map((r) => r.season_label)}), (r) => (info.get(r.champion) || {}).franchise || r.champion)
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    const W = box.clientWidth || 360, bh = 22, gap = 8, H = counts.length * (bh + gap) + 4;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Titles by franchise');
    const names = counts.map(([f, d]) => (info.get(d.code) || {}).name || f);
    const left = Math.min(W * 0.45, nx.textWidth(svg, names, 'nx-label') + 12);
    const max = d3.max(counts, (d) => d[1].n) || 1;
    const x = d3.scaleLinear([0, max], [left, W - 30]);
    const tip = nx.tip(box);
    counts.forEach(([f, d], i) => {
      const y0 = i * (bh + gap) + 2, [c1, c2] = nx.franchiseColors(f);
      svg.append('text').attr('class', 'nx-label').attr('x', left - 8).attr('y', y0 + bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(names[i]);
      const g = svg.append('g');
      // one trophy block per title
      const step = (x(max) - left) / max;
      for (let k = 0; k < d.n; k++) {
        const r = g.append('rect').attr('x', left + k * step + 1).attr('y', y0).attr('height', bh).attr('rx', 3)
          .attr('width', 0).attr('fill', c1).attr('stroke', c2).attr('stroke-width', 1.5);
        nx.grow(r, {width: Math.max(2, step - 3)}, i * 50 + k * 25);
      }
      svg.append('text').attr('class', 'nx-label nx-strong').attr('x', left + d.n * step + 6).attr('y', y0 + bh / 2).attr('dy', '0.35em').text(d.n);
      svg.append('rect').attr('x', 0).attr('y', y0 - 2).attr('width', W).attr('height', bh + 4).attr('fill', 'transparent')
        .on('pointerenter', () => tip.show(left + d.n * step, y0, names[i], [{text: d.n + (d.n === 1 ? ' title' : ' titles') + ': ' + d.seasons.join(', '), color: c1}]))
        .on('pointerleave', () => tip.hide());
    });
  });

  // Finals scoreboard for the picked season.
  dash.draw('finals-board', (box) => {
    if (nx.state(['champions', 'team_seasons']) !== 'ok') { box.replaceChildren(); return; }
    const s = Number(dash.params().season);
    const c = dash.data('champions').data.find((r) => r.season === s);
    box.replaceChildren();
    box.hidden = !c;
    if (!c) return;
    const ts = new Map(dash.data('team_seasons').data.filter((r) => r.season === s).map((r) => [r.team, r]));
    const [w, l] = c.series.split('-');
    box.append(el('div', 'nx-finals-title', c.season_label + ' NBA Finals'));
    const row = el('div', 'nx-finals-row');
    for (const [code, name, score, win] of [[c.champion, c.champion_name, w, true], [c.runner_up, c.runner_up_name, l, false]]) {
      const [c1, c2] = nx.teamColors(code), rec = ts.get(code);
      const side = el('div', 'nx-finals-side' + (win ? ' nx-win' : ''));
      side.style.setProperty('--team', c1); side.style.setProperty('--team2', c2);
      const who = el('div', 'nx-finals-who');
      who.append(el('span', 'nx-finals-code', code), el('span', 'nx-finals-name', name), el('span', 'nx-finals-rec', rec ? rec.wins + '-' + rec.losses + ' regular season' : ''));
      const sc = el('span', 'nx-finals-score', '0');
      side.append(who, sc);
      row.append(side);
      nx.countTo(sc, Number(score), (x) => String(Math.round(x)));
    }
    box.append(row);
    box.append(el('div', 'nx-finals-foot', (c.champion_name + ' win the title').toUpperCase()));
  });

  // Championship banners for the picked franchise.
  dash.draw('banners', (box) => {
    if (nx.state(['team_seasons']) !== 'ok') { box.replaceChildren(); return; }
    const f = dash.params().franchise;
    const rows = dash.data('team_seasons').data.filter((r) => r.franchise === f && r.result === 'Champion');
    const [c1, c2] = nx.franchiseColors(f);
    box.replaceChildren();
    if (!rows.length) { box.append(el('p', 'nx-muted', 'No championship banners yet.')); return; }
    const D = nx.dur();
    rows.forEach((r, i) => {
      const b = el('div', 'nx-banner');
      b.style.setProperty('--team', c1); b.style.setProperty('--team2', c2);
      if (D) b.style.animationDelay = (i * 70) + 'ms'; else b.style.animation = 'none';
      b.append(el('span', 'nx-banner-top', 'World champions'), el('span', 'nx-banner-year', r.season_label), el('span', 'nx-banner-team', r.name));
      box.append(b);
    });
  });

  // Top games as scoreboard cards.
  const sorts = {
    total_desc: (a, b) => b.total - a.total, total_asc: (a, b) => a.total - b.total,
    margin_desc: (a, b) => b.margin - a.margin || b.total - a.total, margin_asc: (a, b) => a.margin - b.margin || b.total - a.total,
    odds_asc: (a, b) => a.winner_odds - b.winner_odds, date_desc: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
  };
  dash.draw('game-cards', (box) => {
    if (nx.state(['games_plus', 'teams']) !== 'ok') { box.replaceChildren(); return; }
    const info = teamInfo();
    const games = nxGames().sort(sorts[dash.params().gsort] || sorts.total_desc).slice(0, 6);
    const fmtDate = (s) => d3.utcFormat('%b %-d, %Y')(new Date(s + 'T00:00:00Z'));
    box.replaceChildren(...games.map((g, i) => {
      const card = el('article', 'nx-gcard');
      if (nx.dur()) card.style.animationDelay = (i * 60) + 'ms'; else card.style.animation = 'none';
      card.append(el('div', 'nx-gcard-head', fmtDate(g.date) + ' · ' + (g.type === 'Playoffs' ? 'Playoffs' : 'Regular season')));
      for (const [code, pts] of [[g.away, g.away_pts], [g.home, g.home_pts]]) {
        const line = el('div', 'nx-gcard-line' + (code === g.winner ? ' nx-win' : ''));
        line.append(nx.chip(code), el('span', 'nx-gcard-name', (info.get(code) || {}).name || code), el('span', 'nx-gcard-pts', String(pts)));
        card.append(line);
      }
      card.append(el('div', 'nx-gcard-foot', g.total + ' total · won by ' + g.margin + ' · winner had ' + d3.format('.0f')(g.winner_odds) + '% odds'));
      return card;
    }));
  });

  // Player card with percentile bars.
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const PCT = [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'], ['ts_pct', 'True shooting']];
  dash.draw('player-card', (box) => {
    if (nx.state(['players', 'teams']) !== 'ok') { box.replaceChildren(); return; }
    const p = dash.params(), type = p.type === 'Playoffs' ? 'Playoffs' : 'Regular season';
    const mine = dash.data('players').data.filter((r) => r.player_key === p.player && r.season_type === type);
    if (!mine.length) { box.replaceChildren(el('p', 'nx-muted', 'Select a player from the chart or table.')); return; }
    const want = Number(p.pseason);
    const r = mine.find((x) => Number(x.season) === want) || mine.slice().sort((a, b) => b.season - a.season)[0];
    const [c1, c2] = nx.teamColors(r.team);
    const pool = dash.data('players').data.filter((x) => x.season === r.season && x.season_type === type && Number(x.gp) >= Math.min(20, Number(r.gp)));
    box.replaceChildren();
    box.style.setProperty('--team', c1); box.style.setProperty('--team2', c2);
    const head = el('div', 'nx-pcard-head');
    const name = el('div', 'nx-pcard-name');
    name.append(el('span', 'nx-pcard-player', r.player), el('span', 'nx-pcard-meta', r.season_label + ' · ' + ((teamInfo().get(r.team) || {}).name || r.team) + ' · ' + r.gp + ' games'));
    head.append(nx.chip(r.team), name);
    box.append(head);
    const big = el('div', 'nx-pcard-big');
    for (const [k, label] of [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST']]) {
      const s = el('div', 'nx-pcard-stat'); const n = el('span', 'nx-pcard-num', '0');
      s.append(n, el('span', 'nx-pcard-lab', label)); big.append(s);
      nx.countTo(n, Number(r[k]), d3.format('.1f'));
    }
    box.append(big);
    const bars = el('div', 'nx-pcard-bars');
    bars.append(el('div', 'nx-pcard-bars-title', 'Percentile among players with ' + Math.min(20, Number(r.gp)) + '+ games that season'));
    PCT.forEach(([k, label], i) => {
      const v = Number(r[k]);
      if (r[k] === '' || !Number.isFinite(v)) return;
      const vals = pool.map((x) => Number(x[k])).filter(Number.isFinite);
      const pct = Math.round(100 * vals.filter((x) => x < v).length / Math.max(1, vals.length - 1));
      const line = el('div', 'nx-pbar');
      const track = el('div', 'nx-pbar-track'); const fill = el('div', 'nx-pbar-fill');
      track.append(fill);
      line.append(el('span', 'nx-pbar-lab', label), track, el('span', 'nx-pbar-val', ord(Math.min(99, pct))));
      bars.append(line);
      fill.style.transitionDelay = (i * 60) + 'ms';
      if (nx.dur()) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.min(100, pct) + '%'; }));
      else { fill.style.transition = 'none'; fill.style.width = Math.min(100, pct) + '%'; }
    });
    box.append(bars);
  });
})();
