import type { ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  tag?: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Drawer — padrão para detalhamento (fornecedor, memória de cálculo, origem de crédito). Modal é só para ações críticas. */
export function Drawer({ open, tag, title, onClose, children }: DrawerProps) {
  if (!open) return null;
  return (
    <>
      <div className="vgr-scrim" onClick={onClose} />
      <aside className="vgr-drawer">
        <div className="vgr-drawer-head">
          <div>
            {tag && <span className="vgr-pill vgr-pill-neutral">{tag}</span>}
            <h5>{title}</h5>
          </div>
          <button className="vgr-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="vgr-drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function DrawerRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="vgr-field-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
