import { Button, Dialog, DropdownMenu, IconButton } from "@radix-ui/themes";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { NumberInput } from "~/components/NumberInput";
import "./workout-fixture.css";
interface Row {
  readonly id: string;
  readonly warmup: boolean;
  readonly weight: string;
  readonly reps: string;
  readonly saved: boolean;
  readonly editing: boolean;
  readonly effort: string | null;
}
const names = [
  "Seated row",
  "Dumbbell Incline Bench Press",
  "Incline press",
  "Lateral raise",
  "Cable curl",
];
const fresh = (): readonly (readonly Row[])[] =>
  names.map((_, g) =>
    [0, 1, 2].map((i) => ({
      id: `${g}-${i}`,
      warmup: i === 0,
      weight: i === 0 ? "16" : "20",
      reps: i === 2 ? "" : "12",
      saved: g === 1 ? i === 1 : i < 2,
      editing: false,
      effort: i === 1 ? "3" : null,
    })),
  );
export default function Variant() {
  const { variant } = useParams();
  const [search] = useSearchParams();
  const savedStyle = ["quiet", "plain", "warm"].includes(
    search.get("saved") ?? "",
  )
    ? search.get("saved")
    : "quiet";
  const [rows, setRows] = useState(fresh);
  const [focus, setFocus] = useState(1);
  const [overview, setOverview] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(true);
  const [presets, setPresets] = useState(false);
  const [finish, setFinish] = useState(false);
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<number | null>(null);
  const [original, setOriginal] = useState<Readonly<Record<string, Row>>>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [completedDetails, setCompletedDetails] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const current = rows[focus] ?? [];
  const unfinished = rows.flat().filter((r) => !r.saved).length;
  const patch = (index: number, next: Partial<Row>) =>
    setRows((old) =>
      old.map((group, g) =>
        g === focus
          ? group.map((r, i) => (i === index ? { ...r, ...next } : r))
          : group,
      ),
    );
  const save = (index: number) => {
    const r = current[index];
    if (
      !r ||
      r.weight.trim() === "" ||
      !Number.isFinite(Number(r.weight)) ||
      Number(r.weight) < 0 ||
      !Number.isInteger(Number(r.reps)) ||
      Number(r.reps) < 1
    ) {
      setStatus("Enter weight and whole reps.");
      return;
    }
    patch(index, { saved: true, editing: false });
    setStatus("Example set saved.");
    if (!r.saved) {
      setReport(index);
      setRemaining(90);
      setRunning(true);
      if (unfinished === 1) setFinish(true);
    }
  };
  return (
    <div data-saved-style={savedStyle} className="workout-design variant-3">
      <div className="design-chrome">
        <header className="design-header">
          <IconButton
            variant="ghost"
            aria-label="Back to overview"
            onClick={() => setOverview(true)}
          >
            <ArrowLeft size={18} />
          </IconButton>
          <div className="session-copy">
            <strong>Upper B — Week 2</strong>
            <div>
              <span className="live">Live</span>
              <span>Started 12 min ago</span>
            </div>
          </div>
          <span className="position">{focus + 1} / 5</span>
          <Button variant="soft" onClick={() => setOverview(!overview)}>
            {overview ? "Focus" : "Overview"}
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" aria-label="Workout options">
                <MoreVertical size={18} />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onSelect={() => setFinish(true)}>
                Finish workout
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  setRows(fresh());
                  setFinished(false);
                  setStatus("Example reset.");
                }}
              >
                Reset example
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </header>
        <div className="session-progress" />
        <section className="design-rest">
          <span>REST</span>
          <button
            type="button"
            className="rest-time"
            aria-expanded={presets}
            onClick={() => setPresets(!presets)}
            aria-label="Change rest duration"
          >
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </button>
          <Button
            onClick={() => {
              if (running) setRunning(false);
              else {
                setRemaining(90);
                setRunning(true);
              }
            }}
          >
            {running ? "Skip" : "Start"}
          </Button>
        </section>
        {presets && (
          <div className="rest-presets">
            {[60, 90, 120, 180].map((n) => (
              <Button
                key={n}
                variant="soft"
                onClick={() => {
                  setRemaining(n);
                  setRunning(true);
                  setPresets(false);
                }}
              >
                {n / 60} min
              </Button>
            ))}
          </div>
        )}
      </div>
      <main className="design-content">
        {overview ? (
          <>
            <h1>Workout overview</h1>
            <p className="saved-count">
              {rows.flat().filter((r) => r.saved).length} of{" "}
              {rows.flat().length} sets saved
            </p>
            <div className="overview-rows">
              {names.map((name, i) => (
                <button
                  type="button"
                  className={
                    rows[i]?.every((r) => r.saved) ? "exercise-done" : ""
                  }
                  key={name}
                  onClick={() => {
                    setFocus(i);
                    setOverview(false);
                    setReport(null);
                  }}
                >
                  <strong>{name}</strong>
                  <span>
                    {rows[i]?.filter((r) => r.saved).length}/{rows[i]?.length}{" "}
                    saved
                  </span>
                </button>
              ))}
            </div>
            <Button onClick={() => setFinish(true)}>Finish workout</Button>
          </>
        ) : (
          <>
            <div className="exercise-heading">
              <h1>{names[focus]}</h1>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <IconButton variant="ghost" aria-label="Exercise options">
                    <MoreVertical size={18} />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    onSelect={() =>
                      setStatus("History destination · example only.")
                    }
                  >
                    View history
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() =>
                      setStatus("Cue editor destination · example only.")
                    }
                  >
                    Edit cues
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() =>
                      setReport(current.findIndex((r) => r.saved))
                    }
                  >
                    Report effort
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
            <p className="equipment">
              {focus === 1 || focus === 2 || focus === 3
                ? "Dumbbells"
                : "Cable"}
            </p>
            <p className="saved-count">
              {current.filter((r) => r.saved).length} of {current.length} sets
              saved
            </p>
            <aside className="design-cue">
              <Brain size={18} />
              <p>
                Keep shoulder blades settled against the bench. Lower with
                control, then press up without locking the elbows.
              </p>
            </aside>
            <div className="set-table">
              <div className="set-labels">
                <span>#</span>
                <span>Weight · kg</span>
                <span>Reps</span>
                <span />
                <span />
              </div>
              {current.map((r, i) => (
                <div
                  key={r.id}
                  className={`set-row ${r.saved ? "is-saved" : ""} ${r.warmup ? "is-warmup" : ""}`}
                >
                  <div className="set-values">
                    <button
                      type="button"
                      className="set-identity"
                      aria-label={`Set ${i + 1} details${r.warmup ? ", warmup" : ""}${r.saved && !r.editing ? ", saved" : ""}`}
                      onClick={() => setDetails(i)}
                    >
                      <span className={r.warmup ? "warmup-badge" : undefined}>
                        {r.warmup ? "W" : i + 1}
                      </span>
                    </button>
                    {!r.saved || r.editing ? (
                      <>
                        <NumberInput
                          placeholder="kg"
                          aria-label={`Set ${i + 1} weight`}
                          value={r.weight}
                          onChange={(e) => patch(i, { weight: e.target.value })}
                        />
                        <NumberInput
                          placeholder="reps"
                          aria-label={`Set ${i + 1} reps`}
                          allowDecimals={false}
                          value={r.reps}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              save(i);
                            }
                          }}
                          onChange={(e) => patch(i, { reps: e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <strong>{r.weight}</strong>
                        <strong className="saved-reps">
                          {r.effort ? (
                            <button
                              type="button"
                              className="inline-rir"
                              aria-label={`Edit set ${i + 1} effort`}
                              onClick={() => setDetails(i)}
                            >
                              <span>{r.reps}</span>
                              <small>RIR {r.effort}</small>
                            </button>
                          ) : (
                            r.reps
                          )}
                        </strong>
                      </>
                    )}
                    <IconButton
                      variant={r.saved ? "ghost" : "soft"}
                      aria-label={
                        r.saved && !r.editing
                          ? `Edit set ${i + 1}`
                          : `Save set ${i + 1}`
                      }
                      onClick={() =>
                        r.saved && !r.editing
                          ? (setOriginal((old) => ({ ...old, [r.id]: r })),
                            patch(i, { editing: true }))
                          : save(i)
                      }
                    >
                      {r.saved && !r.editing ? (
                        <Pencil size={17} />
                      ) : (
                        <Check size={20} />
                      )}
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      color="red"
                      aria-label={`Delete set ${i + 1}`}
                      onClick={() => setDeleting(i)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                  {r.editing && (
                    <Button variant="ghost" onClick={() => setDetails(i)}>
                      Edit stored RIR
                    </Button>
                  )}
                  {r.editing && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (original[r.id]) patch(i, original[r.id]);
                        setOriginal((old) =>
                          Object.fromEntries(
                            Object.entries(old).filter(([id]) => id !== r.id),
                          ),
                        );
                      }}
                    >
                      Cancel correction
                    </Button>
                  )}
                  {report === i && r.saved && !r.editing && (
                    <div className="effort">
                      <span>Good reps left? · optional</span>
                      <div>
                        {["0", "1", "2", "3", "4+", "Unsure"].map((v) => (
                          <Button
                            key={v}
                            variant="soft"
                            onClick={() => {
                              patch(i, { effort: v });
                              setReport(null);
                            }}
                          >
                            {v}
                          </Button>
                        ))}
                        <Button variant="ghost" onClick={() => setReport(null)}>
                          Skip
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              className="add-set"
              variant="ghost"
              onClick={() =>
                setRows((old) =>
                  old.map((group, g) =>
                    g === focus
                      ? [
                          ...group,
                          {
                            id: String(Date.now()),
                            warmup: false,
                            weight: "61",
                            reps: "10",
                            saved: false,
                            editing: false,
                            effort: null,
                          },
                        ]
                      : group,
                  ),
                )
              }
            >
              <Plus size={16} />
              Add Set
            </Button>
            <nav className="exercise-navigation">
              <Button
                variant="ghost"
                disabled={focus === 0}
                onClick={() => {
                  setFocus(focus - 1);
                  setReport(null);
                }}
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={focus === 4}
                onClick={() => {
                  setFocus(focus + 1);
                  setReport(null);
                }}
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </nav>
          </>
        )}
        <output className="prototype-status">
          {finished ? "Workout completed · example only." : status}
        </output>
        <Link className="compare-link" to="/design/type">
          Compare variants
        </Link>
      </main>
      <nav className="design-bottom" aria-label="App navigation">
        {[
          ["Dashboard", LayoutDashboard],
          ["Habits", ListChecks],
          ["Nutrition", Utensils],
          ["Workouts", Dumbbell],
          ["Meas.", Ruler],
        ].map(([label, Icon]) =>
          typeof label === "string" && typeof Icon !== "string" ? (
            <button
              type="button"
              key={label}
              className={label === "Workouts" ? "selected" : ""}
              onClick={() => setStatus(`${label} destination · example only.`)}
            >
              <Icon size={20} />
              {label}
            </button>
          ) : null,
        )}
      </nav>
      <div className="fixture-tools">
        {variant === "3" && (
          <section className="saved-style-options">
            <p>Completed rows · same borderless fields and inline RIR</p>
            <Link to="?saved=quiet">Quiet surface · recommended</Link>
            <Link to="?saved=plain">Plain background</Link>
            <Link to="?saved=warm">Warm surface</Link>
          </section>
        )}
        <Button variant="soft" onClick={() => setCompletedDetails(true)}>
          Completed workout details
        </Button>
        <p>
          Local fixture. Tap a set number for details. Stored RIR stays
          editable.
        </p>
      </div>
      <Dialog.Root
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <Dialog.Content className={`type-dialog type-${variant}`}>
          <Dialog.Title>
            Set {details === null ? "" : details + 1} details
          </Dialog.Title>
          <Dialog.Description>
            Stored effort is optional; changing it does not change saved reps or
            weight.
          </Dialog.Description>
          {details !== null && (
            <>
              <p>
                {current[details]?.warmup ? "Warmup" : "Working set"} ·{" "}
                {current[details]?.weight} kg · {current[details]?.reps || "—"}{" "}
                reps
              </p>
              <p>Stored RIR: {current[details]?.effort ?? "Not reported"}</p>
              <div className="rir-editor">
                {["0", "1", "2", "3", "4+", "Unsure"].map((v) => (
                  <Button
                    key={v}
                    variant="soft"
                    onClick={() => {
                      patch(details, { effort: v });
                      setStatus("Stored effort updated.");
                    }}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </>
          )}
          <Button variant="soft" onClick={() => setDetails(null)}>
            Close details
          </Button>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={completedDetails} onOpenChange={setCompletedDetails}>
        <Dialog.Content className={`type-dialog type-${variant}`}>
          <Dialog.Title>Completed workout details</Dialog.Title>
          <Dialog.Description>
            Fixture of the required details path. Stored RIR is visible and
            editable here.
          </Dialog.Description>
          {rows.map((group, g) => (
            <section className="completed-exercise" key={names[g]}>
              <h3>{names[g]}</h3>
              {group
                .filter((r) => r.saved)
                .map((r) => (
                  <div key={r.id}>
                    <p>
                      {r.warmup ? "Warmup" : "Set " + (group.indexOf(r) + 1)} ·{" "}
                      {r.weight} kg × {r.reps} · RIR{" "}
                      {r.effort ?? "Not reported"}
                    </p>
                    <label>
                      RIR
                      <select
                        aria-label={`${names[g]} set ${group.indexOf(r) + 1} completed RIR`}
                        value={r.effort ?? ""}
                        onChange={(e) =>
                          setRows((old) =>
                            old.map((sets, x) =>
                              x === g
                                ? sets.map((s) =>
                                    s.id === r.id
                                      ? { ...s, effort: e.target.value || null }
                                      : s,
                                  )
                                : sets,
                            ),
                          )
                        }
                      >
                        {["", "0", "1", "2", "3", "4+", "Unsure"].map((v) => (
                          <option key={v} value={v}>
                            {v || "Not reported"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
            </section>
          ))}
          <Button variant="soft" onClick={() => setCompletedDetails(false)}>
            Close completed details
          </Button>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <Dialog.Content className={`type-dialog type-${variant}`}>
          <Dialog.Title>Delete set?</Dialog.Title>
          <Dialog.Description>
            Remove this example row? Saved example values are removed.
          </Dialog.Description>
          <div className="finish-actions">
            <Button variant="soft" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                setRows((old) =>
                  old.map((group, g) =>
                    g === focus
                      ? group.filter((_, i) => i !== deleting)
                      : group,
                  ),
                );
                setReport(null);
                setDeleting(null);
              }}
            >
              Delete set
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={finish} onOpenChange={setFinish}>
        <Dialog.Content className={`type-dialog type-${variant}`}>
          <Dialog.Title>Finish workout?</Dialog.Title>
          <Dialog.Description>
            {unfinished
              ? `${unfinished} sets are unfinished. They will remain unlogged.`
              : "All sets saved. Ready to finish?"}
          </Dialog.Description>
          <div className="finish-actions">
            <Button variant="soft" onClick={() => setFinish(false)}>
              Keep training
            </Button>
            <Button
              onClick={() => {
                setFinished(true);
                setFinish(false);
                setRunning(false);
              }}
            >
              Finish workout
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
