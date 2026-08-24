import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Modal reservado para confirmações/avisos/ações críticas (não para detalhamento — isso é Drawer). */
export function Modal({ open, title, children, onCancel, onConfirm, confirmLabel = "Confirmar", cancelLabel = "Cancelar" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="vgr-modal-scrim" onClick={onCancel}>
      <div className="vgr-modal-card" onClick={(e) => e.stopPropagation()}>
        <h5>{title}</h5>
        <p>{children}</p>
        <div className="vgr-modal-actions">
          <button className="vgr-btn vgr-btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="vgr-btn vgr-btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
