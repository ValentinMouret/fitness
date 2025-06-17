# Back-office
«Back-office for your life».

## Stack
- React Router v7 (framework mode)
- TypeScript
- Drizzle
- PostgreSQL
- Biome
- pnpm
- zod

## Useful commands
```shell
pnpm i # install dependencies
pnpm build # build the project
pnpm dev # run the project in watch/dev mode. Don’t run this as the server is already running.
pnpm fmt # format
pnpm lint # lint
pnpm tc # typecheck + generate react-router types
pnpm tc:watch # typecheck in watch mode
pnpm test # run tests

pnpm db:dev # updates the database with schema changes (command to run in dev only)
pnpm db:generate # once done developing DB changes, creates a migration
pnpm db:migrate # run migrations
pnpm db:seed
```

## Code style
- Follow react-router v7 patterns (loader, clientLoader, actions)
  - If interactivity is needed without navigation, use `useFetcher`.
- Adopt a functional approach.
  - Unless it would have a significant impact on performance or readability.
- Use `readonly` types
- Base things around fundamental datastructures (like with the Clojure philosophy: arrays, maps, sets, ...)

## Style
- No Tailwind CSS
- Vanilla CSS

## Design
- Light, minimalist

## Other resources
- database instructions: `docs/database.md` (read this before working on the database or modelisation)
- frontend instructions: `docs/frontend.md` (read this before working on the frontend)
- ddd instructions: `docs/domain-driven-development.md` (read this before working on the features)

## Agent
- When you work on stuff, think about regularly running type checking, then linting, then tests.
  - Fix what’s broken as you go.
- Start by the domain modelling, then move on to infrastructure topics.
- If at any point you need more information, please ask your questions before moving forward.
