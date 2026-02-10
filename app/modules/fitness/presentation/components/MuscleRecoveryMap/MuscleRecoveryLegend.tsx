export function MuscleRecoveryLegend() {
  return (
    <div className="recovery-legend">
      <div className="recovery-legend-item">
        <span
          className="recovery-legend-dot"
          style={{ backgroundColor: "#30a46c" }}
        />
        <span className="recovery-legend-label">Fresh (80–100%)</span>
      </div>
      <div className="recovery-legend-item">
        <span
          className="recovery-legend-dot"
          style={{ backgroundColor: "#f59e0b" }}
        />
        <span className="recovery-legend-label">Recovering (50–79%)</span>
      </div>
      <div className="recovery-legend-item">
        <span
          className="recovery-legend-dot"
          style={{ backgroundColor: "#e5484d" }}
        />
        <span className="recovery-legend-label">Fatigued (0–49%)</span>
      </div>
    </div>
  );
}
