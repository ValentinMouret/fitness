# Back-office
«Back-office for your life».

## Stack
- React Router v7 (framework mode)
- TypeScript
- Drizzle
- PostgreSQL
- Biome
- pnpm

## Useful commands
```shell
pnpm i # install dependencies
pnpm build # build the project
pnpm dev # run the project in watch/dev mode
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


## Style
- No Tailwind CSS
- Vanilla CSS

## Design
- Light, minimalist

## Other resources
- database instructions: `docs/database.md` (read this before working on the database or modelisation)
