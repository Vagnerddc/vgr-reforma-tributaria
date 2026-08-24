import { useRef, useState, type ReactNode } from "react";

/**
 * Camada visual de upload (drag-and-drop + "Selecionar arquivos") — substitui
 * o `<input type="file">` nativo do navegador. A lógica de processamento dos
 * arquivos continua inteiramente em quem usa este componente: ele só entrega
 * a FileList recebida (por drop ou pelo seletor nativo escondido) via
 * `onFiles`, nunca decodifica nada.
 */
export function FileDropzone({
  label,
  hint,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  children,
}: {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: FileList) => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        className={`vgr-dropzone ${dragging ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="ic" style={{ fontSize: 22, marginBottom: 6 }}>
          ⇪
        </div>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>{label}</strong>
        <div style={{ fontSize: 12, color: "var(--vgr-text-faint)" }}>
          Arraste os arquivos aqui ou{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            style={{ background: "none", border: "none", padding: 0, color: "var(--vgr-accent-ink)", fontWeight: 700, cursor: "pointer" }}
          >
            selecionar arquivos
          </button>
        </div>
        {hint && <div className="hint" style={{ marginTop: 6 }}>{hint}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {children}
    </div>
  );
}
