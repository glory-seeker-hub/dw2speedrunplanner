# Digimon World 2 — Run Planner & Battle Simulator

An unofficial fan-made tool for planning routes and exploring battle strategies in Digimon World 2.

[Live app](https://dw2speedrunplanner.lovable.app/) · [Source](https://github.com/glory-seeker-hub/dw2speedrunplanner) · [Issues and suggestions](https://github.com/glory-seeker-hub/dw2speedrunplanner/issues)

See the [v1.2.0 release notes](docs/releases/v1.2.0.md) for changes and the [release checklist](docs/releases/v1.2.0-release-checklist.md) for release verification status.

## What you can do

- Create multiple saved runs, choose a starter, manage the roster and active Digiline, and track battles, growth, digivolution, DNA and trades.
- Browse story encounters and Coliseum ranks. Use **Analyze Battle** to send a historical pre-battle copy to the Simulator without changing the run.
- Build a manual team with customized stats and techniques.
- Capture-aware simulation uses the Planner-recorded target or an optional manual Encounter target. Success requires defeating that Enemy last; simultaneous KOs in one action use the rightmost Enemy (E3 > E2 > E1). Battle Win Rate remains separate from Capture Success Rate.
- Run Random Monte Carlo or Optimized Action Search, choose Fastest Potential, Average Victory or Success Rate, and inspect recommended orders, replay and search details.
- Limit each Player Digimon's allowed simulation techniques and apply exact stat overrides without changing the source Planner run or manual team. Retained fastest executions show resolved targets; screened strategies show intended or policy targets.
- Export a readable route for Print / Save as PDF, download a simulation Markdown report, or export restorable JSON backups.

Open **About → How to Use** for the complete guide, including Search Quality, Thoroughness, accuracy and the narrow supported scope of TAS Luck.

## Saved data and backups

Planner runs are stored in this browser's local storage, on this site's origin. There are no accounts, cloud sync or automatic backups. Clearing site data, changing browsers or using a different origin can make your runs unavailable. Saved manual teams are session-only.

Use **Run Planner → Backup / Import → Export Current Run** or **Export All Runs** to keep a copy outside the browser. Import validates a local JSON file and shows a preview before confirmation. It adds new runs, preserves existing runs, and gives conflicting names an Imported suffix. Cancel leaves saved runs unchanged.

**Export Route is a readable document, not a restorable backup.** Simulation exports describe a frozen result, not a Planner save. Current formats are Planner schema 7, Simulation Report 1 and Backup Format 1.

## Interpreting results

Search is bounded and sampled. Fastest Route Found is the fastest winning execution observed in that search, not proof of a global optimum. Higher budgets and Standard, Thorough or Maximum thoroughness can increase coverage without improving the result. A search may finish with unused budget.

Battle timing includes measured inter-round processing/order-entry overhead: 319 / 385 / 452 frames for 1 / 2 / 3 Players with current HP above zero, independent of Enemy count. Only actual next-round starts are charged. A locked target defeated before execution causes a 194-frame Miss with no MP cost. Other external menu, recovery, item and setup time remains excluded. Player HP/MP depletion does not stop the offensive simulation; required recovery, revival, Guard or item actions are not inserted or counted. Read resource alerts and effect diagnostics before treating a result as an in-game route. TAS Luck controls only supported modeled status outcomes, not all RNG.

Planner and backup processing are client-side. This is a static web app, not an offline PWA; a first load and uncached assets still require network access.

## Local development

Use Node.js and npm. No production environment variables, API credentials or backend are required.

```sh
git clone https://github.com/glory-seeker-hub/dw2speedrunplanner.git
cd dw2speedrunplanner
npm ci
npm run dev
```

Use the URL printed by Vite. To test the production build locally:

```sh
npm run build
npm run preview -- --host 127.0.0.1
```

The static output is `dist/`. Keep the Worker and other generated assets with the HTML. Deployments should serve the root and provide the SPA fallback for unknown paths. Publishing is a separate reviewed step.

## Verification and feedback

```sh
node --test tests/*.test.cjs
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
node scripts/checkBattleSkills.cjs
node scripts/checkBattleEffectCoverage.cjs
npm run lint
npm audit
```

The release audit records the lint baseline and dependency findings; a nonzero lint/audit exit is not silently ignored. Workbook verification is optional for ordinary local use and requires the external source workbook: `python scripts/importBattleSkills.py "path/to/DW2 Modding Info.xlsx" --check`.

Report bugs and suggestions through [GitHub Issues](https://github.com/glory-seeker-hub/dw2speedrunplanner/issues), with reproduction steps, browser and relevant settings. Share a backup only if you intend to disclose its run names and route contents. Public repository and Issues access passed the October 3, 2026 audit follow-up; verify these links again after deployment.

Created by GlorySeeker, initially built with [Lovable](https://lovable.dev). Unofficial fan-made tool. Not affiliated with or endorsed by Bandai, Toei Animation, or the rights holders of Digimon.
