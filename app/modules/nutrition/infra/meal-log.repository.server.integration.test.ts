import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeConnections, db } from "~/db";
import {
  ingredients,
  mealLogIngredients,
  mealLogs,
  mealTemplateIngredients,
  mealTemplates,
} from "~/db/schema";
import type { Ingredient } from "../domain/ingredient";
import { getMealBuilderData, saveMealLog } from "./meal-builder.service.server";
import { MealLogRepository } from "./meal-log.repository.server";
import { recordToIngredient } from "./record-mappers";

let mealId: string;
let foods: readonly Ingredient[];
let templateId: string | undefined;

beforeEach(async () => {
  templateId = undefined;
  const records = await db
    .insert(ingredients)
    .values(
      ["A", "B", "C"].map((name) => ({
        name: `meal-update-${randomUUID()}-${name}`,
        category: "proteins" as const,
        texture: "firm_solid" as const,
        calories: 100,
        protein: 20,
        carbs: 5,
        fat: 2,
        fiber: 1,
        water_percentage: 70,
        energy_density: 1,
        slider_min: 5,
        slider_max: 500,
      })),
    )
    .returning();
  foods = records.map((record) => recordToIngredient(record)._unsafeUnwrap());
  const [meal] = await db
    .insert(mealLogs)
    .values({
      meal_category: "lunch",
      logged_date: "1901-01-01",
      notes: "Keep my notes",
      is_completed: true,
    })
    .returning();
  mealId = meal.id;
  await db.insert(mealLogIngredients).values({
    meal_log_id: mealId,
    ingredient_id: foods[0].id,
    quantity_grams: 100,
  });
});

afterEach(async () => {
  await db
    .delete(mealLogIngredients)
    .where(eq(mealLogIngredients.meal_log_id, mealId));
  await db.delete(mealLogs).where(eq(mealLogs.id, mealId));
  if (templateId) {
    await db
      .delete(mealTemplateIngredients)
      .where(eq(mealTemplateIngredients.meal_template_id, templateId));
    await db.delete(mealTemplates).where(eq(mealTemplates.id, templateId));
  }
  await db.delete(ingredients).where(
    inArray(
      ingredients.id,
      foods.map((food) => food.id),
    ),
  );
});
afterAll(closeConnections);

const selection = (index: number, quantityGrams = 100) => ({
  ingredient: foods[index],
  quantityGrams,
});
const read = async () =>
  (await MealLogRepository.fetchWithIngredients(mealId))._unsafeUnwrap();

describe("updating meal ingredients", () => {
  it("preserves the source template and its usage count", async () => {
    const [template] = await db
      .insert(mealTemplates)
      .values({
        name: "Meal update source",
        category: "lunch",
        total_calories: 100,
        total_protein: 20,
        total_carbs: 5,
        total_fat: 2,
        total_fiber: 1,
        satiety_score: 1,
        usage_count: 1,
      })
      .returning();
    templateId = template.id;
    await db.insert(mealTemplateIngredients).values({
      meal_template_id: template.id,
      ingredient_id: foods[0].id,
      quantity_grams: 100,
    });
    await db
      .update(mealLogs)
      .set({ meal_template_id: template.id })
      .where(eq(mealLogs.id, mealId));
    expect(
      (
        await MealLogRepository.update(mealId, {
          ingredients: [selection(0, 200)],
        })
      ).isOk(),
    ).toBe(true);
    expect((await read()).mealTemplateId).toBe(template.id);
    expect(
      await db
        .select()
        .from(mealTemplates)
        .where(eq(mealTemplates.id, template.id)),
    ).toEqual([template]);
    const [source] = await db
      .select()
      .from(mealTemplateIngredients)
      .where(eq(mealTemplateIngredients.meal_template_id, template.id));
    expect(source.quantity_grams).toBe(100);
  });

  it("adding an active ingredient is idempotent and preserves its quantity", async () => {
    expect(
      (await MealLogRepository.addIngredient(mealId, selection(0, 200))).isOk(),
    ).toBe(true);
    expect((await read()).ingredients).toEqual([selection(0, 100)]);
  });
  it("saves an edit through the service and redirects without clearing metadata", async () => {
    const response = await saveMealLog({
      mode: "update",
      mealId,
      ingredients: [{ id: foods[0].id, quantity: 125 }],
      returnTo: "/nutrition?date=1901-01-01",
    });
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error("Expected redirect");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/nutrition?date=1901-01-01");
    expect((await read()).notes).toBe("Keep my notes");
    expect((await read()).ingredients).toEqual([selection(0, 125)]);
  });

  it("returns recoverable save errors without altering the meal", async () => {
    const before = await read();
    for (const items of [
      [{ id: randomUUID(), quantity: 100 }],
      [
        { id: foods[0].id, quantity: 100 },
        { id: foods[0].id, quantity: 150 },
      ],
    ]) {
      const result = await saveMealLog({
        mode: "update",
        mealId,
        ingredients: items,
      });
      expect(result).toMatchObject({
        init: { status: 400 },
        data: { saveError: expect.any(String) },
      });
      expect(await read()).toEqual(before);
    }
  });
  it("reports not_found for a meal deleted before saving", async () => {
    await db
      .update(mealLogs)
      .set({ deleted_at: new Date() })
      .where(eq(mealLogs.id, mealId));
    expect(
      (
        await MealLogRepository.update(mealId, { ingredients: [selection(0)] })
      )._unsafeUnwrapErr(),
    ).toBe("not_found");
  });

  it("does not turn a missing edit target into create mode", async () => {
    await expect(
      getMealBuilderData({
        mealId: randomUUID(),
        mealCategory: "lunch",
        date: "1901-01-01",
        returnTo: "/nutrition",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("derives edit context from the saved meal even without create parameters", async () => {
    const loaded = await getMealBuilderData({
      mealId,
      mealCategory: "breakfast",
      date: "1902-01-01",
      returnTo: null,
    });
    expect(loaded.mealLoggingMode).toMatchObject({
      isEnabled: true,
      mealCategory: "lunch",
      date: "1901-01-01",
    });
  });
  it("saves unchanged ingredients and repeated quantity updates without losing metadata", async () => {
    for (const quantity of [100, 150, 175]) {
      const result = await MealLogRepository.update(mealId, {
        ingredients: [selection(0, quantity)],
      });
      expect(result.isOk()).toBe(true);
      const saved = await read();
      expect(saved.ingredients.map((item) => item.quantityGrams)).toEqual([
        quantity,
      ]);
      expect(saved.notes).toBe("Keep my notes");
      expect(saved.isCompleted).toBe(true);
    }
  });

  it("keeps, adds, removes and restores ingredients without duplicate rows", async () => {
    for (const selected of [
      [selection(0), selection(1)],
      [selection(1, 200)],
      [selection(0, 250), selection(1, 200)],
    ]) {
      expect(
        (
          await MealLogRepository.update(mealId, { ingredients: selected })
        ).isOk(),
      ).toBe(true);
      expect((await read()).ingredients).toEqual(
        expect.arrayContaining(selected),
      );
      expect((await read()).ingredients).toHaveLength(selected.length);
    }
    const rows = await db
      .select()
      .from(mealLogIngredients)
      .where(eq(mealLogIngredients.meal_log_id, mealId));
    expect(rows).toHaveLength(2);
  });

  it("can add an ingredient again after removing it", async () => {
    expect(
      (await MealLogRepository.removeIngredient(mealId, foods[0].id)).isOk(),
    ).toBe(true);
    expect(
      (await MealLogRepository.addIngredient(mealId, selection(0, 200))).isOk(),
    ).toBe(true);
    expect((await read()).ingredients).toEqual([selection(0, 200)]);
  });

  it("preserves ingredients when omitted and removes all only for an explicit empty list", async () => {
    expect(
      (await MealLogRepository.update(mealId, { notes: "Changed" })).isOk(),
    ).toBe(true);
    expect((await read()).ingredients).toHaveLength(1);
    expect(
      (await MealLogRepository.update(mealId, { ingredients: [] })).isOk(),
    ).toBe(true);
    expect((await read()).ingredients).toEqual([]);
  });

  it("rolls back metadata and ingredient changes when an ingredient insert fails", async () => {
    const before = await read();
    const missing = { ...foods[2], id: randomUUID() };
    const result = await MealLogRepository.update(mealId, {
      notes: "Must roll back",
      isCompleted: false,
      ingredients: [selection(1), { ingredient: missing, quantityGrams: 100 }],
    });
    expect(result.isErr()).toBe(true);
    expect(await read()).toEqual(before);
  });
});
