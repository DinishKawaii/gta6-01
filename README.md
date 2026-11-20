[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/DinishKawaii/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/DinishKawaii/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMARA — Open World Crime

Kai Mercer owes fixer Vera Solano $8,000. Three jobs across a sun-soaked
original city will pay it off — if the Solmara PD does not catch him first.

An open-world crime game in the browser, built with three.js (vendored):
a 9×9-block city with seven districts, a beach and the sea; seven cars to
steal and drive; traffic and pedestrians; a wanted level with police
Interceptors that chase, ram and arrest; three story missions; punch
combat; a HUD with a live round minimap; start, pause, busted, game-over
and win screens; localStorage saves; and fully synthesized WebAudio
sound — engine, sirens and a chord-pad score.

## Play

Serve `game/` with any static HTTP server and open `index.html` in
desktop Chrome. No network request is made: every asset is procedural.

- **WASD** move / drive, **Shift** run / boost, **Space** jump / brake
- **E** enter a car, talk to Vera, take a job · **F** punch
- **Mouse drag** orbits the camera · **P** pause · **L** save · **M** mute

## Layout

- `game/index.html` — page, import map, HUD and menus
- `game/src/main.js` — game loop, driving, wanted level, camera
- `game/src/city.js` — Solmara: districts, buildings, road graph, BFS
- `game/src/vehicles.js` — the seven cars, traffic, police chases
- `game/src/people.js` — Kai on foot and the pedestrians
- `game/src/missions.js` — Vera's three jobs
- `game/src/hud.js` — HUD, live minimap, menus
- `game/src/audio.js` — synthesized engine, sirens, music
- `game/src/textures.js` — canvas-painted building and ground textures
- `game/src/rng.js`, `game/src/input.js`, `game/src/save.js` — utilities
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to
  `/output` and writes `/output/dossier.json`

Built for the make.fun [gta6-01 bounty](https://make.fun/bounty/gta6-01).
