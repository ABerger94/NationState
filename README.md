# NationState

A turn-based nation building strategy game that runs entirely in the browser, rendered as a living 3D world. Lead a young realm through 150 years of growth, diplomacy and war against five AI nations on a procedurally generated hex map.

## Features

- **Real-time 3D world.** Extruded hex terrain with forests, snow-capped peaks, animated water, sky, fog, soft shadows and drifting clouds. Cities grow as you build, walls rise, banners fly, troops stand guard, and armies march into battle with visible clashes.
- **Objectives.** Twenty staged goals with gold rewards guide new players from their first farm to hegemony.
- **Edicts.** One government edict per sphere (economy, military, society) with real trade-offs.
- **Map resources.** Horses, gems, spices, vineyards, fish, ore, timber and fertile soil give provinces character and reasons to fight over them. Luxuries calm the whole realm; horses make cavalry cheaper and stronger.

- **A 3D world.** Extruded terrain hexes with forests, snow-capped peaks, coasts and animated water, drifting clouds with real shadows, national borders, banners and capital towers. Cities visibly grow as you build; walls rise; garrisons stand on the tile. Armies march across the map when you attack and battles flash where they happen.
- **A polished HUD.** Glass panels, tweened resource counters, an in-game advisor that flags famine, unrest, idle scholars and easy conquests, live toasts for world events, a turn report, hover tooltips, keyboard shortcuts (Enter to end turn, 1-5 for tabs, H for home, Tab to hide the panel) and procedural sound with a mute toggle.

- **Provinces and population.** Every hex has terrain, people, unrest, devastation and buildings. Population grows when fed and content, and it is both your tax base and your recruiting pool.
- **Economy.** Four resources (gold, food, wood, iron), nine building types, a tax slider, food storage and famine. Stability is derived from unrest, war weariness and taxation, and it scales income, growth and troop morale.
- **Garrisons and field armies.** Recruited troops join a province garrison, which defends where it stands. To attack you raise a **field army** that marches across the map on movement points, costing more in forest, hills and mountains. Armies merge, split, stand down into a garrison, and carry their own morale.
- **Military.** Five unit types with distinct roles (militia, infantry, archers, cavalry, siege engines). Battles are resolved round by round with terrain, walls, siege engines, barracks, technology and morale all mattering. Defenders fight as the garrison plus every friendly army present. Every battle produces a detailed report.
- **Wars and diplomacy.** Relations, war declarations, peace treaties, war score, gifts and alliances that drag allies into wars.
- **Twelve technologies**, with prerequisites, that shape your economy and army.
- **Random events** with meaningful choices, plus rebellions in restless provinces.
- **AI nations** with four personalities (aggressive, builder, mercantile, defensive) that build, research, recruit, expand into tribal lands, declare wars, sue for peace and form alliances among themselves.
- **Three ways to win:** hold 60% of the map, destroy every rival, or top the scoreboard at turn 150.
- Deterministic seeded worlds and automatic saving to the browser.

## Running locally

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # typecheck and produce the production bundle in dist/
npm run preview  # serve the production bundle
npm test         # engine unit tests and an 80-turn simulation
```

## Deploying to Vercel

The project is a static Vite site, so no server or environment variables are needed.

1. Push this repository to GitHub.
2. In Vercel choose **Add New Project** and import the repository.
3. Vercel detects Vite automatically. The included `vercel.json` sets the build command to `npm run build` and the output directory to `dist`.
4. Deploy. Every push to the production branch redeploys the game.

## Project layout

```
src/engine/      pure game logic, no React
  types.ts       game state shapes
  data.ts        terrain, buildings, units, technologies, AI personalities
  world.ts       seeded map and nation generation
  economy.ts     production, budgets, stability, costs
  population.ts  growth, capacity, unrest
  armies.ts      field armies: movement, pathfinding, merge and split, supply
  military.ts    battle resolution, conquest, rebellions
  diplomacy.ts   relations, wars, peace, alliances
  ai.ts          AI nation decision making
  events.ts      random events and their consequences
  turn.ts        end-of-turn processing and victory checks
  actions.ts     the reducer that applies player actions
src/three/       react-three-fiber scene: tiles, borders, decor, effects, labels, camera
src/ui/          HUD: top bar, advisor, toasts, legend, hover card, icons
src/components/  side panels, modals and the new-game screen
src/advisor.ts   contextual tips computed from the game state
src/audio.ts     procedural sound effects (no audio files)
```
