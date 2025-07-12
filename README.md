# Fitness
## Data model
This is soloware, made only for me. As such, there is no need to have a `user_id` in the data model.

Challenges for the data model:
- **link between items**: if I set the habit of logging my weight, this should add a measurement for my weight, that can also be used in calculation (e.g. maintenance).
- **optionality**: sometimes, I won't be able to have *all* the data I need. For example, lacunar data for my weight
- **integrations**: some data will come from extracts (Whoop, Strong, MyFitnessPal?)
- **backfill**: for example, habits. I can log them on the day, but I also want to retro-actively log habits.
- **historisation**: I have a weight at some point in time, but it can change. I want to keep the history and easily find the latest value.

Would it make sense to pipe the activity log of the application to an LLM that can activate levers throughout the app to keep the data consistent? For instance, it sees my habit to log my weight, then it can ask me what my weight was, and log it in the DB?

  -> let’s keep thinngs simple for now
