import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

/* ---- Button ---- */
type ButtonVariant = "primary" | "secondary" | "tertiary";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
export function Button({ variant = "secondary", className = "", ...rest }: ButtonProps) {
  return <button className={`vgr-btn vgr-btn-${variant} ${className}`} {...rest} />;
}

/* ---- Badge / Pill ---- */
type PillTone = "accent" | "gold" | "danger" | "info" | "neutral";
export function Badge({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`vgr-pill vgr-pill-${tone}`}>{children}</span>;
}

/* ---- Card ---- */
export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="vgr-card" style={style}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}

/* ---- Tooltip ---- */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="vgr-tt">
      {children}
      <span style={{ fontSize: 11, color: "var(--vgr-text-faint)" }}>&nbsp;ⓘ</span>
      <span className="vgr-bubble">{label}</span>
    </span>
  );
}

/* ---- Alert ---- */
type AlertTone = "info" | "warn" | "danger";
export function Alert({ tone = "info", children }: { tone?: AlertTone; children: ReactNode }) {
  return <div className={`vgr-alert vgr-alert-${tone}`}>{children}</div>;
}

/* ---- Progress bar ---- */
export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="vgr-progress-track">
      <div className="vgr-progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ---- Skeleton ---- */
export function Skeleton({ width = "100%", height = 13 }: { width?: string | number; height?: number }) {
  return <div className="vgr-skeleton" style={{ width, height }} />;
}

/* ---- Empty state ---- */
export function EmptyState({
  icon = "☐",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="vgr-empty">
      <div className="vgr-empty-ic">{icon}</div>
      <h5>{title}</h5>
      <p>{description}</p>
      {action}
    </div>
  );
}

/* ---- Field wrapper (label + hint/error) — mesma camada visual para qualquer input/select ---- */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`vgr-field ${error ? "has-error" : ""}`}>
      <label className="vgr-field-label">{label}</label>
      {children}
      {error ? <span className="vgr-field-error">{error}</span> : hint ? <span className="vgr-field-hint">{hint}</span> : null}
    </div>
  );
}

/* ---- Input (texto/número) — troca só a camada visual, mantém value/onChange nativos ---- */
export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`vgr-input ${className}`} {...rest} />;
}

/* ---- Select — mesma ideia: só a apresentação, o <select> e as <option> continuam nativos ---- */
export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`vgr-select ${className}`} {...rest} />;
}

/* ---- Tabs (ex.: 2025 | 2026) ---- */
export function Tabs<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="vgr-tabs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`vgr-tab-btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Processing state (loading com texto contextual) ---- */
export function ProcessingState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="vgr-processing">
      <div className="vgr-spinner" />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

/* ---- Detalhamento colapsável (Resumo → Diagnóstico → Detalhamento) ---- */
export function DetailToggle({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="vgr-detail" open={defaultOpen}>
      <summary className="vgr-detail-toggle">
        <span className="chev">›</span>
        {label}
      </summary>
      <div className="vgr-detail-body">{children}</div>
    </details>
  );
}

/* ---- Chart container ---- */
export function ChartContainer({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="vgr-chart-container">
      {title && <div className="vgr-section-title" style={{ marginTop: 0 }}>{title}</div>}
      {children}
    </div>
  );
}
