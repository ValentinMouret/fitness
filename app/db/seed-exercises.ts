import "dotenv/config";
import { type InferInsertModel, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/env.server";
import { logger } from "~/logger.server";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import {
  equipmentPreferences,
  exerciseMuscleGroups,
  exercises,
  exerciseSubstitutions,
} from "./schema";

export const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
  },
});

const exerciseData: Omit<InferInsertModel<typeof exercises>, "id">[] = [
  // PUSH EXERCISES
  // Chest - Horizontal Push
  {
    name: "Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
    mmc_instructions:
      "Drive through the chest, not the arms. Imagine pushing the bar apart as you press. Feel the pecs stretch at the bottom and squeeze together at the top.",
  },
  {
    name: "Incline Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
    mmc_instructions:
      "Focus on driving from the upper chest toward the ceiling. Keep shoulders pinned back and down. Feel the stretch in the upper pecs at the bottom.",
  },
  {
    name: "Dumbbell Bench Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 30,
    complexity_score: 2,
    mmc_instructions:
      "Arc the dumbbells slightly inward as you press, squeezing the chest at the top. Control the descent to feel the pec stretch.",
  },
  {
    name: "Incline Dumbbell Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 30,
    complexity_score: 2,
    mmc_instructions:
      "Press up and slightly in, focusing on the upper chest. Keep elbows at 45°. Pause at the bottom to feel the stretch.",
  },
  {
    name: "Decline Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
    mmc_instructions:
      "Focus on the lower chest fibers. Bar path should touch lower on the chest. Squeeze the pecs hard at lockout.",
  },
  {
    name: "Close-Grip Bench Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 60,
    complexity_score: 3,
    requires_spotter: true,
    mmc_instructions:
      "Keep elbows tucked close to your sides. Focus on the triceps pushing the weight. Feel the stretch in the triceps at the bottom.",
  },
  {
    name: "Chest Press Machine",
    type: "machine",
    movement_pattern: "push",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Push through the chest, not the shoulders. Squeeze the pecs together at the end of each rep. Control the eccentric.",
  },
  {
    name: "Cable Chest Press",
    type: "cable",
    movement_pattern: "push",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Press forward and slightly down, crossing the midline if possible. Keep constant tension on the pecs throughout.",
  },
  {
    name: "Dumbbell Fly",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Slight bend in elbows throughout. Open arms wide to feel the pec stretch. Imagine hugging a tree on the way up.",
  },
  {
    name: "Cable Fly",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Keep slight elbow bend. Focus on bringing the pecs together, not the hands. Squeeze and hold at peak contraction.",
  },
  {
    name: "Pec Deck",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Lead with the elbows, not the hands. Squeeze the pecs together at the front. Control the stretch on the way back.",
  },
  {
    name: "Push-ups",
    type: "bodyweight",
    movement_pattern: "push",
    setup_time_seconds: 5,
    complexity_score: 1,
    mmc_instructions:
      "Protract shoulders at the top to fully engage serratus. Lower with control, feeling the chest stretch. Push through the chest, not just the arms.",
  },

  // Shoulders - Vertical Push
  {
    name: "Overhead Press",
    type: "barbell",
    movement_pattern: "push",
    setup_time_seconds: 45,
    complexity_score: 4,
    requires_spotter: true,
    mmc_instructions:
      "Drive up through the delts, head through at the top. Keep core braced. Feel the shoulders working, not the back.",
  },
  {
    name: "Dumbbell Shoulder Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Press up and slightly in, dumbbells nearly touching at top. Control the descent. Focus on the medial and anterior delts.",
  },
  {
    name: "Arnold Press",
    type: "dumbbells",
    movement_pattern: "push",
    setup_time_seconds: 20,
    complexity_score: 3,
    mmc_instructions:
      "Rotate smoothly through the movement. Feel all three delt heads working through the rotation. Control the tempo.",
  },
  {
    name: "Seated Shoulder Press Machine",
    type: "machine",
    movement_pattern: "push",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Press through the delts, not the triceps. Keep shoulders down away from ears. Full range of motion.",
  },
  {
    name: "Cable Shoulder Press",
    type: "cable",
    movement_pattern: "push",
    setup_time_seconds: 25,
    complexity_score: 2,
    mmc_instructions:
      "Press up and slightly forward. Constant cable tension keeps delts engaged throughout. Control the negative.",
  },

  // PULL EXERCISES
  // Back - Horizontal Pull
  {
    name: "Barbell Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 45,
    complexity_score: 3,
    mmc_instructions:
      "Pull with the elbows, not the hands. Squeeze shoulder blades together at top. Feel the lats stretch at bottom.",
  },
  {
    name: "Pendlay Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 45,
    complexity_score: 4,
    mmc_instructions:
      "Explosive pull from dead stop. Reset fully each rep. Drive elbows back and squeeze lats hard at top.",
  },
  {
    name: "Dumbbell Row",
    type: "dumbbells",
    movement_pattern: "pull",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Row toward your hip, not your armpit. Let the lat fully stretch at bottom. Squeeze the shoulder blade back at top.",
  },
  {
    name: "Cable Row",
    type: "cable",
    movement_pattern: "pull",
    setup_time_seconds: 20,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Pull to belly button, not chest. Squeeze shoulder blades together. Control the stretch forward without rounding back.",
  },
  {
    name: "Chest Supported Row",
    type: "machine",
    movement_pattern: "pull",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Chest stays on pad throughout. Focus purely on pulling with the lats and rear delts. No momentum.",
  },
  {
    name: "T-Bar Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 30,
    complexity_score: 3,
    mmc_instructions:
      "Keep chest up, pull toward lower chest. Squeeze the lats at top. Feel the stretch at bottom without rounding.",
  },

  // Back - Vertical Pull
  {
    name: "Pull-ups",
    type: "bodyweight",
    movement_pattern: "pull",
    setup_time_seconds: 10,
    complexity_score: 4,
    mmc_instructions:
      "Initiate by depressing and retracting shoulder blades. Pull elbows down to your sides. Feel the lats doing the work.",
  },
  {
    name: "Lat Pulldown",
    type: "cable",
    movement_pattern: "pull",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Pull the bar to upper chest, not behind neck. Drive elbows down and back. Feel the lat stretch at top.",
  },
  {
    name: "Chin-ups",
    type: "bodyweight",
    movement_pattern: "pull",
    setup_time_seconds: 10,
    complexity_score: 4,
    mmc_instructions:
      "Supinated grip increases bicep involvement. Still initiate with lats. Control the negative, full stretch at bottom.",
  },
  {
    name: "Straight-Arm Pulldown",
    type: "cable",
    movement_pattern: "pull",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Slight elbow bend, arms stay long. Drive the bar down with your lats, not arms. Squeeze at the bottom.",
  },

  // SQUAT EXERCISES
  {
    name: "Back Squat",
    type: "barbell",
    movement_pattern: "squat",
    setup_time_seconds: 90,
    complexity_score: 4,
    requires_spotter: true,
    mmc_instructions:
      "Drive through the whole foot, push knees out. Feel quads and glutes working together. Keep chest proud.",
  },
  {
    name: "Front Squat",
    type: "barbell",
    movement_pattern: "squat",
    setup_time_seconds: 60,
    complexity_score: 5,
    mmc_instructions:
      "Elbows high, core braced. More quad dominant. Drive up through the quads while keeping torso upright.",
  },
  {
    name: "Goblet Squat",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Keep the weight at chest height as a counterbalance. Push knees out, sit between your heels. Squeeze glutes at top.",
  },
  {
    name: "Leg Press",
    type: "machine",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 1,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Push through the whole foot. Don't lock knees at top. Control the descent. Feel quads burning throughout.",
  },
  {
    name: "Hack Squat",
    type: "machine",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Shoulder pads stay in contact. Drive through heels for glutes, balls of feet for quads. Full range of motion.",
  },
  {
    name: "Bulgarian Split Squat",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 20,
    complexity_score: 3,
    mmc_instructions:
      "Front leg does all the work. Sink straight down. Feel the stretch in the rear leg's hip flexor. Drive through front heel.",
  },
  {
    name: "Walking Lunge",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 15,
    complexity_score: 3,
    mmc_instructions:
      "Step long enough to keep front shin vertical. Push through front heel. Feel glutes and quads propelling you forward.",
  },
  {
    name: "Reverse Lunge",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Step back, lower with control. Front leg does the work. Drive through the front heel to return. Glute focus.",
  },
  {
    name: "Step-ups",
    type: "dumbbells",
    movement_pattern: "squat",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Don't push off the back leg. Drive entirely through the working leg. Step up slow and controlled. Squeeze glute at top.",
  },
  {
    name: "Bodyweight Squat",
    type: "bodyweight",
    movement_pattern: "squat",
    setup_time_seconds: 5,
    complexity_score: 1,
    mmc_instructions:
      "Perfect for warming up. Focus on depth and knee tracking. Arms forward for balance. Feel the quads and glutes.",
  },

  // HINGE EXERCISES
  {
    name: "Deadlift",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 60,
    complexity_score: 5,
    mmc_instructions:
      "Push the floor away with your legs, then drive hips through. Bar stays close. Feel the entire posterior chain.",
  },
  {
    name: "Sumo Deadlift",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 60,
    complexity_score: 4,
    mmc_instructions:
      "Push knees out into elbows. Hips close to bar. More quad and adductor involvement. Keep chest proud.",
  },
  {
    name: "Romanian Deadlift",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 45,
    complexity_score: 3,
    mmc_instructions:
      "Push hips back, feel the hamstrings stretch. Bar slides down thighs. Squeeze glutes hard at top.",
  },
  {
    name: "Dumbbell Romanian Deadlift",
    type: "dumbbells",
    movement_pattern: "hinge",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Same hip hinge pattern. Dumbbells allow slightly more range. Feel the hamstring stretch, drive hips forward to stand.",
  },
  {
    name: "Single-Leg Romanian Deadlift",
    type: "dumbbells",
    movement_pattern: "hinge",
    setup_time_seconds: 20,
    complexity_score: 4,
    mmc_instructions:
      "Hinge from the hip of the standing leg. Rear leg for balance only. Feel the hamstring and glute of the working leg.",
  },
  {
    name: "Hip Thrust",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 45,
    complexity_score: 2,
    mmc_instructions:
      "Drive through heels, squeeze glutes at top. Chin tucked. Hold the contraction for 1-2 seconds. No lower back hyperextension.",
  },
  {
    name: "Cable Pull Through",
    type: "cable",
    movement_pattern: "hinge",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Hinge back, letting cable pull you. Drive hips forward to stand. Squeeze glutes hard at top. Great glute mind-muscle work.",
  },
  {
    name: "Good Morning",
    type: "barbell",
    movement_pattern: "hinge",
    setup_time_seconds: 45,
    complexity_score: 4,
    mmc_instructions:
      "Soft knees, hinge from hips. Feel the hamstrings load. Keep back neutral. Stand by driving hips forward.",
  },
  {
    name: "Leg Curl",
    type: "machine",
    movement_pattern: "hinge",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Curl with intention, squeeze hamstrings at peak contraction. Control the negative. Don't let the weight slam.",
  },
  {
    name: "Glute Ham Raise",
    type: "bodyweight",
    movement_pattern: "hinge",
    setup_time_seconds: 20,
    complexity_score: 5,
    mmc_instructions:
      "Hamstrings control the descent. Keep hips extended. Feel the intense hamstring stretch. Push with hamstrings to return.",
  },

  // ISOLATION EXERCISES
  // Arms - Biceps
  {
    name: "Barbell Curl",
    type: "barbell",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 1,
    mmc_instructions:
      "Keep elbows pinned at sides. Curl with biceps, not momentum. Squeeze at the top, control the negative.",
  },
  {
    name: "Dumbbell Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Supinate as you curl for full bicep engagement. Don't swing. Feel the bicep stretch at bottom and peak contraction at top.",
  },
  {
    name: "Hammer Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Neutral grip targets brachialis and forearms. No swinging. Feel the outer arm working. Control both directions.",
  },
  {
    name: "Incline Dumbbell Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Arms hang back, stretching the bicep. Curl without moving upper arm. Intense bicep stretch at bottom.",
  },
  {
    name: "Preacher Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Arm locked against pad eliminates cheating. Full stretch at bottom. Squeeze hard at top. Pure bicep isolation.",
  },
  {
    name: "Concentration Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Elbow braced against inner thigh. No body movement. Watch the bicep contract. Peak contraction focus.",
  },
  {
    name: "Cable Curl",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Constant tension from the cable. Keep elbows forward slightly. Squeeze at peak, control the release.",
  },

  // Arms - Triceps
  {
    name: "Tricep Dips",
    type: "bodyweight",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 2,
    mmc_instructions:
      "Lean slightly forward for chest, upright for triceps. Lower until stretch, push through triceps. Don't go too deep if shoulders complain.",
  },
  {
    name: "Tricep Pushdown",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Elbows locked at sides. Push down and squeeze triceps hard at bottom. Control the return. Don't let elbows flare.",
  },
  {
    name: "Overhead Tricep Extension",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Stretch the long head at the bottom. Elbows point forward, not out. Extend fully, squeeze the triceps.",
  },
  {
    name: "Skull Crushers",
    type: "barbell",
    movement_pattern: "isolation",
    setup_time_seconds: 30,
    complexity_score: 3,
    mmc_instructions:
      "Lower to forehead or just behind. Elbows stay pointed up. Feel the tricep stretch, then extend powerfully.",
  },
  {
    name: "Cable Overhead Extension",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Face away from cable. Stretch triceps at bottom, extend fully. Constant cable tension. Keep elbows steady.",
  },
  {
    name: "Tricep Kickback",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Upper arm parallel to floor, locked. Extend fully and squeeze. Lower with control. Light weight, perfect form.",
  },

  // Shoulders - Isolation
  {
    name: "Lateral Raise",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 1,
    mmc_instructions:
      "Lead with elbows, not hands. Slight forward lean. Raise to shoulder height. Control the descent.",
  },
  {
    name: "Cable Lateral Raise",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Constant tension throughout range. Lead with elbow. Feel the medial delt burning. Don't go too heavy.",
  },
  {
    name: "Machine Lateral Raise",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Push with elbows against pads. Focus on the lateral delt. Control up and down. Great for drop sets.",
  },
  {
    name: "Front Raise",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 1,
    mmc_instructions:
      "Raise to eye level, no higher. Feel the anterior delt. Alternate arms or both together. Control the weight.",
  },
  {
    name: "Rear Delt Fly",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Bent over, fly arms out leading with elbows. Squeeze rear delts. Don't use momentum. Light weight works best.",
  },
  {
    name: "Cable Rear Delt Fly",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Pull high and wide, cables cross. Lead with elbows. Squeeze rear delts at peak. Constant tension.",
  },
  {
    name: "Reverse Pec Deck",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Face the pad, push back with elbows. Squeeze rear delts. Don't let the weight slam. Feel the stretch forward.",
  },
  {
    name: "Face Pull",
    type: "cable",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Pull to face, not chest. Externally rotate at end. Squeeze rear delts and external rotators. Hold the contraction.",
  },
  {
    name: "Upright Row",
    type: "barbell",
    movement_pattern: "pull",
    setup_time_seconds: 20,
    complexity_score: 2,
    mmc_instructions:
      "Wide grip is safer for shoulders. Lead with elbows up. Feel traps and lateral delts. Don't go above shoulder height.",
  },
  {
    name: "Barbell Shrug",
    type: "barbell",
    movement_pattern: "isolation",
    setup_time_seconds: 20,
    complexity_score: 1,
    mmc_instructions:
      "Shrug straight up, don't roll. Squeeze traps at top, hold briefly. Control the negative. Heavy weights okay.",
  },
  {
    name: "Dumbbell Shrug",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Shrug straight up, squeeze and hold. Arms by sides. Feel the trap contraction at top. Control down.",
  },

  // Legs - Isolation
  {
    name: "Leg Extension",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Extend fully, squeeze quads at top. Control the descent. Don't swing. Feel the quad burn. Great for pre-exhaust.",
  },
  {
    name: "Calf Raise",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Full stretch at bottom, hard squeeze at top. Hold the peak contraction. Slow negatives. Feel the calves working.",
  },
  {
    name: "Seated Calf Raise",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Targets the soleus. Full range of motion. Pause at bottom and top. Control throughout. Calves need volume.",
  },
  {
    name: "Hip Abduction",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Push out with the glute med, not momentum. Control in and out. Great for glute activation and hip stability.",
  },
  {
    name: "Hip Adduction",
    type: "machine",
    movement_pattern: "isolation",
    setup_time_seconds: 15,
    complexity_score: 1,
    mmc_instructions:
      "Squeeze inner thighs together. Hold at peak contraction. Control the release. Don't use momentum.",
  },

  // Forearms
  {
    name: "Wrist Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 1,
    mmc_instructions:
      "Rest forearms on thighs or bench. Curl the wrist up, squeeze forearm flexors. Full range. High reps work well.",
  },
  {
    name: "Reverse Wrist Curl",
    type: "dumbbells",
    movement_pattern: "isolation",
    setup_time_seconds: 10,
    complexity_score: 1,
    mmc_instructions:
      "Overhand grip, curl wrist up. Targets forearm extensors. Light weight, high reps. Feel the burn in outer forearm.",
  },
  {
    name: "Farmer's Carry",
    type: "dumbbells",
    movement_pattern: "gait",
    setup_time_seconds: 15,
    complexity_score: 2,
    mmc_instructions:
      "Heavy weight, walk tall. Grip hard, core braced. Feel the entire body working. Great for grip and stability.",
  },

  // CORE EXERCISES
  {
    name: "Plank",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 1,
    mmc_instructions:
      "Squeeze glutes, brace core, don't sag hips. Imagine pulling elbows to toes. Breathe and hold tension.",
  },
  {
    name: "Dead Bug",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
    mmc_instructions:
      "Press lower back into floor throughout. Opposite arm and leg extend. Exhale as you extend. Core stays tight.",
  },
  {
    name: "Bird Dog",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
    mmc_instructions:
      "Extend opposite arm and leg without rotating. Keep hips square. Feel the anti-rotation in your core.",
  },
  {
    name: "Ab Wheel",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 10,
    complexity_score: 3,
    mmc_instructions:
      "Roll out controlled, core braced. Don't let hips sag. Pull back with abs, not arms. Start with short range.",
  },
  {
    name: "Cable Crunch",
    type: "cable",
    movement_pattern: "core",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Crunch down with abs, not arms. Feel the abs shortening. Hold the contraction. Control up.",
  },
  {
    name: "Hanging Leg Raise",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 10,
    complexity_score: 4,
    mmc_instructions:
      "Raise legs by curling pelvis up, not just hip flexors. Control the descent. No swinging. Feel lower abs.",
  },
  {
    name: "Pallof Press",
    type: "cable",
    movement_pattern: "core",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Press out and resist rotation. Core fights the cable pull. Hold at full extension. Great anti-rotation work.",
  },
  {
    name: "Russian Twist",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
    mmc_instructions:
      "Lean back, feet up or down. Rotate with the obliques, not just the arms. Control the twist. Feel obliques working.",
  },
  {
    name: "Cable Woodchop",
    type: "cable",
    movement_pattern: "rotation",
    setup_time_seconds: 15,
    complexity_score: 2,
    equipment_sharing_friendly: true,
    mmc_instructions:
      "Rotate through the core, arms stay straight. Drive with obliques and hips. Control both directions.",
  },
  {
    name: "Side Plank",
    type: "bodyweight",
    movement_pattern: "core",
    setup_time_seconds: 5,
    complexity_score: 2,
    mmc_instructions:
      "Stack hips, don't let them drop. Feel the obliques holding you up. Shoulder over elbow. Breathe.",
  },
];

// Equipment preferences based on evidence-based hierarchy: Cables > Dumbbells > Barbells > Machines (except legs)
const equipmentPreferenceData: InferInsertModel<typeof equipmentPreferences>[] =
  [
    // Chest preferences
    { muscle_group: "pecs", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "pecs", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "pecs", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "pecs", exercise_type: "machine", preference_score: 6 },
    { muscle_group: "pecs", exercise_type: "bodyweight", preference_score: 7 },

    // Back preferences
    { muscle_group: "lats", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "lats", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "lats", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "lats", exercise_type: "machine", preference_score: 7 },
    { muscle_group: "lats", exercise_type: "bodyweight", preference_score: 9 },

    // Shoulders preferences
    { muscle_group: "delts", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "delts", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "delts", exercise_type: "barbell", preference_score: 7 },
    { muscle_group: "delts", exercise_type: "machine", preference_score: 6 },
    { muscle_group: "delts", exercise_type: "bodyweight", preference_score: 5 },

    // Arms preferences
    { muscle_group: "biceps", exercise_type: "cable", preference_score: 10 },
    { muscle_group: "biceps", exercise_type: "dumbbells", preference_score: 9 },
    { muscle_group: "biceps", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "biceps", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "biceps",
      exercise_type: "bodyweight",
      preference_score: 7,
    },

    { muscle_group: "triceps", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "triceps",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "triceps", exercise_type: "barbell", preference_score: 7 },
    { muscle_group: "triceps", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "triceps",
      exercise_type: "bodyweight",
      preference_score: 8,
    },

    // Legs preferences (machines preferred due to leverage advantages)
    { muscle_group: "quads", exercise_type: "machine", preference_score: 10 },
    { muscle_group: "quads", exercise_type: "barbell", preference_score: 9 },
    { muscle_group: "quads", exercise_type: "dumbbells", preference_score: 7 },
    { muscle_group: "quads", exercise_type: "cable", preference_score: 6 },
    { muscle_group: "quads", exercise_type: "bodyweight", preference_score: 5 },

    { muscle_group: "glutes", exercise_type: "barbell", preference_score: 10 },
    { muscle_group: "glutes", exercise_type: "machine", preference_score: 9 },
    { muscle_group: "glutes", exercise_type: "cable", preference_score: 8 },
    { muscle_group: "glutes", exercise_type: "dumbbells", preference_score: 7 },
    {
      muscle_group: "glutes",
      exercise_type: "bodyweight",
      preference_score: 6,
    },

    {
      muscle_group: "armstrings",
      exercise_type: "machine",
      preference_score: 10,
    },
    {
      muscle_group: "armstrings",
      exercise_type: "barbell",
      preference_score: 9,
    },
    {
      muscle_group: "armstrings",
      exercise_type: "dumbbells",
      preference_score: 8,
    },
    { muscle_group: "armstrings", exercise_type: "cable", preference_score: 7 },
    {
      muscle_group: "armstrings",
      exercise_type: "bodyweight",
      preference_score: 5,
    },

    { muscle_group: "calves", exercise_type: "machine", preference_score: 10 },
    { muscle_group: "calves", exercise_type: "dumbbells", preference_score: 7 },
    { muscle_group: "calves", exercise_type: "barbell", preference_score: 6 },
    { muscle_group: "calves", exercise_type: "cable", preference_score: 8 },
    {
      muscle_group: "calves",
      exercise_type: "bodyweight",
      preference_score: 5,
    },

    // Core preferences
    { muscle_group: "abs", exercise_type: "bodyweight", preference_score: 10 },
    { muscle_group: "abs", exercise_type: "cable", preference_score: 9 },
    { muscle_group: "abs", exercise_type: "machine", preference_score: 7 },
    { muscle_group: "abs", exercise_type: "dumbbells", preference_score: 6 },
    { muscle_group: "abs", exercise_type: "barbell", preference_score: 5 },

    // Other muscle groups
    { muscle_group: "trapezes", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "trapezes",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "trapezes", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "trapezes", exercise_type: "machine", preference_score: 7 },
    {
      muscle_group: "trapezes",
      exercise_type: "bodyweight",
      preference_score: 6,
    },

    {
      muscle_group: "lower_back",
      exercise_type: "barbell",
      preference_score: 10,
    },
    { muscle_group: "lower_back", exercise_type: "cable", preference_score: 9 },
    {
      muscle_group: "lower_back",
      exercise_type: "machine",
      preference_score: 8,
    },
    {
      muscle_group: "lower_back",
      exercise_type: "dumbbells",
      preference_score: 7,
    },
    {
      muscle_group: "lower_back",
      exercise_type: "bodyweight",
      preference_score: 9,
    },

    { muscle_group: "forearm", exercise_type: "cable", preference_score: 10 },
    {
      muscle_group: "forearm",
      exercise_type: "dumbbells",
      preference_score: 9,
    },
    { muscle_group: "forearm", exercise_type: "barbell", preference_score: 8 },
    { muscle_group: "forearm", exercise_type: "machine", preference_score: 6 },
    {
      muscle_group: "forearm",
      exercise_type: "bodyweight",
      preference_score: 7,
    },
  ];

async function main() {
  logger.info("Starting exercise database seeding...");

  await db.transaction(async (tx) => {
    logger.info("Seeding exercises...");
    const insertedExercises = await tx
      .insert(exercises)
      .values(exerciseData)
      .onConflictDoUpdate({
        target: [exercises.name, exercises.type],
        targetWhere: sql`${exercises.deleted_at} IS NULL`,
        set: {
          description: sql`excluded.description`,
          mmc_instructions: sql`excluded.mmc_instructions`,
          movement_pattern: sql`excluded.movement_pattern`,
          setup_time_seconds: sql`excluded.setup_time_seconds`,
          complexity_score: sql`excluded.complexity_score`,
          equipment_sharing_friendly: sql`excluded.equipment_sharing_friendly`,
          requires_spotter: sql`excluded.requires_spotter`,
          updated_at: sql`now()`,
        },
      })
      .returning();
    logger.info({ count: insertedExercises.length }, "Inserted exercises");

    logger.info("Seeding equipment preferences...");
    await tx
      .insert(equipmentPreferences)
      .values(equipmentPreferenceData)
      .onConflictDoNothing();

    logger.info("Seeding exercise muscle groups...");
    const muscleGroupMappings: Array<{
      exerciseName: string;
      muscleGroups: Array<{ muscle_group: MuscleGroup; split: number }>;
    }> = [
      // Chest exercises
      {
        exerciseName: "Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 10 },
        ],
      },
      {
        exerciseName: "Incline Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 65 },
          { muscle_group: "delts", split: 25 },
          { muscle_group: "triceps", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 75 },
          { muscle_group: "triceps", split: 15 },
          { muscle_group: "delts", split: 10 },
        ],
      },
      {
        exerciseName: "Incline Dumbbell Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 60 },
          { muscle_group: "delts", split: 30 },
          { muscle_group: "triceps", split: 10 },
        ],
      },
      {
        exerciseName: "Chest Press Machine",
        muscleGroups: [
          { muscle_group: "pecs", split: 80 },
          { muscle_group: "triceps", split: 15 },
          { muscle_group: "delts", split: 5 },
        ],
      },
      {
        exerciseName: "Cable Chest Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 75 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 5 },
        ],
      },
      {
        exerciseName: "Push-ups",
        muscleGroups: [
          { muscle_group: "pecs", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 10 },
        ],
      },

      // Shoulder exercises
      {
        exerciseName: "Overhead Press",
        muscleGroups: [
          { muscle_group: "delts", split: 70 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "trapezes", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Shoulder Press",
        muscleGroups: [
          { muscle_group: "delts", split: 75 },
          { muscle_group: "triceps", split: 25 },
        ],
      },
      {
        exerciseName: "Seated Shoulder Press Machine",
        muscleGroups: [
          { muscle_group: "delts", split: 80 },
          { muscle_group: "triceps", split: 20 },
        ],
      },
      {
        exerciseName: "Cable Shoulder Press",
        muscleGroups: [
          { muscle_group: "delts", split: 75 },
          { muscle_group: "triceps", split: 25 },
        ],
      },

      // Back exercises
      {
        exerciseName: "Barbell Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 30 },
          { muscle_group: "delts", split: 20 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Row",
        muscleGroups: [
          { muscle_group: "lats", split: 45 },
          { muscle_group: "trapezes", split: 25 },
          { muscle_group: "delts", split: 20 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Chest Supported Row",
        muscleGroups: [
          { muscle_group: "lats", split: 45 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 5 },
        ],
      },
      {
        exerciseName: "T-Bar Row",
        muscleGroups: [
          { muscle_group: "lats", split: 40 },
          { muscle_group: "trapezes", split: 35 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Pull-ups",
        muscleGroups: [
          { muscle_group: "lats", split: 60 },
          { muscle_group: "biceps", split: 25 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Lat Pulldown",
        muscleGroups: [
          { muscle_group: "lats", split: 65 },
          { muscle_group: "biceps", split: 20 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Chin-ups",
        muscleGroups: [
          { muscle_group: "lats", split: 55 },
          { muscle_group: "biceps", split: 35 },
          { muscle_group: "trapezes", split: 10 },
        ],
      },

      // Squat exercises
      {
        exerciseName: "Back Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 30 },
          { muscle_group: "armstrings", split: 10 },
        ],
      },
      {
        exerciseName: "Front Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 70 },
          { muscle_group: "glutes", split: 25 },
          { muscle_group: "abs", split: 5 },
        ],
      },
      {
        exerciseName: "Goblet Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 65 },
          { muscle_group: "glutes", split: 35 },
        ],
      },
      {
        exerciseName: "Leg Press",
        muscleGroups: [
          { muscle_group: "quads", split: 70 },
          { muscle_group: "glutes", split: 30 },
        ],
      },
      {
        exerciseName: "Hack Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 75 },
          { muscle_group: "glutes", split: 25 },
        ],
      },
      {
        exerciseName: "Bulgarian Split Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 40 },
        ],
      },
      {
        exerciseName: "Bodyweight Squat",
        muscleGroups: [
          { muscle_group: "quads", split: 60 },
          { muscle_group: "glutes", split: 40 },
        ],
      },

      // Hinge exercises
      {
        exerciseName: "Deadlift",
        muscleGroups: [
          { muscle_group: "glutes", split: 35 },
          { muscle_group: "armstrings", split: 30 },
          { muscle_group: "lower_back", split: 20 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Romanian Deadlift",
        muscleGroups: [
          { muscle_group: "armstrings", split: 50 },
          { muscle_group: "glutes", split: 40 },
          { muscle_group: "lower_back", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Romanian Deadlift",
        muscleGroups: [
          { muscle_group: "armstrings", split: 55 },
          { muscle_group: "glutes", split: 45 },
        ],
      },
      {
        exerciseName: "Hip Thrust",
        muscleGroups: [
          { muscle_group: "glutes", split: 90 },
          { muscle_group: "armstrings", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Pull Through",
        muscleGroups: [
          { muscle_group: "glutes", split: 70 },
          { muscle_group: "armstrings", split: 30 },
        ],
      },
      {
        exerciseName: "Leg Curl",
        muscleGroups: [{ muscle_group: "armstrings", split: 100 }],
      },

      // Isolation exercises
      {
        exerciseName: "Barbell Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 90 },
          { muscle_group: "forearm", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 90 },
          { muscle_group: "forearm", split: 10 },
        ],
      },
      {
        exerciseName: "Cable Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 95 },
          { muscle_group: "forearm", split: 5 },
        ],
      },
      {
        exerciseName: "Tricep Dips",
        muscleGroups: [
          { muscle_group: "triceps", split: 85 },
          { muscle_group: "pecs", split: 15 },
        ],
      },
      {
        exerciseName: "Tricep Pushdown",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Overhead Tricep Extension",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Lateral Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Cable Lateral Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Rear Delt Fly",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Cable Rear Delt Fly",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Face Pull",
        muscleGroups: [
          { muscle_group: "delts", split: 70 },
          { muscle_group: "trapezes", split: 30 },
        ],
      },
      {
        exerciseName: "Leg Extension",
        muscleGroups: [{ muscle_group: "quads", split: 100 }],
      },
      {
        exerciseName: "Calf Raise",
        muscleGroups: [{ muscle_group: "calves", split: 100 }],
      },

      // Core exercises
      {
        exerciseName: "Plank",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Dead Bug",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Bird Dog",
        muscleGroups: [
          { muscle_group: "abs", split: 80 },
          { muscle_group: "lower_back", split: 20 },
        ],
      },
      {
        exerciseName: "Ab Wheel",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Cable Crunch",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Hanging Leg Raise",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },

      // NEW EXERCISES - Chest
      {
        exerciseName: "Decline Bench Press",
        muscleGroups: [
          { muscle_group: "pecs", split: 75 },
          { muscle_group: "triceps", split: 20 },
          { muscle_group: "delts", split: 5 },
        ],
      },
      {
        exerciseName: "Close-Grip Bench Press",
        muscleGroups: [
          { muscle_group: "triceps", split: 60 },
          { muscle_group: "pecs", split: 30 },
          { muscle_group: "delts", split: 10 },
        ],
      },
      {
        exerciseName: "Dumbbell Fly",
        muscleGroups: [{ muscle_group: "pecs", split: 100 }],
      },
      {
        exerciseName: "Cable Fly",
        muscleGroups: [{ muscle_group: "pecs", split: 100 }],
      },
      {
        exerciseName: "Pec Deck",
        muscleGroups: [{ muscle_group: "pecs", split: 100 }],
      },

      // NEW EXERCISES - Shoulders
      {
        exerciseName: "Arnold Press",
        muscleGroups: [
          { muscle_group: "delts", split: 80 },
          { muscle_group: "triceps", split: 20 },
        ],
      },
      {
        exerciseName: "Machine Lateral Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Front Raise",
        muscleGroups: [{ muscle_group: "delts", split: 100 }],
      },
      {
        exerciseName: "Reverse Pec Deck",
        muscleGroups: [
          { muscle_group: "delts", split: 85 },
          { muscle_group: "trapezes", split: 15 },
        ],
      },
      {
        exerciseName: "Upright Row",
        muscleGroups: [
          { muscle_group: "delts", split: 60 },
          { muscle_group: "trapezes", split: 40 },
        ],
      },
      {
        exerciseName: "Barbell Shrug",
        muscleGroups: [{ muscle_group: "trapezes", split: 100 }],
      },
      {
        exerciseName: "Dumbbell Shrug",
        muscleGroups: [{ muscle_group: "trapezes", split: 100 }],
      },

      // NEW EXERCISES - Back
      {
        exerciseName: "Pendlay Row",
        muscleGroups: [
          { muscle_group: "lats", split: 45 },
          { muscle_group: "trapezes", split: 30 },
          { muscle_group: "delts", split: 15 },
          { muscle_group: "biceps", split: 10 },
        ],
      },
      {
        exerciseName: "Straight-Arm Pulldown",
        muscleGroups: [
          { muscle_group: "lats", split: 90 },
          { muscle_group: "trapezes", split: 10 },
        ],
      },

      // NEW EXERCISES - Legs
      {
        exerciseName: "Walking Lunge",
        muscleGroups: [
          { muscle_group: "quads", split: 55 },
          { muscle_group: "glutes", split: 45 },
        ],
      },
      {
        exerciseName: "Reverse Lunge",
        muscleGroups: [
          { muscle_group: "quads", split: 50 },
          { muscle_group: "glutes", split: 50 },
        ],
      },
      {
        exerciseName: "Step-ups",
        muscleGroups: [
          { muscle_group: "quads", split: 55 },
          { muscle_group: "glutes", split: 45 },
        ],
      },

      // NEW EXERCISES - Hinge
      {
        exerciseName: "Sumo Deadlift",
        muscleGroups: [
          { muscle_group: "quads", split: 30 },
          { muscle_group: "glutes", split: 35 },
          { muscle_group: "armstrings", split: 20 },
          { muscle_group: "lower_back", split: 15 },
        ],
      },
      {
        exerciseName: "Single-Leg Romanian Deadlift",
        muscleGroups: [
          { muscle_group: "armstrings", split: 50 },
          { muscle_group: "glutes", split: 50 },
        ],
      },
      {
        exerciseName: "Good Morning",
        muscleGroups: [
          { muscle_group: "armstrings", split: 45 },
          { muscle_group: "glutes", split: 35 },
          { muscle_group: "lower_back", split: 20 },
        ],
      },
      {
        exerciseName: "Glute Ham Raise",
        muscleGroups: [
          { muscle_group: "armstrings", split: 60 },
          { muscle_group: "glutes", split: 40 },
        ],
      },

      // NEW EXERCISES - Biceps
      {
        exerciseName: "Hammer Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 70 },
          { muscle_group: "forearm", split: 30 },
        ],
      },
      {
        exerciseName: "Incline Dumbbell Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 95 },
          { muscle_group: "forearm", split: 5 },
        ],
      },
      {
        exerciseName: "Preacher Curl",
        muscleGroups: [
          { muscle_group: "biceps", split: 95 },
          { muscle_group: "forearm", split: 5 },
        ],
      },
      {
        exerciseName: "Concentration Curl",
        muscleGroups: [{ muscle_group: "biceps", split: 100 }],
      },

      // NEW EXERCISES - Triceps
      {
        exerciseName: "Skull Crushers",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Cable Overhead Extension",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },
      {
        exerciseName: "Tricep Kickback",
        muscleGroups: [{ muscle_group: "triceps", split: 100 }],
      },

      // NEW EXERCISES - Legs Isolation
      {
        exerciseName: "Seated Calf Raise",
        muscleGroups: [{ muscle_group: "calves", split: 100 }],
      },
      {
        exerciseName: "Hip Abduction",
        muscleGroups: [{ muscle_group: "glutes", split: 100 }],
      },
      {
        exerciseName: "Hip Adduction",
        muscleGroups: [{ muscle_group: "quads", split: 100 }],
      },

      // NEW EXERCISES - Forearms
      {
        exerciseName: "Wrist Curl",
        muscleGroups: [{ muscle_group: "forearm", split: 100 }],
      },
      {
        exerciseName: "Reverse Wrist Curl",
        muscleGroups: [{ muscle_group: "forearm", split: 100 }],
      },
      {
        exerciseName: "Farmer's Carry",
        muscleGroups: [
          { muscle_group: "forearm", split: 40 },
          { muscle_group: "trapezes", split: 30 },
          { muscle_group: "abs", split: 30 },
        ],
      },

      // NEW EXERCISES - Core
      {
        exerciseName: "Pallof Press",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Russian Twist",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Cable Woodchop",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
      {
        exerciseName: "Side Plank",
        muscleGroups: [{ muscle_group: "abs", split: 100 }],
      },
    ];

    // Insert muscle group relationships
    for (const mapping of muscleGroupMappings) {
      const exercise = insertedExercises.find(
        (e) => e.name === mapping.exerciseName,
      );
      if (exercise) {
        const muscleGroupData = mapping.muscleGroups.map((mg) => ({
          exercise: exercise.id,
          muscle_group: mg.muscle_group,
          split: mg.split,
        }));
        await tx
          .insert(exerciseMuscleGroups)
          .values(muscleGroupData)
          .onConflictDoNothing();
      }
    }

    logger.info("Seeding exercise substitutions...");
    const substitutionMappings: Array<{
      primary: string;
      substitute: string;
      similarity: number;
      overlap: number;
      difficulty: number;
    }> = [
      // Chest substitutions
      {
        primary: "Bench Press",
        substitute: "Dumbbell Bench Press",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },
      {
        primary: "Bench Press",
        substitute: "Cable Chest Press",
        similarity: 0.85,
        overlap: 90,
        difficulty: -2,
      },
      {
        primary: "Dumbbell Bench Press",
        substitute: "Cable Chest Press",
        similarity: 0.88,
        overlap: 92,
        difficulty: 0,
      },
      {
        primary: "Incline Bench Press",
        substitute: "Incline Dumbbell Press",
        similarity: 0.92,
        overlap: 95,
        difficulty: -1,
      },

      // Shoulder substitutions
      {
        primary: "Overhead Press",
        substitute: "Dumbbell Shoulder Press",
        similarity: 0.9,
        overlap: 90,
        difficulty: -1,
      },
      {
        primary: "Dumbbell Shoulder Press",
        substitute: "Cable Shoulder Press",
        similarity: 0.88,
        overlap: 88,
        difficulty: 0,
      },

      // Back substitutions
      {
        primary: "Barbell Row",
        substitute: "Dumbbell Row",
        similarity: 0.9,
        overlap: 90,
        difficulty: -1,
      },
      {
        primary: "Barbell Row",
        substitute: "Cable Row",
        similarity: 0.88,
        overlap: 85,
        difficulty: -2,
      },
      {
        primary: "Pull-ups",
        substitute: "Lat Pulldown",
        similarity: 0.9,
        overlap: 90,
        difficulty: -2,
      },
      {
        primary: "Chin-ups",
        substitute: "Pull-ups",
        similarity: 0.85,
        overlap: 80,
        difficulty: 0,
      },

      // Squat substitutions
      {
        primary: "Back Squat",
        substitute: "Front Squat",
        similarity: 0.9,
        overlap: 85,
        difficulty: 1,
      },
      {
        primary: "Back Squat",
        substitute: "Leg Press",
        similarity: 0.8,
        overlap: 80,
        difficulty: -3,
      },
      {
        primary: "Leg Press",
        substitute: "Hack Squat",
        similarity: 0.9,
        overlap: 95,
        difficulty: 1,
      },

      // Hinge substitutions
      {
        primary: "Deadlift",
        substitute: "Romanian Deadlift",
        similarity: 0.85,
        overlap: 80,
        difficulty: -1,
      },
      {
        primary: "Romanian Deadlift",
        substitute: "Dumbbell Romanian Deadlift",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },

      // Isolation substitutions
      {
        primary: "Barbell Curl",
        substitute: "Dumbbell Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Dumbbell Curl",
        substitute: "Cable Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Lateral Raise",
        substitute: "Cable Lateral Raise",
        similarity: 0.95,
        overlap: 98,
        difficulty: 0,
      },

      // NEW SUBSTITUTIONS - Chest
      {
        primary: "Bench Press",
        substitute: "Decline Bench Press",
        similarity: 0.88,
        overlap: 90,
        difficulty: 0,
      },
      {
        primary: "Dumbbell Fly",
        substitute: "Cable Fly",
        similarity: 0.95,
        overlap: 98,
        difficulty: 0,
      },
      {
        primary: "Cable Fly",
        substitute: "Pec Deck",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },

      // NEW SUBSTITUTIONS - Shoulders
      {
        primary: "Dumbbell Shoulder Press",
        substitute: "Arnold Press",
        similarity: 0.85,
        overlap: 85,
        difficulty: 1,
      },
      {
        primary: "Lateral Raise",
        substitute: "Machine Lateral Raise",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },
      {
        primary: "Rear Delt Fly",
        substitute: "Cable Rear Delt Fly",
        similarity: 0.95,
        overlap: 98,
        difficulty: 0,
      },
      {
        primary: "Rear Delt Fly",
        substitute: "Reverse Pec Deck",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },
      {
        primary: "Barbell Shrug",
        substitute: "Dumbbell Shrug",
        similarity: 0.95,
        overlap: 98,
        difficulty: 0,
      },

      // NEW SUBSTITUTIONS - Back
      {
        primary: "Barbell Row",
        substitute: "Pendlay Row",
        similarity: 0.9,
        overlap: 95,
        difficulty: 1,
      },
      {
        primary: "Lat Pulldown",
        substitute: "Straight-Arm Pulldown",
        similarity: 0.75,
        overlap: 80,
        difficulty: 0,
      },

      // NEW SUBSTITUTIONS - Legs
      {
        primary: "Bulgarian Split Squat",
        substitute: "Walking Lunge",
        similarity: 0.85,
        overlap: 90,
        difficulty: 0,
      },
      {
        primary: "Walking Lunge",
        substitute: "Reverse Lunge",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Reverse Lunge",
        substitute: "Step-ups",
        similarity: 0.85,
        overlap: 90,
        difficulty: -1,
      },

      // NEW SUBSTITUTIONS - Hinge
      {
        primary: "Deadlift",
        substitute: "Sumo Deadlift",
        similarity: 0.9,
        overlap: 85,
        difficulty: 0,
      },
      {
        primary: "Romanian Deadlift",
        substitute: "Single-Leg Romanian Deadlift",
        similarity: 0.85,
        overlap: 90,
        difficulty: 1,
      },
      {
        primary: "Romanian Deadlift",
        substitute: "Good Morning",
        similarity: 0.85,
        overlap: 85,
        difficulty: 1,
      },
      {
        primary: "Leg Curl",
        substitute: "Glute Ham Raise",
        similarity: 0.8,
        overlap: 85,
        difficulty: 3,
      },

      // NEW SUBSTITUTIONS - Biceps
      {
        primary: "Dumbbell Curl",
        substitute: "Hammer Curl",
        similarity: 0.85,
        overlap: 85,
        difficulty: 0,
      },
      {
        primary: "Dumbbell Curl",
        substitute: "Incline Dumbbell Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Barbell Curl",
        substitute: "Preacher Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },
      {
        primary: "Concentration Curl",
        substitute: "Preacher Curl",
        similarity: 0.9,
        overlap: 95,
        difficulty: 0,
      },

      // NEW SUBSTITUTIONS - Triceps
      {
        primary: "Skull Crushers",
        substitute: "Overhead Tricep Extension",
        similarity: 0.9,
        overlap: 95,
        difficulty: -1,
      },
      {
        primary: "Tricep Pushdown",
        substitute: "Cable Overhead Extension",
        similarity: 0.85,
        overlap: 90,
        difficulty: 1,
      },
      {
        primary: "Overhead Tricep Extension",
        substitute: "Tricep Kickback",
        similarity: 0.8,
        overlap: 85,
        difficulty: -1,
      },

      // NEW SUBSTITUTIONS - Calves
      {
        primary: "Calf Raise",
        substitute: "Seated Calf Raise",
        similarity: 0.85,
        overlap: 90,
        difficulty: 0,
      },

      // NEW SUBSTITUTIONS - Core
      {
        primary: "Plank",
        substitute: "Side Plank",
        similarity: 0.8,
        overlap: 80,
        difficulty: 0,
      },
      {
        primary: "Cable Crunch",
        substitute: "Hanging Leg Raise",
        similarity: 0.8,
        overlap: 85,
        difficulty: 1,
      },
      {
        primary: "Russian Twist",
        substitute: "Cable Woodchop",
        similarity: 0.85,
        overlap: 90,
        difficulty: 0,
      },
      {
        primary: "Dead Bug",
        substitute: "Pallof Press",
        similarity: 0.8,
        overlap: 85,
        difficulty: 0,
      },
    ];

    for (const sub of substitutionMappings) {
      const primaryExercise = insertedExercises.find(
        (e) => e.name === sub.primary,
      );
      const substituteExercise = insertedExercises.find(
        (e) => e.name === sub.substitute,
      );

      if (primaryExercise && substituteExercise) {
        await tx
          .insert(exerciseSubstitutions)
          .values({
            primary_exercise_id: primaryExercise.id,
            substitute_exercise_id: substituteExercise.id,
            similarity_score: sub.similarity,
            muscle_overlap_percentage: sub.overlap,
            difficulty_difference: sub.difficulty,
          })
          .onConflictDoNothing();

        // Add reverse substitution with slightly lower similarity
        await tx
          .insert(exerciseSubstitutions)
          .values({
            primary_exercise_id: substituteExercise.id,
            substitute_exercise_id: primaryExercise.id,
            similarity_score: sub.similarity - 0.05,
            muscle_overlap_percentage: sub.overlap,
            difficulty_difference: -sub.difficulty,
          })
          .onConflictDoNothing();
      }
    }
  });

  logger.info("Exercise database seeding completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().finally(async () => await db.$client.end());
}
