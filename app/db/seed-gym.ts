import "dotenv/config";
import type { InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/env.server";
import { equipmentInstances, gymFloors } from "./schema";

export const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
  },
});

const gymFloorsData: Omit<InferInsertModel<typeof gymFloors>, "id">[] = [
  {
    name: "First Floor - Machines & Cables",
    floor_number: 1,
    description: "Single room with machine equipment and cable towers",
  },
  {
    name: "Second Floor - Free Weights",
    floor_number: 2,
    description:
      "Large room with dumbbells, smith machines, squat cages, benches, and Hammer Strength machines",
  },
];

async function main() {
  console.log("Starting gym layout seeding...");

  await db.transaction(async (tx) => {
    console.log("Seeding gym floors...");
    const insertedFloors = await tx
      .insert(gymFloors)
      .values(gymFloorsData)
      .returning();
    console.log(`Inserted ${insertedFloors.length} floors`);

    const floor1 = insertedFloors.find((f) => f.floor_number === 1);
    const floor2 = insertedFloors.find((f) => f.floor_number === 2);

    if (!floor1 || !floor2) {
      throw new Error("Required floors not found after insertion");
    }

    console.log("Seeding equipment instances...");

    // FIRST FLOOR EQUIPMENT
    const floor1Equipment: Omit<
      InferInsertModel<typeof equipmentInstances>,
      "id"
    >[] = [
      // Machine bench press
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Machine Bench Press",
        capacity: 1,
        is_available: true,
      },

      // Machine abs crunch
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Machine Abs Crunch",
        capacity: 1,
        is_available: true,
      },

      // Machine pec fly
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Machine Pec Fly",
        capacity: 1,
        is_available: true,
      },

      // Horizontal leg press
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Horizontal Leg Press",
        capacity: 1,
        is_available: true,
      },

      // Machine lying leg curl
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Machine Lying Leg Curl",
        capacity: 1,
        is_available: true,
      },

      // Machine leg extension
      {
        exercise_type: "machine",
        gym_floor_id: floor1.id,
        name: "Machine Leg Extension",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 1 - Row side
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 1 - Row Station",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 1 - Pull-down side
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 1 - Pulldown Station",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 1 - Adjustable cable 1
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 1 - Adjustable Cable A",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 1 - Adjustable cable 2
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 1 - Adjustable Cable B",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 2 - Row side
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 2 - Row Station",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 2 - Pull-down side
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 2 - Pulldown Station",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 2 - Adjustable cable 1
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 2 - Adjustable Cable A",
        capacity: 1,
        is_available: true,
      },

      // Cable Tower 2 - Adjustable cable 2
      {
        exercise_type: "cable",
        gym_floor_id: floor1.id,
        name: "Cable Tower 2 - Adjustable Cable B",
        capacity: 1,
        is_available: true,
      },
    ];

    // SECOND FLOOR EQUIPMENT
    const floor2Equipment: Omit<
      InferInsertModel<typeof equipmentInstances>,
      "id"
    >[] = [
      // Dumbbells (represented as a shared resource)
      {
        exercise_type: "dumbbells",
        gym_floor_id: floor2.id,
        name: "Dumbbell Rack Area",
        capacity: 8, // Multiple people can use dumbbells simultaneously
        is_available: true,
      },

      // Smith Machine 1
      {
        exercise_type: "barbell",
        gym_floor_id: floor2.id,
        name: "Smith Machine 1",
        capacity: 1,
        is_available: true,
      },

      // Smith Machine 2
      {
        exercise_type: "barbell",
        gym_floor_id: floor2.id,
        name: "Smith Machine 2",
        capacity: 1,
        is_available: true,
      },

      // Smith Machine 3
      {
        exercise_type: "barbell",
        gym_floor_id: floor2.id,
        name: "Smith Machine 3",
        capacity: 1,
        is_available: true,
      },

      // Squat Cage 1
      {
        exercise_type: "barbell",
        gym_floor_id: floor2.id,
        name: "Squat Cage 1",
        capacity: 1,
        is_available: true,
      },

      // Squat Cage 2
      {
        exercise_type: "barbell",
        gym_floor_id: floor2.id,
        name: "Squat Cage 2",
        capacity: 1,
        is_available: true,
      },

      // Adjustable Bench 1
      {
        exercise_type: "dumbbells", // Benches are primarily used with dumbbells on this floor
        gym_floor_id: floor2.id,
        name: "Adjustable Bench 1",
        capacity: 1,
        is_available: true,
      },

      // Adjustable Bench 2
      {
        exercise_type: "dumbbells",
        gym_floor_id: floor2.id,
        name: "Adjustable Bench 2",
        capacity: 1,
        is_available: true,
      },

      // Adjustable Bench 3
      {
        exercise_type: "dumbbells",
        gym_floor_id: floor2.id,
        name: "Adjustable Bench 3",
        capacity: 1,
        is_available: true,
      },

      // Flat Bench 1
      {
        exercise_type: "dumbbells",
        gym_floor_id: floor2.id,
        name: "Flat Bench 1",
        capacity: 1,
        is_available: true,
      },

      // Flat Bench 2
      {
        exercise_type: "dumbbells",
        gym_floor_id: floor2.id,
        name: "Flat Bench 2",
        capacity: 1,
        is_available: true,
      },

      // HAMMER STRENGTH MACHINES

      // Hammer Strength Chest Press
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Chest Press",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Incline Press
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Incline Press",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Shoulder Press
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Shoulder Press",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength High Row
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength High Row",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Low Row
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Low Row",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Pulldown
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Pulldown",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Leg Press
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Leg Press",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Leg Curl
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Leg Curl",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Leg Extension
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Leg Extension",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Hack Squat
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Hack Squat",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Calf Raise
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Calf Raise",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Decline Press
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Decline Press",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Dip/Pullup Station
      {
        exercise_type: "bodyweight",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Dip/Pullup Station",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Lateral Raise
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Lateral Raise",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Rear Delt
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Rear Delt",
        capacity: 1,
        is_available: true,
      },

      // Hammer Strength Shrug
      {
        exercise_type: "machine",
        gym_floor_id: floor2.id,
        name: "Hammer Strength Shrug",
        capacity: 1,
        is_available: true,
      },
    ];

    // Insert all equipment
    const allEquipment = [...floor1Equipment, ...floor2Equipment];
    await tx
      .insert(equipmentInstances)
      .values(allEquipment)
      .onConflictDoNothing();

    console.log(
      `Seeded ${floor1Equipment.length} equipment instances on Floor 1`,
    );
    console.log(
      `Seeded ${floor2Equipment.length} equipment instances on Floor 2`,
    );
    console.log(`Total equipment instances: ${allEquipment.length}`);
  });

  console.log("Gym layout seeding completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
