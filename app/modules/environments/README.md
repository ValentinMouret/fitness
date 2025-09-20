# Gym environments
We do not always have access to the same gym equipment.
Sometimes, you are traveling to a different city, or your workday gym might be different from your weekend gym.

For that, I want to be able to configure several gym profiles.

For each gym profile, I want to be able to say which equipment I have access to.

For example, in my weekday gym, I have access to all classic gym equipment: dumbbells, barbells, cables, and machines, but when I am at my father’s place, I only have access to dips, pull-ups, a lower cable and an upper cable.

## Open questions
### How do we model the available gym equipment?
- pull up bar?
- way to do dips?
- cable? (upper, lower, mobile?)
- dumbbells? weights? (like, something you can put on dumbbells or barbells?)
- barbells?
- dumbbells?

That might be a bit much for the data model and long to fill up.
Maybe, let’s have the data model on one side and a prompt to fill out the available gym equipment.
