# Workouts
I expect my workout agent to know:
- have extensive knowledge of the fundamentals of fitness and nutrition
- what my objectives are
- what my preferences are (cables, machines, exercises, ...)

It can analyse my workouts, provide feedback, and adjustments.

## Features
### Create a workout
A workout is a sequence of exercises with sets and weights that occurs on a given time.

Example:
Exercise 1: Push-ups
  |- 1: Target: 20; Done: 18
  |- Rest: 2:00
  |- 2: 20
  |- Rest: 2:00
  |- 3: 20
Exercise 2: Chest-press
  |- 1: 14x60kg
  |- Rest: 2:30
  |- 2: 12x60kg
  |- Rest: 2:00
  |- 3: 10x60kg

Data model:
```

```

### Workout parsing
I can dump my workout from the Strong app (random format), the AI parses it into a known format, and adds it to the database.

### Muscle stats
Different exercises will target different muscles, or the same muscles.
For example, incline chest press and chest press both target the chest muscles.

I want to have estimations of total volume and fatigue on each muscle group, regardless of the exercise, because my objective as a fitness enthusiast is to optimize my workouts for maximum results.

## Data model
* workout (upper body)
* reps, sets
* exercise (overhead press dumbbells)

```sql
-- Leaky abstraction but that should be ok at first.
-- Can go narrower and narrower, will leave with the fact that
-- we lose some information.
create type muscle_group
    as enum ('abs'
           , 'pecs'
           , 'shoulders'
           , 'triceps'),

-- An exercise is a way to stimulate a muscle group.
create table exercises (
  name                 text          primary key
, description          text          not null
);

create table exercise_muscle_groups (
  exercise     text         references exercises (name) not null,
, muscle_group muscle_group not null
, split        double       not null
, primary key (exercise, muscle_group)
);

insert into exercises
            (name
           , split)
     values ('Bench Press'
           , 100);

insert into exercise_muscle_groups
            (exercise
           , muscle_group
           , split)
     values ('Bench Press', 'pecs', 80)
          , ('Bench Press', 'shoulders', 10)
          , ('Bench Press', 'triceps', 10);

-- A workout is done at a point in time, contains a series of exercises
-- with reps and weights.
create table workouts (
  id    uuid        primary key generated always as (gen_random_uuid) stored
, name  text        not null
, start timestamptz not null default current_timestamp
, stop  timestamptz
);

insert into workouts
            (name
           , start)
     values ('Monday: Upper'
           , '2025-07-19T09:31:28.410194+02');

create table workout_sets (
  workout     uuid references workouts (id) not null
, exercise    text references exercises (name) not null
, set         int  not null (check set > 0),
, target_reps int  check (target_reps is null or target_reps > 0)
, done_reps   int  check (done_reps is null or done_reps > 0)
  -- assisted exercises could be modeled with negative weights
  -- not sure it would make sense though
, weight      int  check (weight is null or weight > 0)
, note        text,
, failure     boolean default false
);

insert into workout_sets
            (workout
           , exercise
           , set
           , reps)
     values ('81af5a91-e228-4a02-a940-4f4af2831f58'
           , '');
```

## Workout feature
I want to work on a feature where people can create workouts. 

On the `/workouts` (index) page, there should be a link to «start a new workout».

This creates an empty workout in «in progress» state (we can determine this because the workout has a start date but no stop date) and navigates to `workouts/$id`.

On the workout page (`workouts/$id`), people can see the workout.
For an ongoing workout, users can add exercises using an `Add exercise` button at the bottom.

  When an exercise is added, this creates a card on the page showing the sets for the exercise.
  For a given set, I can set the weight and reps, and there is a button to validate the set and a button to delete the set.
  At the bottom of the card for the exercise, there is a button to add a set.
  (The UI is inspired by the Strong app).
  
These changes are «synced» with the backend using `useFetcher.Form` forms that don’t cause navigation and with optimistic UI.

`workouts/create`
Page to create a workout
  Name
  Start (from current time)
  
  Add exercise
    Adds an exercise to the current workout
      Add a set
      Delete a set
    For a given set, set the target reps, number of reps (actually, this does not leave the page, it’s a simple form). But a «Complete» button uses a `fetcher.Form` to post updates.
  Complete workout
  Cancel workout

When I create the workout, I should be able to add/remove exercises.
By default, this should add three sets of this exercise.

- [ ] Templates

## Open questions
* What’s the right way to model something like:
  - bench press          (cable, dumbbells, bar)
  - inclined bench press (cable, dumbbells, bar)
  - declined bench press (cable, dumbbells, bar)
  We want to say that these are different:
  > Do 3 sets of 12 of dumbbell bench press at 36kg.
  But they are also kind of similar.
    You would not mix both in a workout.
      ✅ If they have two different IDs, they are two different «things»
    They contribute to roughly the same muscle groups (fatigue, progress)
      ✅ Each exercise can target muscle group independently, and **this** would be used to compute
          fatigue or progress.
            ❔How do we compare progress of chest flies, which target the pecs and bench press, which also
               target the pecs? Maybe they don’t target exactly the same muscles (upper, lower pecs) or
               we can say the movement is different?
         If I want to switch to barbell bench press, either for a lone workout or from here on out,
         it should be inferrable from my dumbbell level.
