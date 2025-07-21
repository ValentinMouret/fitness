# Workouts
I expect my workout agent to know:
- have extensive knowledge of the fundamentals of fitness and nutrition
- what my objectives are
- what my preferences are (cables, machines, exercises, ...)

It can analyse my workouts, provide feedback, and adjustments.

## Features
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
  workout  uuid references workouts (id) not null
, exercise text references exercises (name) not null
, set      int  not null check (set > 0)
, reps     int check (set > 0)
  -- assisted exercises could be modeled with negative weights
  -- not sure it would make sense though
, weight   int  check (weight is null or weight > 0)
, note     text,
, failure  boolean default false
);

insert into workout_sets
            (workout
           , exercise
           , set
           , reps)
     values ('81af5a91-e228-4a02-a940-4f4af2831f58'
           , '');
```

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
