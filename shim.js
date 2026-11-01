// A small stand-in for the claude.ai dashboard runtime, so the same page runs as a static site.
(() => {
  const files = {
    games: 'data/nba_games.csv',
    teams: 'data/nba_teams.csv',
    eras: 'data/nba_eras.csv',
    players: 'data/nba_players.csv',
  };
  const defaults = {
    tab: 'eras', type: 'Regular season', era: 'all', metric: 'ppg', season: 2026, franchise: 'Celtics',
    gsort: 'total_desc', gfrom: 1947, gto: 2027, gteam: null,
    pseason: 2026, pstat: 'pts', pmin: 20, pteam: null, pq: null, player: 'nikola jokic',
  };
  let params = {...defaults};
  const store = {};     // id -> {status, data, message}
  const calcs = {};     // id -> {inputs, fn}
  const memo = {};      // id -> result of a calc
  const onDataFns = [];
  const drawers = new Map();
  let queued = false, reasons = new Set();
  let pending = Object.keys(files).length;

  const load = (id) => {
    if (store[id]) return;
    store[id] = {status: 'loading', data: []};
    fetch(files[id])
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.text(); })
      .then((t) => { store[id] = {status: 'ok', data: d3.csvParse(t)}; })
      .catch((e) => { store[id] = {status: 'error', data: [], message: String(e)}; })
      .finally(() => { if (--pending === 0) schedule('data'); });
  };

  const data = (id) => {
    if (files[id]) { load(id); return store[id]; }
    const c = calcs[id];
    if (!c) return {status: 'missing', data: []};
    if (memo[id]) return memo[id];
    const ins = c.inputs.map(data);
    if (ins.some((d) => d.status === 'error')) return {status: 'error', data: []};
    if (ins.some((d) => d.status !== 'ok')) return {status: 'loading', data: []};
    try { memo[id] = {status: 'ok', data: c.fn(...ins.map((d) => d.data))}; }
    catch (e) { console.error(e); memo[id] = {status: 'error', data: [], message: String(e)}; }
    return memo[id];
  };

  const visible = (el) => !el.closest('[hidden]');
  const runDraw = (name) => {
    const fn = drawers.get(name);
    if (!fn) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      if (!visible(el)) return;
      try { fn(el); } catch (e) { console.error(name, e); }
    });
  };
  const render = () => {
    queued = false;
    window.dash.reason = reasons.has('data') ? 'data' : reasons.has('params') ? 'params' : reasons.has('resize') ? 'resize' : 'other';
    reasons = new Set();
    onDataFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    for (const name of drawers.keys()) runDraw(name);
  };
  function schedule(reason) { reasons.add(reason || 'other'); if (!queued) { queued = true; requestAnimationFrame(render); } }

  const css = getComputedStyle(document.documentElement);
  window.dash = {
    data,
    calc: (id, def) => { calcs[id] = def; },
    loader: () => {},
    onData: (fn) => { onDataFns.push(fn); schedule(); },
    draw: (name, fn) => { if (fn) { drawers.set(name, fn); schedule(); } else runDraw(name); },
    params: () => ({...params}),
    setParams: (p) => { params = {...params, ...p}; schedule('params'); },
    resetParams: () => { params = {...defaults}; schedule('params'); },
    setLink: (name) => { history.replaceState(null, '', '#' + name); },
    refresh: () => {},
    reason: 'data',
    get colors() { return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => getComputedStyle(document.documentElement).getPropertyValue('--series-' + i).trim()); },
  };
  let w = 0;
  addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; schedule('resize'); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => schedule('resize'));
  Object.keys(files).forEach(load);
})();
