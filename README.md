# NationState

A turn-based nation building strategy game that runs entirely in the browser. Lead a young realm through 150 years of growth, diplomacy and war against five AI nations on a procedurally generated hex map.

## Features

- **Provinces and population.** Every hex has terrain, people, unrest, devastation and buildings. Population grows when fed and content, and it is both your tax base and your recruiting pool.
- **Economy.** Four resources (gold, food, wood, iron), nine building types, a tax slider, food storage and famine. Stability is derived from unrest, war weariness and taxation, and it scales income, growth and troop morale.
- **Military.** Five unit types with distinct roles (militia, infantry, archers, cavalry, siege engines). Battles are resolved round by round with terrain, walls, siege engines, barracks, technology and morale all mattering. Every battle produces a detailed report.
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
  military.ts    battle resolution, conquest, rebellions
  diplomacy.ts   relations, wars, peace, alliances
  ai.ts          AI nation decision making
  events.ts      random events and their consequences
  turn.ts        end-of-turn processing and victory checks
  actions.ts     the reducer that applies player actions
src/components/  React UI: hex map, panels and modals
```
