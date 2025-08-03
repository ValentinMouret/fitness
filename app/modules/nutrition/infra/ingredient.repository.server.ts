import { eq, and, isNull, type InferSelectModel } from "drizzle-orm";
import { Result, ResultAsync, ok } from "neverthrow";
import { db } from "~/db/index";
import { ingredients } from "~/db/schema";
import type { ErrRepository, ErrValidation } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import type {
  Ingredient,
  CreateIngredientInput,
  UpdateIngredientInput,
} from "../domain/ingredient";

let ingredientsCache: Ingredient[] | null = null;

export const IngredientRepository = {
  listAll(): ResultAsync<readonly Ingredient[], ErrRepository> {
    if (ingredientsCache) {
      return ResultAsync.fromSafePromise(Promise.resolve(ingredientsCache));
    }

    const query = db
      .select()
      .from(ingredients)
      .where(isNull(ingredients.deleted_at));

    return executeQuery(query, "listAll")
      .andThen((records) => {
        const results = records.map(recordToIngredient);
        return Result.combine(results);
      })
      .map((allIngredients) => {
        ingredientsCache = allIngredients;
        return allIngredients;
      });
  },

  searchByName(
    searchTerm: string,
  ): ResultAsync<readonly Ingredient[], ErrRepository> {
    return this.listAll().map((ingredients) =>
      ingredients.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  },

  filterByCategory(
    category: string,
  ): ResultAsync<readonly Ingredient[], ErrRepository> {
    return this.listAll().map((ingredients) =>
      ingredients.filter((ingredient) => ingredient.category === category),
    );
  },

  searchAndFilter(
    searchTerm?: string,
    category?: string,
  ): ResultAsync<readonly Ingredient[], ErrRepository> {
    return this.listAll().map((ingredients) => {
      let filtered = ingredients;

      if (searchTerm) {
        filtered = filtered.filter((ingredient) =>
          ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      }

      if (category && category !== "all") {
        filtered = filtered.filter(
          (ingredient) => ingredient.category === category,
        );
      }

      return filtered;
    });
  },

  fetchById(id: string): ResultAsync<Ingredient, ErrRepository> {
    const query = db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, id), isNull(ingredients.deleted_at)))
      .limit(1);

    return executeQuery(query, "fetchById")
      .andThen(fetchSingleRecord)
      .andThen((record) => recordToIngredient(record));
  },

  save(
    ingredient: CreateIngredientInput,
    tx?: Transaction,
  ): ResultAsync<Ingredient, ErrRepository> {
    const values = {
      name: ingredient.name,
      category: ingredient.category,
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
      fiber: ingredient.fiber,
      water_percentage: ingredient.waterPercentage,
      energy_density: ingredient.energyDensity,
      texture: ingredient.texture,
      is_vegetarian: ingredient.isVegetarian,
      is_vegan: ingredient.isVegan,
      slider_min: ingredient.sliderMin,
      slider_max: ingredient.sliderMax,
    };

    return ResultAsync.fromPromise(
      (tx ?? db).insert(ingredients).values(values).returning(),
      (err) => {
        console.error(err);
        return "database_error" as const;
      },
    )
      .andThen((records) => recordToIngredient(records[0]))
      .map((newIngredient) => {
        // Invalidate cache when new ingredient is added
        ingredientsCache = null;
        return newIngredient;
      });
  },

  update(
    id: string,
    updates: UpdateIngredientInput,
    tx?: Transaction,
  ): ResultAsync<Ingredient, ErrRepository> {
    const updateValues: Record<string, unknown> = {};

    if (updates.name !== undefined) updateValues.name = updates.name;
    if (updates.category !== undefined)
      updateValues.category = updates.category;
    if (updates.calories !== undefined)
      updateValues.calories = updates.calories;
    if (updates.protein !== undefined) updateValues.protein = updates.protein;
    if (updates.carbs !== undefined) updateValues.carbs = updates.carbs;
    if (updates.fat !== undefined) updateValues.fat = updates.fat;
    if (updates.fiber !== undefined) updateValues.fiber = updates.fiber;
    if (updates.waterPercentage !== undefined)
      updateValues.water_percentage = updates.waterPercentage;
    if (updates.energyDensity !== undefined)
      updateValues.energy_density = updates.energyDensity;
    if (updates.texture !== undefined) updateValues.texture = updates.texture;
    if (updates.isVegetarian !== undefined)
      updateValues.is_vegetarian = updates.isVegetarian;
    if (updates.isVegan !== undefined) updateValues.is_vegan = updates.isVegan;
    if (updates.sliderMin !== undefined)
      updateValues.slider_min = updates.sliderMin;
    if (updates.sliderMax !== undefined)
      updateValues.slider_max = updates.sliderMax;

    updateValues.updated_at = new Date();

    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(ingredients)
        .set(updateValues)
        .where(and(eq(ingredients.id, id), isNull(ingredients.deleted_at)))
        .returning(),
      (err) => {
        console.error(err);
        return "database_error" as const;
      },
    )
      .andThen((records) => {
        if (records.length === 0) {
          return ResultAsync.fromSafePromise(
            Promise.reject("not_found" as const),
          );
        }
        return recordToIngredient(records[0]);
      })
      .map((updatedIngredient) => {
        // Invalidate cache when ingredient is updated
        ingredientsCache = null;
        return updatedIngredient;
      });
  },

  delete(id: string, tx?: Transaction): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(ingredients)
        .set({ deleted_at: new Date() })
        .where(and(eq(ingredients.id, id), isNull(ingredients.deleted_at))),
      (err) => {
        console.error(err);
        return "database_error" as const;
      },
    ).map(() => {
      // Invalidate cache when ingredient is deleted
      ingredientsCache = null;
    });
  },

  clearCache(): void {
    ingredientsCache = null;
  },
};

function recordToIngredient(
  record: InferSelectModel<typeof ingredients>,
): Result<Ingredient, ErrValidation> {
  return ok({
    id: record.id,
    name: record.name,
    category: record.category,
    calories: record.calories,
    protein: record.protein,
    carbs: record.carbs,
    fat: record.fat,
    fiber: record.fiber,
    waterPercentage: record.water_percentage,
    energyDensity: record.energy_density,
    texture: record.texture,
    isVegetarian: record.is_vegetarian,
    isVegan: record.is_vegan,
    sliderMin: record.slider_min,
    sliderMax: record.slider_max,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  });
}
