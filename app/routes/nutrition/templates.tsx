import { Box, Button, Text, TextField } from "@radix-ui/themes";
import { useId, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { EmptyState } from "~/components/EmptyState";
import { FilterBar } from "~/components/FilterBar/FilterBar";
import { PageHeader } from "~/components/PageHeader";
import { SectionHeader } from "~/components/SectionHeader";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import {
  type MealCategory,
  mealAssignmentsSchema,
  mealCategories,
} from "~/modules/nutrition/domain/meal-template";
import { createNutritionService } from "~/modules/nutrition/infra/service.server";
import {
  MealAssignments,
  mealLabels,
} from "~/modules/nutrition/presentation/components/MealAssignments/MealAssignments";
import { NutritionNavigation } from "~/modules/nutrition/presentation/components/NutritionNavigation/NutritionNavigation";
import type { Route } from "./+types/templates";
import "./templates.css";

const querySchema = z.object({
  meal: z.enum(["all", ...mealCategories]).default("all"),
  edit: z.uuid().optional(),
});
const filters = ["all", ...mealCategories] as const;
const filterHref = (meal: string) =>
  `/nutrition/templates?${new URLSearchParams({ meal })}`;

export async function loader({ request, context }: Route.LoaderArgs) {
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    throw new Response("Invalid template filter", { status: 400 });
  const filter = query.data.meal;
  const result = await createNutritionService(
    context.get(authenticatedUserContext).id,
  ).getAllMealTemplates();
  if (result.isErr())
    throw new Response("Could not load templates", { status: 500 });
  let editing = null;
  if (query.data.edit) {
    const result = await createNutritionService(
      context.get(authenticatedUserContext).id,
    ).getMealTemplateWithIngredients(query.data.edit);
    if (result.isErr())
      throw new Response("Template not found", { status: 404 });
    const t = result.value;
    editing = {
      id: t.id,
      name: t.name,
      categories: t.categories,
      notes: t.notes,
      ingredients: t.ingredients.map(
        ({ ingredient, quantityGrams }) =>
          `${ingredient.name} · ${quantityGrams} g`,
      ),
    };
  }
  return {
    filter: query.data.meal,
    editing,
    templates: result.value
      .filter((t) => filter === "all" || t.categories.includes(filter))
      .map((t) => ({
        id: t.id,
        name: t.name,
        categories: t.categories,
        calories: Math.round(t.totalCalories),
      })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(1),
      categories: mealAssignmentsSchema,
      notes: z.string(),
      meal: z.enum(["all", ...mealCategories]),
    })
    .safeParse({
      id: form.get("id"),
      name: form.get("name"),
      categories: form.getAll("mealTimes"),
      notes: form.get("notes"),
      meal: form.get("meal"),
    });
  if (!parsed.success)
    return data(
      { error: "Enter a name and choose at least one meal time." },
      { status: 400 },
    );
  const result = await createNutritionService(
    context.get(authenticatedUserContext).id,
  ).updateMealTemplate(parsed.data.id, {
    name: parsed.data.name,
    categories: parsed.data.categories,
    notes: parsed.data.notes,
  });
  if (result.isErr())
    return data(
      { error: "Could not save this template. Try again." },
      { status: result.error === "not_found" ? 404 : 500 },
    );
  return redirect(filterHref(parsed.data.meal));
}

export default function MealTemplates({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { filter, editing, templates } = loaderData;
  const returnTo = filterHref(filter);
  return (
    <Box className="nutrition-templates">
      <PageHeader title="Nutrition" />
      <NutritionNavigation current="templates" />
      {editing ? (
        <TemplateEditor
          key={editing.id}
          template={editing}
          filter={filter}
          error={actionData?.error}
        />
      ) : (
        <>
          <SectionHeader
            title="Meal templates"
            right={
              <Button asChild variant="soft" className="meal-template-create">
                <Link
                  to={`/nutrition/meal-builder?${new URLSearchParams({ returnTo })}`}
                >
                  Create template
                </Link>
              </Button>
            }
          />
          <p className="meal-template-intro">
            Saved meals, ready where you need them.
          </p>
          <Form method="get">
            <FilterBar
              label="Filter templates by meal time"
              name="meal"
              value={filter}
              choices={filters.map((meal) => ({
                value: meal,
                label: meal === "all" ? "All" : mealLabels[meal],
              }))}
            />
          </Form>
          <p className="meal-template-help">
            {filter === "all"
              ? "All saved templates, shown once."
              : `Templates assigned to ${mealLabels[filter].toLowerCase()}.`}
          </p>
          <div className="meal-template-list">
            {templates.length === 0 ? (
              <EmptyState
                icon="🍽️"
                title="No templates yet"
                headingLevel="h3"
                description={`No templates assigned to ${filter === "all" ? "any meal time" : mealLabels[filter].toLowerCase()} yet.`}
              />
            ) : (
              templates.map((t) => (
                <article key={t.id} className="meal-template-row">
                  <div>
                    <h3>{t.name}</h3>
                    <Text as="p" color="gray">
                      {t.categories.map((c) => mealLabels[c]).join(" · ")} ·{" "}
                      {t.calories} kcal
                    </Text>
                  </div>
                  <Button variant="ghost" asChild>
                    <Link
                      to={`${returnTo}&edit=${t.id}`}
                      aria-label={`Edit ${t.name}`}
                    >
                      Edit
                    </Link>
                  </Button>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </Box>
  );
}

function TemplateEditor({
  template,
  filter,
  error,
}: {
  readonly template: NonNullable<Route.ComponentProps["loaderData"]["editing"]>;
  readonly filter: string;
  readonly error?: string;
}) {
  const nameId = useId();
  const notesId = useId();
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const [categories, setCategories] = useState<readonly MealCategory[]>(
    template.categories,
  );
  return (
    <>
      <h2>Edit template</h2>
      <Form method="post" className="meal-template-editor">
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="meal" value={filter} />
        <label htmlFor={nameId}>
          Name
          <TextField.Root
            id={nameId}
            name="name"
            defaultValue={template.name}
            required
          />
        </label>
        <MealAssignments selected={categories} onChange={setCategories} />
        <div>
          <h3>Ingredients</h3>
          {template.ingredients.map((ingredient) => (
            <Text as="p" key={ingredient}>
              {ingredient}
            </Text>
          ))}
        </div>
        <label htmlFor={notesId}>
          Notes
          <TextField.Root
            id={notesId}
            name="notes"
            defaultValue={template.notes ?? ""}
          />
        </label>
        {error && (
          <Text as="p" role="alert" color="red">
            {error}
          </Text>
        )}
        <div className="meal-template-editor-actions">
          <Button
            type="submit"
            loading={pending}
            disabled={pending || categories.length === 0}
          >
            Save
          </Button>
          <Button variant="soft" asChild>
            <Link to={filterHref(filter)}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </>
  );
}
