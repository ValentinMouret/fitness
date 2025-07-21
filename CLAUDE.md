# Fitness
Fitness is an app that centralises nutrition, fitness, and habits.

## Stack
- React Router v7 (framework mode, _à la_ Remix)
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

## React-router v7
The framework we use here is react-router v7.
Once a route is defined in `app/routes.ts` and this generates types 

## Code style
- Follow react-router v7 patterns (`loader`, `clientLoader`, `action`)
  - ALWAYS use `useFetcher` if interactivity is needed WITHOUT navigation.
- Adopt a functional approach.
  - Unless it would have a significant impact on performance or readability.
- Use `readonly` types

## Style
- Use Radix components
- Keep styling minimal and centralised in the Radix theme

## Patterns
I use `neverthrow` to have errors as value.
Always bubble up domain and application layer errors to the infrastructure layer.
The infrastructure layer then decides how to handle the errors, potentially by returning an HTTP error.
## Design
- Light, minimalist

## Routes
The routes are managed by the file `app/routes.ts`. The content follows React-Router v7 patterns.

The convention we adopt in the repo is to have the folder structure follow the routes structures.
Examples:
- `/workout` ->`routes/workout/index.tsx`.
- `/workout/edit` -> `routes/workout/edit.tsx`
- `workout/exerice/edit` -> `routes/workout/exercise/edit.tsx`
## Other resources
- database instructions: `docs/database.md` (read this before working on the database or modelisation)
- frontend instructions: `docs/frontend.md` (read this before working on the frontend)
- ddd instructions: `docs/domain-driven-development.md` (read this before working on the features)

## Agent
- An instance of the server is already running in dev mode. NEVER try to boot another instance. ALWAYS ask me to check logs and things like that.
- Once done with changes, run linting, formatting, and build
- Start by the domain modelling, then move on to infrastructure topics.
- If at any point you need more information, please ask your questions before moving forward.
- Limit comments to the bear minimum. Like in Go, around data structures and the main functions.
