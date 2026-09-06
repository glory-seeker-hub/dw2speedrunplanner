# dw2speedrunplanner

I want to create a Digimon World 2 Battle simulator. The idea is to allow the user to create a team to fight one of the many preset enemy teams.
When creating a team, the user needs to pick up to 3 Digimon from the Digimon list and set their stats (Hp, Mp, Atk, Def, Spd) and up to 12 techs (also from a list). Multiple user teams can be saved for later use. After creating the team and picking the enemy team, the user can pick the floor specialty and simulate the battle a set number times (1 milion as default). The app will then simulate the battle, following the battle mechanics rules and record the fight statistics: min number of turns taken to finish (turn = each time a Digimon does something), min number of rounds taken to finish (round = each time all alive Digimon do something), and the entire turn history (Digimon, tech used, tech target, damage dealt) for the simulated battle that had the min amount of turns. Use the english language.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dw2speedrunplanner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/25d3eac6-b6d9-426b-a521-6519eab7d5f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
