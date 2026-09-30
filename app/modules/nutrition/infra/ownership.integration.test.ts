import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { userIdSchema } from "~/modules/auth/domain/user";
import { bootstrapAuthOwner } from "~/modules/auth/infra/owner-bootstrap.server";
import { createDisposablePostgres } from "../../../../tests/integration/support/disposable-postgres";
import { createIngredientRepository } from "./ingredient.repository.server";
import { createMealLogRepository } from "./meal-log.repository.server";
import {
  createMealTemplateRepository,
  fetchPublicMealTemplateWithIngredients,
} from "./meal-template.repository.server";

const fixture = createDisposablePostgres(
  new URL(z.url().parse(process.env.TENANT_TEST_ADMIN_URL)),
);
const { database, pool } = fixture;
const owner = userIdSchema.parse(randomUUID());
const other = userIdSchema.parse(randomUUID());
const foodIds = [randomUUID(), randomUUID()];
const templateIds = [randomUUID(), randomUUID()];
const mealIds = [randomUUID(), randomUUID()];
const tables = [
  "ingredients",
  "meal_templates",
  "meal_logs",
  "meal_template_ingredients",
  "meal_log_ingredients",
];
const records = () =>
  Promise.all(
    tables.map(
      async (table) =>
        (await pool.query(`select * from ${table} order by 1,2`)).rows,
    ),
  );
let original: readonly (readonly Record<string, unknown>[])[] = [];
beforeAll(async () => {
  await fixture.create();
  await fixture.migrateBefore(17);
  for (const [index, id] of foodIds.entries()) {
    const archived = index === 1 ? new Date("1900-01-02") : null;
    await pool.query(
      "insert into ingredients (id,name,category,calories,protein,carbs,fat,fiber,water_percentage,energy_density,texture,slider_min,slider_max,ai_generated,ai_generated_at,deleted_at) values ($1,$2,'proteins',100,20,5,2,1,70,1,'firm_solid',5,500,true,'1900-01-01',$3)",
      [id, `Historical ${id}`, archived],
    );
    await pool.query(
      "insert into meal_templates (id,name,categories,notes,total_calories,total_protein,total_carbs,total_fat,total_fiber,satiety_score,usage_count,is_public,deleted_at) values ($1,$2,array['lunch','dinner']::meal_category[],'Historical recipe note',100,20,5,2,1,3,7,true,$3)",
      [templateIds[index], `Historical ${id}`, archived],
    );
    await pool.query(
      "insert into meal_logs (id,meal_category,logged_date,is_completed,notes,meal_template_id,deleted_at) values ($1,'lunch',$2,true,'Historical meal note',$3,$4)",
      [mealIds[index], `1900-01-0${index + 1}`, templateIds[index], archived],
    );
    await pool.query(
      "insert into meal_template_ingredients (meal_template_id,ingredient_id,quantity_grams,deleted_at) values ($1,$2,123,$3)",
      [templateIds[index], id, archived],
    );
    await pool.query(
      "insert into meal_log_ingredients (meal_log_id,ingredient_id,quantity_grams,deleted_at) values ($1,$2,234,$3)",
      [mealIds[index], id, archived],
    );
  }
  original = await records();
});
afterAll(() => fixture.close());

describe.sequential(
  "personal nutrition ownership and public meal links",
  () => {
    it("rolls back DDL and all legacy data without an explicit owner", async () => {
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(await records()).toEqual(original);
    });
    it("rejects ambiguous owners then preserves every ID, composition and historical field", async () => {
      for (const id of [owner, other])
        expect(
          (
            await bootstrapAuthOwner({
              pool,
              id,
              email: `${id}@example.invalid`,
              now: new Date(),
            })
          ).isOk(),
        ).toBe(true);
      await expect(
        migrate(database, { migrationsFolder: "./drizzle" }),
      ).rejects.toThrow();
      expect(await records()).toEqual(original);
      await pool.query("delete from auth_users where id=$1", [other]);
      await migrate(database, { migrationsFolder: "./drizzle" });
      expect(await records()).toEqual(
        original.map((rows) => rows.map((row) => ({ ...row, user_id: owner }))),
      );
      await pool.query(
        "insert into auth_users (id,name,email) values ($1,'Other fixture',$2)",
        [other, `${other}@example.invalid`],
      );
    });
    it("isolates private reads, summaries and caches while preserving published share links", async () => {
      const a = createIngredientRepository(owner, database);
      const b = createIngredientRepository(other, database);
      expect(
        (await a.listAll())._unsafeUnwrap().map((food) => food.id),
      ).toEqual([foodIds[0]]);
      expect((await b.listAll())._unsafeUnwrap()).toEqual([]);
      expect((await b.fetchById(foodIds[0]))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(
        (
          await createMealTemplateRepository(other, database).fetchById(
            templateIds[0],
          )
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await createMealTemplateRepository(
            other,
            database,
          ).fetchTemplateIngredients(templateIds[0])
        )._unsafeUnwrap(),
      ).toEqual([]);
      expect(
        (
          await createMealLogRepository(other, database).fetchWithIngredients(
            mealIds[0],
          )
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await createMealLogRepository(other, database).fetchLogIngredients(
            mealIds[0],
          )
        )._unsafeUnwrap(),
      ).toEqual([]);
      const summary = (
        await createMealLogRepository(other, database).fetchDailySummary(
          new Date("1900-01-01"),
        )
      )._unsafeUnwrap();
      expect(summary.dailyTotals.calories).toBe(0);
      const shared = (
        await fetchPublicMealTemplateWithIngredients(templateIds[0], database)
      )._unsafeUnwrap();
      expect(shared.ingredients[0].quantityGrams).toBe(123);
      expect(shared).not.toHaveProperty("userId");
      expect(
        (
          await createMealTemplateRepository(owner, database).setPublic(
            templateIds[0],
            false,
          )
        ).isOk(),
      ).toBe(true);
      expect(
        (
          await fetchPublicMealTemplateWithIngredients(templateIds[0], database)
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await fetchPublicMealTemplateWithIngredients(templateIds[1], database)
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
    });
    it("rejects foreign root and child writes without changing the owned records", async () => {
      const before = await records();
      const ingredients = createIngredientRepository(other, database);
      const meals = createMealLogRepository(other, database);
      const templates = createMealTemplateRepository(other, database);
      const food = (
        await createIngredientRepository(owner, database).fetchById(foodIds[0])
      )._unsafeUnwrap();
      expect(
        (
          await ingredients.update(food.id, { name: "Foreign rename" })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await ingredients.delete(food.id))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(
        (
          await meals.update(mealIds[0], { notes: "Foreign note" })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await meals.delete(mealIds[0]))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(
        (
          await meals.addIngredient(mealIds[0], {
            ingredient: food,
            quantityGrams: 900,
          })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await meals.updateIngredientQuantity(mealIds[0], food.id, 900)
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (await meals.removeIngredient(mealIds[0], food.id))._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await templates.update(templateIds[0], { name: "Foreign recipe" })
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (await templates.setPublic(templateIds[0], true))._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect(
        (
          await templates.incrementUsageCount(templateIds[0])
        )._unsafeUnwrapErr(),
      ).toBe("not_found");
      expect((await templates.delete(templateIds[0]))._unsafeUnwrapErr()).toBe(
        "not_found",
      );
      expect(await records()).toEqual(before);
    });
    it("allows identical names and meal slots per account, rejects cross-account associations atomically", async () => {
      const food = (
        await createIngredientRepository(owner, database).fetchById(foodIds[0])
      )._unsafeUnwrap();
      const ingredients = createIngredientRepository(other, database);
      const otherFood = (await ingredients.save(food))._unsafeUnwrap();
      const meals = createMealLogRepository(other, database);
      const input = {
        mealCategory: "lunch" as const,
        loggedDate: new Date("1900-01-01"),
        ingredients: [{ ingredient: otherFood, quantityGrams: 100 }],
      };
      const meal = (await meals.save(input))._unsafeUnwrap();
      expect((await meals.save(input))._unsafeUnwrapErr()).toBe("conflict");
      const before = await records();
      expect(
        (
          await meals.update(meal.id, {
            notes: "Must roll back",
            ingredients: [{ ingredient: food, quantityGrams: 100 }],
          })
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await meals.save({
            ...input,
            loggedDate: new Date("1900-01-03"),
            mealTemplateId: templateIds[0],
          })
        ).isErr(),
      ).toBe(true);
      expect(
        (
          await createMealTemplateRepository(other, database).save({
            name: "Foreign ingredient",
            categories: ["lunch"],
            ingredients: [{ ingredient: food, quantityGrams: 100 }],
          })
        ).isErr(),
      ).toBe(true);
      await expect(
        pool.query(
          "insert into meal_log_ingredients (user_id,meal_log_id,ingredient_id,quantity_grams) values ($1,$2,$3,100)",
          [owner, meal.id, food.id],
        ),
      ).rejects.toThrow();
      expect(await records()).toEqual(before);
    });
  },
);
