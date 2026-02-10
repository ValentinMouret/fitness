import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Dialog, Tabs, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExerciseHistoryPage } from "~/modules/fitness/domain/workout";
import {
  createExerciseHistoryChartData,
  createExerciseHistoryViewModels,
  type ExerciseHistoryChartPoint,
  type ExerciseHistorySessionViewModel,
} from "../../view-models/exercise-history.view-model";
import "./ExerciseHistoryModal.css";

interface ExerciseHistoryModalProps {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type ChartMetric = "totalVolume" | "maxWeight" | "estimatedOneRepMax";

const CHART_CONFIGS: ReadonlyArray<{
  key: ChartMetric;
  label: string;
  unit: string;
  color: string;
}> = [
  {
    key: "totalVolume",
    label: "Volume",
    unit: "kg",
    color: "var(--brand-coral, #e15a46)",
  },
  {
    key: "maxWeight",
    label: "Max Weight",
    unit: "kg",
    color: "var(--blue-9, #3b82f6)",
  },
  {
    key: "estimatedOneRepMax",
    label: "Est. 1RM",
    unit: "kg",
    color: "var(--amber-9, #f59e0b)",
  },
];

export function ExerciseHistoryModal({
  exerciseId,
  exerciseName,
  open,
  onOpenChange,
}: ExerciseHistoryModalProps) {
  const [sessions, setSessions] = useState<
    ReadonlyArray<ExerciseHistorySessionViewModel>
  >([]);
  const [chartData, setChartData] = useState<
    ReadonlyArray<ExerciseHistoryChartPoint>
  >([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allSessionsRef = useRef<ExerciseHistoryPage["sessions"]>([]);

  const fetchHistory = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ exerciseId, limit: "10" });
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(
          `/api/exercises/history?${params.toString()}`,
        );
        if (!response.ok) return;

        const data: ExerciseHistoryPage = await response.json();

        // Accumulate raw sessions for chart data
        const rawSessions = [...allSessionsRef.current, ...data.sessions];
        allSessionsRef.current = rawSessions;

        const newViewModels = createExerciseHistoryViewModels(data);
        setSessions((prev) =>
          cursor ? [...prev, ...newViewModels] : newViewModels,
        );
        setChartData(createExerciseHistoryChartData(rawSessions));
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    },
    [exerciseId],
  );

  useEffect(() => {
    if (open) {
      setSessions([]);
      setChartData([]);
      setNextCursor(undefined);
      setHasMore(false);
      setIsInitialLoad(true);
      allSessionsRef.current = [];
      fetchHistory();
    }
  }, [open, fetchHistory]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isLoading || !hasMore || !nextCursor) return;

    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      fetchHistory(nextCursor);
    }
  }, [isLoading, hasMore, nextCursor, fetchHistory]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="exercise-history-modal">
        <Dialog.Title
          size="5"
          weight="bold"
          className="exercise-history-modal__title"
        >
          {exerciseName}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray">
          History & Progression
        </Dialog.Description>

        <Tabs.Root
          defaultValue="history"
          className="exercise-history-modal__tabs"
        >
          <Tabs.List>
            <Tabs.Trigger value="history">History</Tabs.Trigger>
            <Tabs.Trigger value="charts">Charts</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="history">
            <div
              ref={scrollRef}
              className="exercise-history-modal__scroll"
              onScroll={handleScroll}
            >
              {isInitialLoad ? (
                <div className="exercise-history-modal__loading">
                  <Text size="2" color="gray">
                    Loading history...
                  </Text>
                </div>
              ) : sessions.length === 0 ? (
                <div className="exercise-history-modal__empty">
                  <Text size="2" color="gray">
                    No previous data for this exercise.
                  </Text>
                </div>
              ) : (
                <>
                  {sessions.map((session) => (
                    <HistorySessionCard
                      key={session.workoutId}
                      session={session}
                    />
                  ))}
                  {isLoading && (
                    <div className="exercise-history-modal__loading-more">
                      <Text size="1" color="gray">
                        Loading more...
                      </Text>
                    </div>
                  )}
                  {!hasMore && sessions.length > 0 && (
                    <div className="exercise-history-modal__end">
                      <Text size="1" color="gray">
                        No more sessions
                      </Text>
                    </div>
                  )}
                </>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="charts">
            <div className="exercise-history-modal__scroll">
              {chartData.length < 2 ? (
                <div className="exercise-history-modal__empty">
                  <Text size="2" color="gray">
                    Need at least 2 sessions to show progression charts.
                  </Text>
                </div>
              ) : (
                <div className="exercise-history-modal__charts">
                  {CHART_CONFIGS.map((config) => (
                    <ProgressionChart
                      key={config.key}
                      data={chartData}
                      metric={config.key}
                      label={config.label}
                      unit={config.unit}
                      color={config.color}
                    />
                  ))}
                </div>
              )}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function HistorySessionCard({
  session,
}: {
  readonly session: ExerciseHistorySessionViewModel;
}) {
  return (
    <div className="history-session-card">
      <div className="history-session-card__header">
        <div>
          <Text size="2" weight="medium">
            {session.workoutName}
          </Text>
          <Text size="1" color="gray" className="history-session-card__date">
            {session.dateDisplay}
          </Text>
        </div>
        <Text size="1" color="gray" className="history-session-card__volume">
          {session.totalVolumeDisplay}
        </Text>
      </div>

      <div className="history-session-card__table">
        <div className="history-session-card__row history-session-card__row--header">
          <span className="history-session-card__cell history-session-card__cell--num">
            #
          </span>
          <span className="history-session-card__cell history-session-card__cell--right">
            Weight
          </span>
          <span className="history-session-card__cell history-session-card__cell--right">
            Reps
          </span>
          <span className="history-session-card__cell history-session-card__cell--right">
            Vol
          </span>
        </div>
        {session.sets.map((set) => (
          <div
            key={set.set}
            className={`history-session-card__row ${set.isWarmup ? "history-session-card__row--warmup" : ""}`}
          >
            <span className="history-session-card__cell history-session-card__cell--num">
              {set.set}
            </span>
            <span className="history-session-card__cell history-session-card__cell--right">
              {set.weight}
            </span>
            <span className="history-session-card__cell history-session-card__cell--right">
              {set.reps}
            </span>
            <span className="history-session-card__cell history-session-card__cell--right">
              {set.volume}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressionChart({
  data,
  metric,
  label,
  unit,
  color,
}: {
  readonly data: ReadonlyArray<ExerciseHistoryChartPoint>;
  readonly metric: ChartMetric;
  readonly label: string;
  readonly unit: string;
  readonly color: string;
}) {
  const hasData = data.some((d) => d[metric] > 0);
  if (!hasData) return null;

  return (
    <div className="progression-chart">
      <Text size="2" weight="medium" className="progression-chart__label">
        {label}
      </Text>
      <div className="progression-chart__container">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={[...data]}
            margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--gray-4, #e5e5e5)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="var(--brand-text-secondary, #79756d)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--brand-text-secondary, #79756d)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value) => [`${value} ${unit}`, label]}
              contentStyle={{
                background: "var(--brand-surface, #f3f1ed)",
                border: "1px solid var(--gray-4)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "white" }}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
