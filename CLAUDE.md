# Fitness
Fitness is an app that centralises nutrition, fitness, and habits.
This is *solo-ware*: I am the sole user of this app.

## Stack
- React Router v7 (framework mode, _à la_ Remix)
- TypeScript
- Drizzle
- PostgreSQL
- Biome (linter, formater)
- bun
- zod
- Radix UI (components & icons)
- Lucide React (additional icons)
- Tailwind CSS (styling utility)
- Recharts (data visualization)
- neverthrow (error handling)

## Useful commands
```shell
bun i # install dependencies
bun build # build the project
bun dev # run the project in watch/dev mode. Don’t run this as the server is already running.
bun fmt # format
bun lint # lint
bun tc # typecheck + generate react-router types
bun tc:watch # typecheck in watch mode (watches app/ directory)
bun test # run tests

bun db:dev # updates the database with schema changes (command to run in dev only)
bun db:generate # once done developing DB changes, creates a migration
bun db:migrate # run migrations
bun db:seed
```

## React-router v7
The framework we use here is react-router v7.
Once a route is defined in `app/routes.ts` and this generates types .
If you do work related to React-Router, please read: .claude/react-router.md.

## Code style
- Follow react-router v7 patterns (`loader`, `clientLoader`, `action`)
  - ALWAYS use `useFetcher` if interactivity is needed WITHOUT navigation.
- Adopt a functional approach.
  - Unless it would have a significant impact on performance or readability.
- Use `readonly` types

## Style
- Use Radix components as primary UI library
- Tailwind CSS available for utility styling when needed
- Keep styling minimal and centralised in the Radix theme

## Patterns
Use `neverthrow` to have errors as value.
Always bubble up domain and application layer errors to the infrastructure layer.
The infrastructure layer then decides how to handle the errors, potentially by returning an HTTP error.
Chain with `.map` or `.andThen`.

## Design
Design system available in docs/design-system.md.

## Routes
The routes are managed by the file `app/routes.ts`. The content follows React-Router v7 patterns.

The convention we adopt in the repo is to have the folder structure follow the routes structures.
Examples:
- `/workouts` -> `routes/workouts/index.tsx`
- `/workouts/create` -> `routes/workouts/create.tsx`
- `/workouts/exercises/create` -> `routes/workouts/exercises/create.tsx`
- `/habits/new` -> `routes/habits/new.tsx`
## Other resources
- database instructions: `docs/database.md` (read this before working on the database or modelisation)
- frontend instructions: `docs/frontend.md` (read this before working on the frontend)
- ddd instructions: `docs/domain-driven-development.md` (read this before working on the features)
- product specifications: `docs/features/README.md` (comprehensive product documentation with feature specs)

## Architecture
The codebase follows a modular architecture with Domain-Driven Design principles:
- `modules/` contains feature modules (core, fitness, habits, nutrition)
- Each module follows DDD layers: `domain/`, `application/`, `infra/`, `presentation/`
- Domain layer contains entities and business logic
- Application layer contains services and use cases
- Infrastructure layer handles data persistence and external integrations
- Presentation layer contains UI components, view models, and hooks

### Frontend Component Architecture
Follow the modular frontend architecture defined in `docs/frontend-architecture-migration.md`:

#### Component Categories
1. **Shared Components** (`app/components/`): Generic, reusable UI with zero domain knowledge
2. **Feature Components** (`modules/{feature}/presentation/components/`): Domain-specific UI components
3. **Route Components** (`app/routes/`): Orchestration and navigation logic only

#### Dependencies & Data Flow
```
Routes → Module Presentation → Application → Domain
     ↓
Shared Components ← Feature Components (composition)
```

#### View Model Pattern
- Transform domain data into UI-friendly structures
- Use view models in feature components instead of direct domain entities
- File naming: `{feature-name}-{component}.view-model.ts`

#### Module Structure
```
modules/{feature}/
├── domain/           # Business entities & logic
├── application/      # Use cases & services
├── infra/           # Data persistence
└── presentation/    # UI layer
    ├── components/  # Feature-specific UI components
    ├── hooks/       # Custom React hooks for this feature
    ├── view-models/ # Data transformation layer
    └── types/       # UI-specific TypeScript types
```

## Utility Files
The codebase includes several utility modules for common operations:

### `app/time.ts`
Date and time utilities including:
- `Day` - Day of week utilities (sorting, converting from numbers, short format)
- `isSameDay()` - Check if two dates are on the same day
- `toDate()` - Reset time to midnight UTC
- `today()` - Get today's date with time reset
- `addOneDay()` / `removeOneDay()` - Date arithmetic
- `getOrdinalSuffix()` - Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
- `formatStartedAgo()` - Format duration as "Started X min/hours ago"

### `app/strings.ts`
String manipulation utilities:
- `capitalize()` - Capitalize first letter
- `snakeCaseToHuman()` - Convert snake_case to human readable
- `humanFormatting()` - Combined snake_case to human readable with capitalization
- `coerceEmpty()` - Convert empty strings to undefined

### When to Use/Update Utilities
- Extract common functionality when used in 2+ places
- Keep utilities pure and focused on single responsibility
- Add comprehensive tests for all utility functions
- Document complex utilities with examples
- Consider performance implications for frequently used utilities

## Agent
- An instance of the server is already running in dev mode. NEVER try to boot another instance. ALWAYS ask me to check logs and things like that.
- Once done with changes, run linting, formatting, and build
- Start by the domain modelling, then move on to infrastructure topics.
- If at any point you need more information, please ask your questions before moving forward.
- Limit comments to the bear minimum. Like in Go, around data structures and the main functions.
- After making changes to frontend code, run the frontend engineer to see if changes are simple enough, fit the guidelines, or could be improve
- Use Playwright MCP to test your UI changes
