/**
 * Test fixtures for Strong workout import functionality
 * These fixtures represent various Strong export formats and edge cases
 */

// The original fixture provided by the user
export const STRONG_EXPORT_SAMPLE = `Early Morning Workout
Wednesday 13 August 2025 at 07:32

Bench Press (Dumbbell)
Set 1: 20 kg × 16
Set 2: 20 kg × 14
Set 3: 20 kg × 12

Leg Extension (Machine)
W1: 20 kg × 5 [Warm-up]
Set 1: 30 kg × 6
Set 2: 30 kg × 8
Set 3: 30 kg × 12

Lat Pulldown (Machine)
W1: 60 kg × 5 [Warm-up]
Set 1: 80 kg × 6
Set 2: 60 kg × 12
Set 3: 60 kg × 12

Lying Leg Curl (Machine)
Set 1: 25 kg × 14
Set 2: 25 kg × 12
Set 3: 25 kg × 12

Lateral Raise (Cable)
Set 1: 5 kg × 14
Set 2: 5 kg × 14
https://link.strong.app/orsuqgte`;

// Workout with decimal weights
export const STRONG_EXPORT_DECIMAL_WEIGHTS = `Push Day
Monday 15 July 2024 at 18:45

Incline Dumbbell Press
Set 1: 22.5 kg × 12
Set 2: 22.5 kg × 10
Set 3: 20 kg × 15

Overhead Press (Barbell)
Set 1: 40 kg × 8
Set 2: 42.5 kg × 6
Set 3: 45 kg × 4

Tricep Dips (Bodyweight)
Set 1: 0 kg × 12
Set 2: 0 kg × 10
Set 3: 0 kg × 8

https://link.strong.app/xyz123`;

// Workout with multiple warm-up sets
export const STRONG_EXPORT_MULTIPLE_WARMUPS = `Heavy Deadlift Session
Friday 20 September 2024 at 19:30

Deadlift (Barbell)
W1: 60 kg × 5 [Warm-up]
W2: 80 kg × 3 [Warm-up]
W3: 100 kg × 1 [Warm-up]
Set 1: 120 kg × 5
Set 2: 130 kg × 3
Set 3: 140 kg × 1

Romanian Deadlift
Set 1: 80 kg × 12
Set 2: 80 kg × 10
Set 3: 80 kg × 8

https://link.strong.app/heavy123`;

// Simple workout with minimal exercises
export const STRONG_EXPORT_MINIMAL = `Quick Session
Tuesday 5 March 2024 at 12:00

Push-ups (Bodyweight)
Set 1: 0 kg × 20
Set 2: 0 kg × 15

Pull-ups (Bodyweight)
Set 1: 0 kg × 8
Set 2: 0 kg × 6

https://link.strong.app/minimal`;

// Workout with complex exercise names
export const STRONG_EXPORT_COMPLEX_NAMES = `Functional Training
Saturday 8 June 2024 at 10:15

Single-Arm Dumbbell Row (Left)
Set 1: 25 kg × 12
Set 2: 27.5 kg × 10
Set 3: 30 kg × 8

Bulgarian Split Squat (Right Leg)
Set 1: 15 kg × 15
Set 2: 15 kg × 12
Set 3: 15 kg × 10

Farmer's Walk (Dumbbell)
Set 1: 30 kg × 30 [seconds]
Set 2: 32.5 kg × 25 [seconds]

https://link.strong.app/functional789`;

// Workout with notes and special annotations
export const STRONG_EXPORT_WITH_NOTES = `Upper Body Power
Thursday 12 April 2024 at 17:00

Bench Press (Barbell)
W1: 60 kg × 8 [Warm-up]
Set 1: 80 kg × 5 [Felt strong]
Set 2: 85 kg × 3 [Good form]
Set 3: 90 kg × 1 [PR attempt]

Barbell Rows
Set 1: 70 kg × 8
Set 2: 75 kg × 6 [Focused on squeeze]
Set 3: 80 kg × 4

https://link.strong.app/notes456`;

// Workout with failure sets
export const STRONG_EXPORT_WITH_FAILURE = `Push to Failure
Friday 25 October 2024 at 16:30

Bench Press (Barbell)
Set 1: 80 kg × 8
Set 2: 85 kg × 6
Set 3: 62.5 kg × 13 [Failure]

Overhead Press (Barbell)
Set 1: 50 kg × 8
Set 2: 52.5 kg × 5 [Failure]
Set 3: 45 kg × 12

https://link.strong.app/failure123`;

// Real world workout with comma decimals and failure sets
export const STRONG_EXPORT_COMMA_DECIMALS_FAILURE = `Early Morning Workout
Tuesday 12 August 2025 at 07:31

Incline Bench Press (Barbell)
W1: 20 kg × 8 [Warm-up]
W2: 40 kg × 8 [Warm-up]
W3: 60 kg × 3 [Warm-up]
Set 1: 62,5 kg × 13 [Failure]
Set 2: 62,5 kg × 7 [Failure]
Set 3: 62,5 kg × 8 [Failure]

Iso-Lateral Row (Machine)
W1: 20 kg × 5 [Warm-up]
W2: 50 kg × 5 [Warm-up]
W3: 65 kg × 3 [Warm-up]
Set 1: 80 kg × 14
Set 2: 85 kg × 10
Set 3: 85 kg × 7

Squat (Barbell)
W1: 20 kg × 6 [Warm-up]
W2: 40 kg × 6 [Warm-up]
Set 1: 60 kg × 6
Set 2: 60 kg × 8

https://link.strong.app/hthwybba`;

// Edge case: Workout with unusual time format
export const STRONG_EXPORT_EDGE_TIME = `Morning Stretch
15 January 2024 07:00

Cat-Cow Stretch
Set 1: 0 kg × 10
Set 2: 0 kg × 10

Child's Pose Hold
Set 1: 0 kg × 30 [seconds]

https://link.strong.app/stretch`;
// Bodyweight exercises with reps-only format (no weight specified)
export const STRONG_EXPORT_BODYWEIGHT_REPS_ONLY = `Morning Workout
Friday 1 August 2025 at 09:14

Chest Dip
Set 1: 10 reps
Set 2: 10 reps
Set 3: 8 reps

Squat (Bodyweight)
Set 1: 15 reps
Set 2: 13 reps
Set 3: 14 reps

Pull Up
Set 1: 10 reps
Set 2: 9 reps
Set 3: 7 reps
https://link.strong.app/naopbvle`;

// Expected parsed results for testing

export const EXPECTED_SAMPLE_PARSED = {
  name: "Early Morning Workout",
  date: new Date(2025, 7, 13, 7, 32), // August is month 7 (0-indexed)
  exercises: [
    {
      name: "Bench Press (Dumbbell)",
      sets: [
        { setNumber: 1, weight: 20, reps: 16, setType: "regular" },
        { setNumber: 2, weight: 20, reps: 14, setType: "regular" },
        { setNumber: 3, weight: 20, reps: 12, setType: "regular" },
      ],
    },
    {
      name: "Leg Extension (Machine)",
      sets: [
        {
          setNumber: 1,
          weight: 20,
          reps: 5,
          setType: "warmup",
          note: "Warm-up",
        },
        { setNumber: 1, weight: 30, reps: 6, setType: "regular" },
        { setNumber: 2, weight: 30, reps: 8, setType: "regular" },
        { setNumber: 3, weight: 30, reps: 12, setType: "regular" },
      ],
    },
    {
      name: "Lat Pulldown (Machine)",
      sets: [
        {
          setNumber: 1,
          weight: 60,
          reps: 5,
          setType: "warmup",
          note: "Warm-up",
        },
        { setNumber: 1, weight: 80, reps: 6, setType: "regular" },
        { setNumber: 2, weight: 60, reps: 12, setType: "regular" },
        { setNumber: 3, weight: 60, reps: 12, setType: "regular" },
      ],
    },
    {
      name: "Lying Leg Curl (Machine)",
      sets: [
        { setNumber: 1, weight: 25, reps: 14, setType: "regular" },
        { setNumber: 2, weight: 25, reps: 12, setType: "regular" },
        { setNumber: 3, weight: 25, reps: 12, setType: "regular" },
      ],
    },
    {
      name: "Lateral Raise (Cable)",
      sets: [
        { setNumber: 1, weight: 5, reps: 14, setType: "regular" },
        { setNumber: 2, weight: 5, reps: 14, setType: "regular" },
      ],
    },
  ],
};

// Test cases for parser validation
export const INVALID_STRONG_EXPORTS = {
  EMPTY_TEXT: "",
  MISSING_DATE: `Workout Name
Bench Press
Set 1: 20 kg × 10`,

  INVALID_DATE_FORMAT: `Test Workout
Invalid Date Format
Bench Press
Set 1: 20 kg × 10`,

  NO_EXERCISES: `Test Workout
Monday 1 January 2024 at 10:00`,

  INVALID_SET_FORMAT: `Test Workout
Monday 1 January 2024 at 10:00
Bench Press
Invalid set format`,

  NEGATIVE_WEIGHT: `Test Workout
Monday 1 January 2024 at 10:00
Bench Press
Set 1: -20 kg × 10`,

  ZERO_REPS: `Test Workout
Monday 1 January 2024 at 10:00
Bench Press
Set 1: 20 kg × 0`,
};

// Exercise name variations for mapping tests
export const EXERCISE_NAME_VARIATIONS = {
  STRONG_NAMES: [
    "Bench Press (Dumbbell)",
    "Lat Pulldown (Machine)",
    "Leg Extension (Machine)",
    "Lateral Raise (Cable)",
    "Lying Leg Curl (Machine)",
    "Incline Dumbbell Press",
    "Overhead Press (Barbell)",
    "Romanian Deadlift",
    "Bulgarian Split Squat (Right Leg)",
    "Single-Arm Dumbbell Row (Left)",
  ],

  APP_EQUIVALENTS: [
    "Dumbbell Bench Press",
    "Machine Lat Pulldown",
    "Machine Leg Extension",
    "Cable Lateral Raise",
    "Machine Lying Leg Curl",
    "Incline Dumbbell Bench Press",
    "Barbell Overhead Press",
    "Romanian Deadlift",
    "Bulgarian Split Squat",
    "Single-Arm Dumbbell Row",
  ],
};

// Common Strong export patterns
export const STRONG_EXPORT_PATTERNS = {
  DATE_FORMATS: [
    "Wednesday 13 August 2025 at 07:32",
    "Monday 15 July 2024 at 18:45",
    "15 January 2024 07:00", // Edge case without day name and "at"
  ],

  SET_FORMATS: [
    "Set 1: 20 kg × 16",
    "Set 2: 22.5 kg × 10", // Decimal weight
    "W1: 20 kg × 5 [Warm-up]", // Warm-up with note
    "Set 1: 0 kg × 20", // Bodyweight exercise
    "Set 1: 30 kg × 30 [seconds]", // Time-based exercise
  ],

  EXERCISE_NAMES: [
    "Bench Press (Dumbbell)",
    "Simple Exercise Name",
    "Single-Arm Dumbbell Row (Left)",
    "Bulgarian Split Squat (Right Leg)",
    "Complex Exercise Name With (Multiple) (Parentheses)",
  ],
};
