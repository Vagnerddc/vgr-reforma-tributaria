export function Stepper({ labels, currentStep }: { labels: string[]; currentStep: number }) {
  return (
    <div className="vgr-stepper">
      {labels.map((label, idx) => {
        const step = idx + 1;
        const cls = step < currentStep ? "done" : step === currentStep ? "now" : "";
        return (
          <span key={label} style={{ display: "flex", alignItems: "center", flex: idx < labels.length - 1 ? 1 : undefined }}>
            <span className={`vgr-step ${cls}`}>
              <span className="vgr-step-dot">{step < currentStep ? "✓" : step}</span>
              <span className="vgr-step-label">{label}</span>
            </span>
            {idx < labels.length - 1 && <span className="vgr-step-line" />}
          </span>
        );
      })}
    </div>
  );
}
