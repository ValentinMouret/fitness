export function MuscleRecoveryLegend() {
  return (
    <div className="recovery-legend">
      <div className="recovery-legend-item">
        <span className="recovery-legend-dot recovery-legend-dot--fresh" />
        <span className="recovery-legend-label">Fresh (80–100%)</span>
      </div>
      <div className="recovery-legend-item">
        <span className="recovery-legend-dot recovery-legend-dot--recovering" />
        <span className="recovery-legend-label">Recovering (50–79%)</span>
      </div>
      <div className="recovery-legend-item">
        <span className="recovery-legend-dot recovery-legend-dot--fatigued" />
        <span className="recovery-legend-label">Fatigued (0–49%)</span>
      </div>
    </div>
  );
}
