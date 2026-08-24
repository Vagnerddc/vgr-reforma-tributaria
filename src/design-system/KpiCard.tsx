import { type ReactNode, useState } from "react";

type KpiState = "neutral" | "good" | "warn" | "bad";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  state?: KpiState;
  drilldown?: ReactNode;
}

/** KPI Card do dashboard/telas executivas — clicável, com drill-down inline (accordion). */
export function KpiCard({ label, value, state = "neutral", drilldown }: KpiCardProps) {
  const [open, setOpen] = useState(false);
  const clickable = Boolean(drilldown);
  const stateClass = state === "neutral" ? "" : `state-${state}`;
  return (
    <div style={{ gridColumn: drilldown && open ? "1 / -1" : undefined }}>
      <div
        className={`vgr-kpi ${stateClass} ${clickable ? "clickable open".split(" ")[0] : ""} ${open ? "open" : ""}`}
        onClick={clickable ? () => setOpen((v) => !v) : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
      >
        <span className="vgr-kpi-label">
          {label}
          {clickable && <span className="vgr-kpi-chevron">›</span>}
        </span>
        {value}
      </div>
      {drilldown && open && (
        <div className="vgr-card" style={{ background: "var(--vgr-surface-2)", marginTop: 4 }}>
          {drilldown}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="vgr-kpi-grid">{children}</div>;
}
