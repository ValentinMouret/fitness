import { Tooltip } from "@radix-ui/themes";

export function MuscleRecoveryLegend() {
  return (
    <div className="recovery-legend">
      <Tooltip content="Ready for high-intensity training. These muscles have had sufficient rest.">
        <div className="recovery-legend-item">
          <span className="recovery-legend-dot recovery-legend-dot--fresh" />
          <span className="recovery-legend-label">Fresh (80–100%)</span>
        </div>
      </Tooltip>
      <Tooltip content="Muscles are still repairing. Light to moderate activity is okay, but avoid heavy volume.">
        <div className="recovery-legend-item">
          <span className="recovery-legend-dot recovery-legend-dot--recovering" />
          <span className="recovery-legend-label">Recovering (50–79%)</span>
        </div>
      </Tooltip>
      <Tooltip content="High fatigue levels. Prioritize rest or very light active recovery for these areas.">
        <div className="recovery-legend-item">
          <span className="recovery-legend-dot recovery-legend-dot--fatigued" />
          <span className="recovery-legend-label">Fatigued (0–49%)</span>
        </div>
      </Tooltip>
    </div>
  );
}
