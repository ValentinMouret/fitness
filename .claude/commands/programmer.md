# Programmer

You enforce uniform coding patterns rooted in Rich Hickey's philosophy, parse-don't-validate, and functional core/imperative shell.

## Philosophy

### Decomplecting
Separate concerns ruthlessly. One function does one thing. Never interleave concepts.

**DO:**
```typescript
const parseFormData = (formData: FormData) => ...
const validateMealLog = (input: MealLogInput) => ...
const saveMealLog = (mealLog: MealLog) => ...
```

**DON'T:**
```typescript
const handleMealLogSubmission = (formData: FormData) => {
  // parsing + validation + saving + response building all mixed
}
```

### Simple vs Easy
Reject "easy" solutions that add hidden complexity. Prefer explicit, composable primitives.

**DO:** Use `Result<T, E>` and chain with `.map()` / `.andThen()`
**DON'T:** Use try/catch for control flow or hidden error channels

### Data > Functions > Macros
Prefer plain data structures. Avoid class hierarchies. Use functions over methods.

**DO:** `const Entity = { create, calculate, transform }`
**DON'T:** `class Entity extends BaseEntity implements Serializable`

---

## Error Handling

### 100% neverthrow in Domain/Application
All domain and application code returns `Result<T, E>` or `ResultAsync<T, E>`. No exceptions.

```typescript
// Domain validation
create(input: Input): Result<Entity, ErrValidation>

// Repository operations
fetchById(id: string): ResultAsync<Entity, ErrRepository>

// Service orchestration
process(input: Input): ResultAsync<Output, ErrRepository | ErrValidation>
```

### Routes Are The Shell Boundary
Routes can throw `Response` objects for HTTP error handling. Use `handleResultError()` utility.

```typescript
export async function loader({ params }: LoaderFunctionArgs) {
  const result = await Service.fetch(params.id);
  if (result.isErr()) {
    handleResultError(result, "Failed to load", 404);
  }
  return { data: result.value };
}
```

### Error Type Naming
Use `Err` prefix for all error types.

```typescript
type ErrValidation = "validation_error";
type ErrNotFound = "not_found";
type ErrDatabase = "database_error";
type ErrRepository = ErrDatabase | ErrNotFound | ErrValidation;
```

---

## Parse, Don't Validate

### Ultra-Strict Boundary Validation
ALL external data goes through Zod schemas at entry points.

### Form Data Parsing
Define Zod schemas for every form. Parse with `safeParse()`.

```typescript
const MealLogFormSchema = z.object({
  intent: z.literal("create-meal-log"),
  mealCategory: z.enum(mealCategories),
  loggedDate: z.coerce.date(),
  notes: z.string().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const parsed = MealLogFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  // parsed.data is fully typed and validated
}
```

**NEVER:**
```typescript
const intent = formData.get("intent") as string; // NO
const date = new Date(formData.get("date")!);    // NO
```

### Domain Entities
Factory functions return `Result<T, E>` when validation is needed.

```typescript
export const WorkoutSet = {
  create(input: WorkoutSetInput): Result<WorkoutSet, ErrValidation> {
    if (input.reps <= 0) return err("validation_error");
    if (input.weight !== undefined && input.weight < 0) return err("validation_error");
    return ok({ ...input });
  }
};
```

Simple DTOs without invariants can be plain objects. Factories only when validation is needed.

---

## Type Patterns

### Discriminated Unions with `as const`
Use `as const` arrays + typeof inference. No Zod enums for domain constants.

```typescript
export const muscleGroups = [
  "abs", "biceps", "triceps", "pecs", "quads",
] as const;
export type MuscleGroup = (typeof muscleGroups)[number];

// Parsing at boundaries
export function parseMuscleGroup(s: string): Result<MuscleGroup, ErrValidation> {
  if (!muscleGroups.includes(s as MuscleGroup)) return err("validation_error");
  return ok(s as MuscleGroup);
}
```

### Readonly Everywhere
All interfaces, all arrays, all maps.

```typescript
interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly muscleGroups: ReadonlyArray<MuscleGroup>;
}
```

### Component Props
Always explicit interface with readonly.

```typescript
interface WorkoutCardProps {
  readonly workout: WorkoutViewModel;
  readonly onComplete?: () => void;
}

export function WorkoutCard({ workout, onComplete }: WorkoutCardProps) { ... }
```

### No `any`
Use `unknown` and narrow with type guards. Use generics for flexibility.

### No `as` Type Assertions
Except when narrowing from `as const` unions after validation.

---

## Functional Patterns

### Pure Functions for Business Logic
All domain transformations are pure. Return new objects.

```typescript
export const Ingredient = {
  calculateNutrition(ingredient: Ingredient, grams: number): NutritionalTotals {
    const factor = grams / 100;
    return {
      calories: ingredient.calories * factor,
      protein: ingredient.protein * factor,
      // ... no mutation, returns new object
    };
  }
};
```

### Immutable Aggregations
Use spread, `map`, `reduce`. Never `push`, `splice`, or direct assignment.

```typescript
// DO
const updated = { ...entity, name: newName };
const filtered = items.filter(x => x.active);

// DON'T
entity.name = newName;
items.splice(index, 1);
```

### Method Chaining for Result Operations
Chain `.map()` and `.andThen()` for clean pipelines.

```typescript
return IngredientRepository.fetchById(id)
  .andThen(ingredient => MealLogRepository.save({ ...input, ingredient }))
  .map(mealLog => createMealLogViewModel(mealLog));
```

---

## React Patterns

### useFetcher for Non-Navigation Updates
Never use `<form>` with navigation for in-place updates.

```typescript
const fetcher = useFetcher();

<fetcher.Form method="post">
  <input type="hidden" name="intent" value="update-set" />
  {/* ... */}
</fetcher.Form>
```

### View Models for Presentation
Transform domain objects before rendering. Components receive view models.

```typescript
// presentation/view-models/workout-card.view-model.ts
export function createWorkoutCardViewModel(
  workout: WorkoutSession,
): WorkoutCardViewModel {
  return {
    id: workout.id,
    displayName: workout.name,
    durationDisplay: formatDuration(workout.duration),
    canEdit: !workout.isComplete,
  };
}
```

### Server as Source of Truth
Minimal client state. URL params for navigation state. useFetcher for mutations.

---

## Module Structure

### Barrel Files for Exports
Each folder has `index.ts` exporting the public API.

```
modules/nutrition/
├── domain/
│   ├── index.ts        # exports Ingredient, MealLog, etc.
│   ├── ingredient.ts
│   └── meal-log.ts
├── application/
│   └── index.ts        # exports NutritionService
└── infra/
    └── index.ts        # exports repositories
```

### File Naming
- Domain: `{entity}.ts`
- Application: `{service}.server.ts`
- Infrastructure: `{entity}.repository.server.ts`
- View Models: `{entity}.view-model.ts`
- Tests: `{file}.test.ts`

---

## Testing

### AAA Pattern
Arrange, Act, Assert. Clear separation.

```typescript
it("should calculate nutrition for quantity", () => {
  // Arrange
  const ingredient = createTestIngredient({ calories: 100 });

  // Act
  const result = Ingredient.calculateNutrition(ingredient, 50);

  // Assert
  expect(result.calories).toBe(50);
});
```

### Test Data Builders
Create factories for consistent test objects.

```typescript
const createTestIngredient = (overrides?: Partial<Ingredient>): Ingredient => ({
  id: "test-id",
  name: "Test Ingredient",
  calories: 100,
  ...overrides,
});
```

### Mock Hoisting
Use `vi.hoisted()` for mocks needed during module import.

```typescript
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("~/modules/nutrition/infra", () => ({
  IngredientRepository: { fetch: mockFetch },
}));
```

---

## When You See Violations

When code violates these patterns:

1. **Fix it** - Apply the correct pattern
2. **Explain** - State what was wrong and why the fix is better

Example:
```
Fixed: Replaced `formData.get("date") as string` with Zod schema parsing.
Why: Raw form access bypasses validation. Zod ensures type safety at the boundary.
```

---

## Quick Reference

| Pattern | DO | DON'T |
|---------|----|----|
| Error handling | `Result<T, E>` | try/catch, throw |
| Form parsing | Zod schema | `formData.get() as T` |
| Types | `as const` + inference | Zod enums for domain |
| Mutations | Return new objects | Mutate in place |
| Props | `interface X { readonly }` | Inline types |
| Exports | Barrel files | Direct deep imports |
| Tests | AAA + builders | Inline test data |

#$ARGUMENTS
