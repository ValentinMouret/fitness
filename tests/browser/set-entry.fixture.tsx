import "@radix-ui/themes/styles.css";
import "~/fonts/fonts.css";
import "~/app.css";
import "~/routes/workouts/:id/active-workout.css";
import { Theme } from "@radix-ui/themes";
import { useState } from "react";
import { createRoot } from "react-dom/client";
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
}: Readonly<{
  name: string;
  loaded: boolean;
  isBodyweight: boolean;
}>) {
  const [sets, setSets] = useState([
    initialSet(1, loaded),
    initialSet(2, loaded),
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
            mode="log"
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
            onToggleComplete={() => {}}
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
      <SetEntryGroup name="Loaded set" loaded isBodyweight={false} />
      <SetEntryGroup name="Empty load" loaded={false} isBodyweight={false} />
      <SetEntryGroup name="Added bodyweight load" loaded isBodyweight />
    </Theme>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<SetEntryFixture />);
