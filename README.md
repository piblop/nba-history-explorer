# NBA History Explorer

An interactive dashboard of NBA history: every NBA/BAA game since November 1946 and every player season since 1996-97.

**Live site:** https://piblop.github.io/nba-history-explorer/

## What you can do
- **Eras**: dominant players of each era (from 1996-97), and compare scoring, margins, home advantage, upsets and close games across six eras, season by season.
- **Seasons**: champion, league averages, offense vs defense chart and full standings for any season.
- **Teams**: any franchise's titles, Finals trips and win % by season (city moves are kept together).
- **Games**: find the highest-scoring games, biggest blowouts, biggest upsets and closest finishes. Select any game for a deep dive: scoreboard, pre-game Elo odds and rating change, records going in, head-to-head history, and (from 1996-97) team stat comparison, top performers and full box scores.
- **Players**: per-game leaderboards and career charts from 1996-97 on.

Switch between regular season, playoffs and all games at the top right.

## Data
| File | What it holds | Source |
|---|---|---|
| `data/nba_games.csv` | One row per game, with scores and pre-game Elo ratings | FiveThirtyEight / [Neil Paine's NBA Elo](https://github.com/Neil-Paine-1/NBA-elo) to Mar 17, 2025; later games from ESPN box scores via [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data), with Elo carried forward using the same formula |
| `data/nba_players.csv` | Per-game player averages by season | stats.nba.com via SportsDataverse; 2026-27 from ESPN box scores |
| `data/nba_teams.csv` | Team names and franchise groups | FiveThirtyEight franchise ids |
| `data/box/<season>.json` | Box scores by game, 1996-97 on (team stats and player lines) | ESPN box scores via SportsDataverse |
| `data/nba_eras.csv` | Era boundaries | Grouped around rule changes |

ABA, preseason and play-in games are left out. Data runs through Oct 29, 2026.

## Run locally
Any static file server works, for example `python3 -m http.server`, then open http://localhost:8000.

Charts use [d3](https://d3js.org) v7.9.0 (ISC license, bundled as `d3.min.js`).
