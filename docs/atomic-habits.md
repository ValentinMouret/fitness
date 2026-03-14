# Atomic Habits — Theory & App Design

Reference: *Atomic Habits* by James Clear.

## The Habit Loop

Every habit has four stages: **Cue → Craving → Response → Reward**.

Most apps only address the Response (tracking the behavior) and the Reward (streak). Clear's insight is that the Cue and Craving are where habits are made or broken. An app that only tracks misses the first half entirely.

---

## Law 1 — Make it Obvious

### Implementation Intentions (P0)
Not "I will go to the gym" but "I will go to the gym at 7:00am at Fitness Park on Monday, Wednesday, Friday." Studies show specificity doubles follow-through — it acts as a pre-commitment. Capture for every habit: when, where, how often.

### Habit Stacking (P1)
"After I [existing habit], I will [new habit]." Chains a new behavior to an existing anchor. "After I weigh myself, I will take my supplements." The existing habit becomes the cue. Model explicit chains between habits.

### The Habits Scorecard (P2)
Before building habits, audit current ones and label each positive/negative/neutral. Builds awareness before automation. Relevant for onboarding: what are you already doing?

---

## Law 2 — Make it Attractive

### Temptation Bundling (P2)
Pair something you want with something you need. "I only listen to this podcast at the gym." The app can prompt you to define your temptation bundle when creating a habit, making the craving legitimate.

### Reframing with AI (P1)
"I get to go to the gym" vs. "I have to." The mental shift from obligation to opportunity. AI can help rewrite a habit's framing: given the habit name and identity phrase, generate motivating copy that makes the habit feel like a privilege, not a chore.

### The Anticipation Loop (P0)
Dopamine spikes in anticipation, not in reward. The craving is the engine. Implication: the morning check-in ritual itself, if designed well, becomes something you look forward to. The app's morning mode should feel like an event. This needs more design thought — what does anticipation feel like in a mobile UI?

---

## Law 3 — Make it Easy

### The Two-Minute Rule (P1)
Every habit should have a minimum viable version that takes under 2 minutes. Not "go to the gym" but "put on gym clothes." Showing up is the habit; the rest follows. Habits should have a minimum version that still counts as a valid completion.

### Reduce Friction (everywhere)
One-tap logging is not optional. Backdating must be effortless. The check-in flow should be sub-5-second. This applies everywhere in the UI.

### Decisive Moments (P0)
Small choices that disproportionately affect the trajectory of a day. Waking up and immediately opening the habits screen is a decisive moment. The morning session should be the front door of the app — surfaced first, fast, frictionless.

### Commitment Devices (P1)
Eliminate future choices by making them today. Planning gym days for the week on Sunday. Surface a weekly planning prompt.

---

## Law 4 — Make it Satisfying

### Never Miss Twice (P0)
Missing once is human. Missing twice is starting a new (bad) habit. Never punish a single miss. But gently surface when you've missed twice: "You haven't logged gym in 4 days — your next scheduled session is tomorrow." The goal is recovery, not shame.

### Visual Measures (P1)
Don't break the chain — but framed as density over time, not a fragile single chain. GitHub's heatmap model: visual consistency over a year. The goal is not to maintain the streak; it's not to break it. The heatmap shows compound effect even when behavioral change feels invisible.

### Immediate Rewards (P1)
The satisfaction of checking something off. Sound, animation, color change. Small but real. The UI should feel satisfying to interact with.

### The Paper Clip Strategy (P2)
A visual counter of total completions. "You've gone to the gym 127 times." This is an identity vote counter — evidence of who you're becoming.

---

## Identity Votes — The Core Philosophy

Every time you complete a habit, you cast a vote for the type of person you're becoming. One gym session doesn't transform you. 127 sessions, logged and visible, is evidence of identity.

The question shifts from "did I do the habit today?" to "am I becoming the person who does this?"

### Photo Logging as Identity Evidence
Photos compound habits and put consistency in perspective. A photo of your weight, your meal, yourself after the gym — these are timestamps of identity. They stack habits (weigh yourself → photograph the scale), create an archive of transformation, and make the abstract concrete. Over time, a photo timeline is more viscerally motivating than any number.

---

## The Plateau of Latent Potential

Habits feel ineffective for a long time before they compound. The "valley of disappointment" is where people quit. The heatmap addresses this directly — you can see compound effect visually. A year-view makes discipline visible even when the body/behavior change feels invisible.

---

## The Goldilocks Rule (P2)

Peak motivation occurs when challenge matches current skill — not too easy, not too hard. Habits consistently hit for months should evolve: add reps, time, raise the standard. Detect when a habit has been >80% consistent for 8 weeks and surface: "This habit is solid. Want to level it up?"

---

## Keystone Habits (P0)

Some habits have disproportionate effects on other habits. Exercise is the canonical keystone — it improves sleep, diet, mood, and productivity downstream. Flagging keystone habits surfaces which behaviors to protect at all costs when life gets hard.

---

## Feature Map

| Concept | Priority | Feature |
|---|---|---|
| Implementation intentions | P0 | Per-habit: scheduled days + time + location |
| The anticipation loop | P0 | Morning mode — the front door of the app |
| Decisive moments | P0 | Morning session surfaced first, fastest flow |
| Never miss twice | P0 | Gentle gap alerts, not daily punishment |
| Keystone habits | P0 | Manual flag: this habit unlocks others |
| Habit stacking | P1 | "After [habit]" link between habits |
| Reframing with AI | P1 | AI-generated motivating copy per habit |
| Two-minute rule | P1 | Minimum viable version per habit |
| Commitment devices | P1 | Weekly planning prompt |
| Visual measures | P1 | Year-view heatmap per habit + combined |
| Immediate rewards | P1 | Satisfying check-in animation/sound |
| Identity + photos | P1 | Photo log per habit entry |
| Habits scorecard | P2 | Onboarding audit of existing habits |
| Temptation bundling | P2 | "I pair this with..." field per habit |
| Paper clip strategy | P2 | Total completion counter |
| Goldilocks rule | P2 | 8-week consistency → level-up prompt |
