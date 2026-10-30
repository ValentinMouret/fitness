import {
  Button,
  Checkbox,
  Dialog,
  Text,
  TextField,
  Theme,
} from "@radix-ui/themes";
import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { EmptyState } from "~/components/EmptyState";
import { NumberInput } from "~/components/NumberInput";
import { PageHeader } from "~/components/PageHeader";
import { SectionHeader } from "~/components/SectionHeader";
import { AuthPage } from "~/modules/auth/presentation/components/AuthPage/AuthPage";
import { EmailField } from "~/modules/auth/presentation/components/EmailField/EmailField";
import { SharedMealView } from "~/modules/nutrition/presentation/components/SharedMealView/SharedMealView";
import type { Route } from "./+types/variant";
import { requireDesignPreview } from "./access.server";
import { sharedMeal } from "./fixtures";
import WorkoutFixture from "./WorkoutFixture";
import "./type.css";
const schema = z.object({
  variant: z.enum(["editorial", "sans"]),
  screen: z
    .enum([
      "workout",
      "dashboard",
      "nutrition",
      "habits",
      "editor",
      "public",
      "auth",
    ])
    .default("workout"),
});
export function loader({ params, request }: Route.LoaderArgs) {
  requireDesignPreview();
  const result = schema.safeParse({
    variant: params.variant,
    screen: new URL(request.url).searchParams.get("screen") ?? undefined,
  });
  if (!result.success) throw new Response("Not found", { status: 404 });
  return result.data;
}
export default function TypeVariant({ loaderData }: Route.ComponentProps) {
  const { variant, screen } = loaderData;
  const specimenId = useId();
  const [search, setSearch] = useSearchParams();
  const [done, setDone] = useState(false);
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const pageTitles = {
    workout: "Workout",
    dashboard: "Today",
    nutrition: "Nutrition",
    habits: "Good morning.",
    editor: "Edit meal template",
    public: "Public meal",
    auth: "Sign in",
  };
  return (
    <Theme className={`type-proposal type-${variant}`}>
      <aside className="type-review-controls">
        <Link to="/design/type">Comparison</Link>
        <label>
          Page
          <select
            value={screen}
            onChange={(e) =>
              setSearch((previous) => {
                const next = new URLSearchParams(previous);
                next.set("screen", e.target.value);
                return next;
              })
            }
          >
            {Object.entries(pageTitles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Link
          to={`/design/type/${variant === "editorial" ? "sans" : "editorial"}?${search}`}
        >
          Compare {variant === "editorial" ? "sans" : "editorial"}
        </Link>
      </aside>
      {screen === "workout" ? (
        <WorkoutFixture />
      ) : (
        <main className="type-page">
          <PageHeader
            title={pageTitles[screen]}
            subtitle={
              screen === "dashboard"
                ? "Monday, 5 October"
                : screen === "habits"
                  ? "Monday, 5 October · 2 of 3 complete"
                  : undefined
            }
          />
          {screen === "public" && <SharedMealView meal={sharedMeal} />}
          {screen === "auth" && (
            <AuthPage title="Sign in">
              <EmailField />
              <p className="type-support">
                Isolated component specimen. No email is sent.
              </p>
              <Button
                type="button"
                onClick={() =>
                  setMessage("Check your email · sample message only")
                }
              >
                Send sign-in link
              </Button>
            </AuthPage>
          )}
          {screen === "dashboard" && (
            <>
              <section className="type-stats" aria-label="Daily summary">
                {[
                  ["Calories", "1,420", "kcal"],
                  ["Protein", "98", "g"],
                  ["Weight", "78.5", "kg"],
                ].map(([label, value, unit]) => (
                  <div key={label}>
                    <span className="type-support">{label}</span>
                    <p className="type-stat">
                      {value} <small>{unit}</small>
                    </p>
                  </div>
                ))}
              </section>
              <SectionHeader title="Weight trend" />
              <label htmlFor={`${specimenId}-weight`} className="type-field">
                Weight · kg
                <NumberInput
                  id={`${specimenId}-weight`}
                  aria-label="Weight"
                  placeholder="kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <Button
                type="button"
                onClick={() =>
                  setMessage(
                    weight
                      ? "Weight logged · local example"
                      : "Enter a weight.",
                  )
                }
              >
                Log weight
              </Button>
              <SectionHeader title="Habits" />
              <label htmlFor={`${specimenId}-walk`} className="type-habit">
                <Checkbox
                  id={`${specimenId}-walk`}
                  checked={done}
                  onCheckedChange={(v) => setDone(v === true)}
                />
                <span>
                  Take a walk
                  <small className="type-support">
                    I make space to recharge.
                  </small>
                </span>
              </label>
              <SectionHeader title="Next workout" />
              <div className="type-list-row">
                <span>
                  Upper B — Week 2
                  <small className="type-support">
                    5 exercises · Ready to start
                  </small>
                </span>
                <Button
                  type="button"
                  variant="soft"
                  onClick={() =>
                    setSearch({ screen: "workout", saved: "warm" })
                  }
                >
                  Open
                </Button>
              </div>
            </>
          )}
          {screen === "nutrition" && (
            <>
              <SectionHeader title="Today" />
              <p className="type-stat">
                1,420 <small>kcal</small>
              </p>
              <p className="type-support">
                98 g protein · 145 g carbs · 47 g fat
              </p>
              <SectionHeader title="Meal templates" />
              {[
                "Greek yoghurt, oats and seasonal fruit",
                "Roasted vegetables, chickpeas and lemon tahini",
              ].map((title, i) => (
                <div className="type-list-row" key={title}>
                  <span className="type-item">
                    {title}
                    <small className="type-support">
                      {i ? "Dinner · Calories unknown" : "Breakfast · 420 kcal"}
                    </small>
                  </span>
                  <Button
                    type="button"
                    variant="soft"
                    onClick={() => {
                      setName(title);
                      setSearch({ screen: "editor" });
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))}
              <EmptyState
                icon="🍽"
                title="Nothing logged for lunch"
                description="Add a meal when you’re ready."
                actionLabel="Add meal"
                onAction={() => setSearch({ screen: "editor" })}
              />
            </>
          )}
          {screen === "habits" && (
            <>
              <SectionHeader title="Morning" />
              {[
                "Read the daily note",
                "Meditate",
                "Take a walk outside, even on a busy day",
              ].map((title, i) => (
                <label
                  htmlFor={`${specimenId}-habit-${i}`}
                  className="type-habit"
                  key={title}
                >
                  <Checkbox
                    id={`${specimenId}-habit-${i}`}
                    defaultChecked={i < 2}
                  />
                  <span className="type-item">
                    {title}
                    <small className="type-support">
                      {i === 1
                        ? "I am aware. · 08:00"
                        : "A small step every day."}
                    </small>
                    <small className="type-caption">3 day streak</small>
                  </span>
                </label>
              ))}
              <SectionHeader title="Later today" />
              <p className="type-body">
                A little consistency is enough. Do the minimum when today feels
                full.
              </p>
            </>
          )}
          {screen === "editor" && (
            <>
              <SectionHeader title="Details" />
              <label htmlFor={`${specimenId}-name`} className="type-field">
                Template name
                <TextField.Root
                  id={`${specimenId}-name`}
                  aria-label="Template name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Greek yoghurt and fruit"
                />
              </label>
              <label htmlFor={`${specimenId}-serving`} className="type-field">
                Serving weight · g
                <NumberInput
                  id={`${specimenId}-serving`}
                  aria-label="Serving weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="g"
                />
              </label>
              <p className="type-support">
                Keep the name useful when you’re choosing it again.
              </p>
              <div className="type-actions">
                <Button
                  type="button"
                  onClick={() =>
                    setMessage(
                      name
                        ? "Template saved · local example"
                        : "Enter a template name.",
                    )
                  }
                >
                  Save template
                </Button>
                <Button type="button" variant="soft" disabled>
                  Saving…
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(true)}
                >
                  Preview details
                </Button>
              </div>
              <SectionHeader title="Ingredients" />
              <EmptyState
                icon="🥣"
                title="No ingredients yet"
                description="Your ingredient list will appear here."
              />
            </>
          )}
          <output className="type-support">{message}</output>
        </main>
      )}
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog.Content className={`type-dialog type-${variant}`}>
          <Dialog.Title>Template details</Dialog.Title>
          <Dialog.Description>
            Fixture only. Review how a longer message wraps without changing its
            font size.
          </Dialog.Description>
          <Text as="p">{name || "Greek yoghurt, oats and seasonal fruit"}</Text>
          <Button type="button" onClick={() => setDialog(false)}>
            Close
          </Button>
        </Dialog.Content>
      </Dialog.Root>
    </Theme>
  );
}
