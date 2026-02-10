import { useState } from "react";
import type { MuscleGroup } from "~/modules/fitness/domain/workout";
import type { MuscleRecoveryViewModel } from "../../view-models/muscle-recovery.view-model";

interface BodyMapSvgProps {
  readonly viewModels: ReadonlyArray<MuscleRecoveryViewModel>;
}

/**
 * Mapping of muscle groups to their SVG path definitions.
 * Front view shows: pecs, abs, quads, biceps, delts, forearm
 * Back view shows: lats, trapezes, lower_back, glutes, armstrings, triceps, calves
 *
 * Each path has a stable `side` label used as part of the React key.
 */

interface MusclePath {
  readonly side: string;
  readonly d: string;
}

interface MusclePathGroup {
  readonly muscleGroup: MuscleGroup;
  readonly paths: ReadonlyArray<MusclePath>;
}

/* ── Front view paths (viewBox origin at x=0) ─────────────────────── */
const FRONT_PATHS: ReadonlyArray<MusclePathGroup> = [
  {
    muscleGroup: "delts",
    paths: [
      {
        side: "left",
        d: "M 58,52 Q 50,50 46,56 Q 43,62 44,70 L 54,68 Q 60,60 58,52 Z",
      },
      {
        side: "right",
        d: "M 102,52 Q 110,50 114,56 Q 117,62 116,70 L 106,68 Q 100,60 102,52 Z",
      },
    ],
  },
  {
    muscleGroup: "pecs",
    paths: [
      {
        side: "left",
        d: "M 60,58 Q 58,62 58,70 L 58,78 Q 72,82 80,78 L 80,62 Q 72,56 60,58 Z",
      },
      {
        side: "right",
        d: "M 100,58 Q 102,62 102,70 L 102,78 Q 88,82 80,78 L 80,62 Q 88,56 100,58 Z",
      },
    ],
  },
  {
    muscleGroup: "biceps",
    paths: [
      {
        side: "left",
        d: "M 44,72 Q 40,78 38,90 Q 37,98 40,104 L 48,102 Q 52,94 54,84 Q 55,76 54,70 Z",
      },
      {
        side: "right",
        d: "M 116,72 Q 120,78 122,90 Q 123,98 120,104 L 112,102 Q 108,94 106,84 Q 105,76 106,70 Z",
      },
    ],
  },
  {
    muscleGroup: "abs",
    paths: [
      {
        side: "center",
        d: "M 68,80 L 68,120 Q 72,124 80,124 Q 88,124 92,120 L 92,80 Q 88,84 80,84 Q 72,84 68,80 Z",
      },
    ],
  },
  {
    muscleGroup: "forearm",
    paths: [
      {
        side: "left",
        d: "M 38,106 Q 36,116 35,126 Q 34,134 36,140 L 44,138 Q 46,130 47,120 Q 48,112 46,104 Z",
      },
      {
        side: "right",
        d: "M 122,106 Q 124,116 125,126 Q 126,134 124,140 L 116,138 Q 114,130 113,120 Q 112,112 114,104 Z",
      },
    ],
  },
  {
    muscleGroup: "quads",
    paths: [
      {
        side: "left",
        d: "M 66,126 Q 62,140 60,160 Q 58,176 60,190 L 78,190 Q 80,176 80,160 Q 80,140 80,126 Z",
      },
      {
        side: "right",
        d: "M 94,126 Q 98,140 100,160 Q 102,176 100,190 L 82,190 Q 80,176 80,160 Q 80,140 80,126 Z",
      },
    ],
  },
];

/* ── Back view paths (viewBox origin offset by 160px) ─────────────── */
const BACK_PATHS: ReadonlyArray<MusclePathGroup> = [
  {
    muscleGroup: "trapezes",
    paths: [
      {
        side: "left",
        d: "M 230,42 Q 222,44 218,52 L 218,64 Q 228,58 240,58 L 240,46 Q 236,42 230,42 Z",
      },
      {
        side: "right",
        d: "M 250,42 Q 258,44 262,52 L 262,64 Q 252,58 240,58 L 240,46 Q 244,42 250,42 Z",
      },
    ],
  },
  {
    muscleGroup: "delts",
    paths: [
      {
        side: "left",
        d: "M 214,52 Q 207,54 204,60 Q 202,66 204,72 L 214,70 Q 218,62 218,54 Z",
      },
      {
        side: "right",
        d: "M 266,52 Q 273,54 276,60 Q 278,66 276,72 L 266,70 Q 262,62 262,54 Z",
      },
    ],
  },
  {
    muscleGroup: "lats",
    paths: [
      {
        side: "left",
        d: "M 218,66 Q 214,72 212,82 Q 210,92 214,100 L 230,96 Q 234,88 234,78 L 234,66 Q 226,62 218,66 Z",
      },
      {
        side: "right",
        d: "M 262,66 Q 266,72 268,82 Q 270,92 266,100 L 250,96 Q 246,88 246,78 L 246,66 Q 254,62 262,66 Z",
      },
    ],
  },
  {
    muscleGroup: "triceps",
    paths: [
      {
        side: "left",
        d: "M 204,74 Q 200,82 198,92 Q 196,100 198,108 L 208,106 Q 212,98 214,88 Q 214,80 212,72 Z",
      },
      {
        side: "right",
        d: "M 276,74 Q 280,82 282,92 Q 284,100 282,108 L 272,106 Q 268,98 266,88 Q 266,80 268,72 Z",
      },
    ],
  },
  {
    muscleGroup: "lower_back",
    paths: [
      {
        side: "center",
        d: "M 230,98 Q 226,104 224,112 Q 222,120 226,126 L 254,126 Q 258,120 256,112 Q 254,104 250,98 Z",
      },
    ],
  },
  {
    muscleGroup: "glutes",
    paths: [
      {
        side: "left",
        d: "M 224,128 Q 220,134 218,142 Q 218,150 224,154 L 240,154 L 240,128 Z",
      },
      {
        side: "right",
        d: "M 256,128 Q 260,134 262,142 Q 262,150 256,154 L 240,154 L 240,128 Z",
      },
    ],
  },
  {
    muscleGroup: "armstrings",
    paths: [
      {
        side: "left",
        d: "M 218,156 Q 216,168 216,182 Q 216,194 220,202 L 238,202 Q 240,194 240,182 Q 240,168 240,156 Z",
      },
      {
        side: "right",
        d: "M 262,156 Q 264,168 264,182 Q 264,194 260,202 L 242,202 Q 240,194 240,182 Q 240,168 240,156 Z",
      },
    ],
  },
  {
    muscleGroup: "calves",
    paths: [
      {
        side: "left",
        d: "M 220,204 Q 218,214 216,226 Q 215,236 218,244 L 236,244 Q 238,236 238,226 Q 238,214 236,204 Z",
      },
      {
        side: "right",
        d: "M 260,204 Q 262,214 264,226 Q 265,236 262,244 L 244,244 Q 242,236 242,226 Q 242,214 244,204 Z",
      },
    ],
  },
];

const BODY_OUTLINE_FRONT =
  "M 80,10 Q 68,10 64,20 Q 60,30 60,40 Q 58,48 52,50 Q 44,52 40,60 Q 36,68 36,78 Q 34,90 34,104 Q 32,118 32,132 Q 30,140 32,148 L 50,146 Q 54,136 56,124 Q 58,116 56,106 L 56,96 Q 56,86 58,78 L 60,126 Q 58,146 56,164 Q 54,182 56,196 Q 58,210 62,220 L 66,250 L 78,250 L 80,220 L 82,250 L 94,250 L 98,220 Q 102,210 104,196 Q 106,182 104,164 Q 102,146 100,126 L 102,78 Q 104,86 104,96 L 104,106 Q 102,116 104,124 Q 106,136 110,146 L 128,148 Q 130,140 128,132 Q 128,118 126,104 Q 126,90 124,78 Q 124,68 120,60 Q 116,52 108,50 Q 102,48 100,40 Q 100,30 96,20 Q 92,10 80,10 Z";

const BODY_OUTLINE_BACK =
  "M 240,10 Q 228,10 224,20 Q 220,30 220,40 Q 218,48 212,50 Q 204,52 200,60 Q 196,68 196,78 Q 194,90 194,104 Q 192,118 192,132 Q 190,140 192,148 L 210,146 Q 214,136 216,124 Q 218,116 216,106 L 216,96 Q 216,86 218,78 L 216,126 Q 214,146 212,164 Q 210,182 212,196 Q 214,210 218,220 L 214,244 Q 212,252 216,258 L 236,258 L 240,230 L 244,258 L 264,258 Q 268,252 266,244 L 262,220 Q 266,210 268,196 Q 270,182 268,164 Q 266,146 264,126 L 262,78 Q 264,86 264,96 L 264,106 Q 262,116 264,124 Q 266,136 270,146 L 288,148 Q 290,140 288,132 Q 288,118 286,104 Q 286,90 284,78 Q 284,68 280,60 Q 276,52 268,50 Q 262,48 260,40 Q 260,30 256,20 Q 252,10 240,10 Z";

function getColorForMuscle(
  muscleGroup: MuscleGroup,
  viewModels: ReadonlyArray<MuscleRecoveryViewModel>,
): string {
  const vm = viewModels.find((v) => v.muscleGroup === muscleGroup);
  return vm?.color ?? "#30a46c";
}

function renderMusclePaths(
  view: string,
  groups: ReadonlyArray<MusclePathGroup>,
  viewModels: ReadonlyArray<MuscleRecoveryViewModel>,
  hoveredMuscle: MuscleGroup | null,
  setHoveredMuscle: (m: MuscleGroup | null) => void,
) {
  return groups.flatMap(({ muscleGroup, paths }) =>
    paths.map(({ side, d }) => (
      // biome-ignore lint/a11y/noStaticElementInteractions: SVG path elements cannot be semantic buttons; hover is for tooltip only
      <path
        key={`${view}-${muscleGroup}-${side}`}
        d={d}
        className={`muscle-path ${hoveredMuscle === muscleGroup ? "muscle-path--hovered" : ""}`}
        style={{ fill: getColorForMuscle(muscleGroup, viewModels) }}
        onMouseEnter={() => setHoveredMuscle(muscleGroup)}
        onMouseLeave={() => setHoveredMuscle(null)}
      />
    )),
  );
}

export function BodyMapSvg({ viewModels }: BodyMapSvgProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleGroup | null>(null);
  const hoveredVm = hoveredMuscle
    ? viewModels.find((v) => v.muscleGroup === hoveredMuscle)
    : null;

  return (
    <div className="body-map-container">
      <div className="body-map-views">
        <div className="body-map-view">
          <span className="body-map-label">Front</span>
          <svg
            viewBox="24 0 120 260"
            className="body-map-svg"
            role="img"
            aria-label="Front body muscle recovery map"
          >
            <path d={BODY_OUTLINE_FRONT} className="body-outline" />
            {renderMusclePaths(
              "front",
              FRONT_PATHS,
              viewModels,
              hoveredMuscle,
              setHoveredMuscle,
            )}
          </svg>
        </div>

        <div className="body-map-view">
          <span className="body-map-label">Back</span>
          <svg
            viewBox="184 0 120 268"
            className="body-map-svg"
            role="img"
            aria-label="Back body muscle recovery map"
          >
            <path d={BODY_OUTLINE_BACK} className="body-outline" />
            {renderMusclePaths(
              "back",
              BACK_PATHS,
              viewModels,
              hoveredMuscle,
              setHoveredMuscle,
            )}
          </svg>
        </div>
      </div>

      {hoveredVm && (
        <div className="body-map-tooltip">
          <span className="body-map-tooltip-name">{hoveredVm.label}</span>
          <span className="body-map-tooltip-pct">
            {hoveredVm.percentageDisplay}
          </span>
          {hoveredVm.timeUntilFreshDisplay && (
            <span className="body-map-tooltip-time">
              Fresh in {hoveredVm.timeUntilFreshDisplay}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
