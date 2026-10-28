import "@radix-ui/themes/styles.css";
import "~/fonts/fonts.css";
import "~/app.css";
import "~/routes/workouts/:id/active-workout.css";
import { PlusIcon } from "@radix-ui/react-icons";
import { Button, Theme } from "@radix-ui/themes";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { PageHeader } from "~/components/PageHeader";
import { ActiveSetRow } from "~/modules/fitness/presentation/components/ActiveSetRow/ActiveSetRow";
import type { ActiveSetViewModel } from "~/modules/fitness/presentation/view-models/active-workout.view-model";

const initialSet = (
  setNumber: number,
  loaded: boolean,
): ActiveSetViewModel => ({
  setNumber,
  label: String(setNumber),
  isWarmup: false,
  isCompleted: false,
  isNext: setNumber === 1,
  reps: { target: 12, display: "12", isTarget: true },
  weight: loaded
    ? { value: 20, display: "20", isTarget: false }
    : { display: "—", isTarget: false },
  effortLabel: "RIR",
  rirDisplay: "—",
});

function SetEntryGroup({
  name,
  loaded,
  isBodyweight,
  saved = false,
}: Readonly<{
  name: string;
  loaded: boolean;
  isBodyweight: boolean;
  saved?: boolean;
}>) {
  const [sets, setSets] = useState([
    { ...initialSet(1, loaded), isCompleted: saved },
    {
      ...initialSet(2, loaded),
      label: "W",
      isWarmup: true,
      isCompleted: saved,
    },
  ]);
  return (
    <section className="exercise-screen" aria-label={name}>
      <h2>{name}</h2>
      <div className="active-set-table__head" aria-hidden="true">
        <span>Set</span>
        <span>Reps</span>
        <span>Weight</span>
        <span />
        <span />
      </div>
      <ol className="exercise-screen__sets" aria-label="Sets">
        {sets.map((set) => (
          <ActiveSetRow
            key={set.setNumber}
            set={set}
            isBodyweight={isBodyweight}
            mode={saved ? "correct" : "log"}
            onChange={(field, text) =>
              setSets((old) =>
                old.map((item) =>
                  item.setNumber === set.setNumber
                    ? {
                        ...item,
                        [field]: {
                          ...item[field],
                          value: text === "" ? undefined : Number(text),
                          display: text || "—",
                          isTarget: false,
                        },
                      }
                    : item,
                ),
              )
            }
            onToggleComplete={() =>
              setSets((old) =>
                old.map((item) =>
                  item.setNumber === set.setNumber
                    ? { ...item, isCompleted: !item.isCompleted }
                    : item,
                ),
              )
            }
            onToggleWarmup={() => {}}
            onRemove={() => {}}
            onEditRir={() => {}}
          />
        ))}
      </ol>
      <button type="button">Blur input</button>
    </section>
  );
}

function SetEntryFixture() {
  return (
    <Theme accentColor="tomato" grayColor="sand" radius="medium">
      <section className="exercise-screen" aria-label="Dashboard header">
        <PageHeader
          title="Wed, Sep 30"
          primaryAction={{ label: "Invitations", to: "/account/invitations" }}
        />
      </section>
      <section className="exercise-screen" aria-label="Workouts header">
        <PageHeader
          title="Workouts"
          subtitle="Training log"
          customRight={
            <form>
              <Button type="submit" size="3" variant="soft">
                <PlusIcon /> Start Workout
              </Button>
            </form>
          }
        />
      </section>
      <SetEntryGroup name="Loaded set" loaded isBodyweight={false} />
      <SetEntryGroup name="Saved sets" loaded isBodyweight={false} saved />
      <SetEntryGroup name="Empty load" loaded={false} isBodyweight={false} />
      <SetEntryGroup name="Added bodyweight load" loaded isBodyweight />
      <section aria-label="Nested scrolling" className="layout-scroll-probe">
        <div className="layout-scroll-probe__inner">
          <div className="layout-scroll-probe__content">
            <button type="button">Nested scroll anchor</button>
          </div>
        </div>
      </section>
      <section aria-label="Intentional expansion">
        <details>
          <summary>Show fixture explanation</summary>
          <p>This disclosure intentionally moves the following control.</p>
        </details>
        <button type="button">Following disclosure</button>
      </section>
    </Theme>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <MemoryRouter>
    <SetEntryFixture />
  </MemoryRouter>,
);
