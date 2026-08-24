/**
 * Renderiza UM `ConflitoFonte` pendente/desatualizado com ações de resolução
 * — nunca resolve sozinho (docs/ingestao-documental-v2.md §O). Quando
 * `status === "desatualizado"`, mostra a resolução anterior (histórico) e
 * pede nova confirmação explicitamente.
 */
import { useState } from "react";
import { Alert, Badge, Button, Input } from "../../../design-system";
import type { ConflitoFonte } from "../../../application/ingestaoDocumental/tipos";

const ROTULO_STATUS: Record<ConflitoFonte["status"], string> = {
  pendente: "Pendente",
  resolvido_usuario: "Resolvido",
  resolvido_regra: "Resolvido automaticamente",
  desatualizado: "Desatualizado — revisar novamente",
};

export function PainelConflito({
  conflito,
  onResolver,
}: {
  conflito: ConflitoFonte;
  onResolver: (params: { valorEscolhido: ConflitoFonte["valores"][number] | { digitado: unknown }; motivo: string }) => void;
}) {
  const [valorManual, setValorManual] = useState("");

  return (
    <Alert tone={conflito.status === "desatualizado" ? "warn" : "info"}>
      <strong>
        {conflito.campo} {conflito.periodo ? `(${conflito.periodo})` : ""} — <Badge tone="neutral">{ROTULO_STATUS[conflito.status]}</Badge>
      </strong>

      {conflito.status === "desatualizado" && conflito.historico && conflito.historico.length > 0 && (
        <p>
          Resolução anterior: <em>{conflito.historico[conflito.historico.length - 1].resolucao?.motivo ?? "—"}</em> — uma fonte nova diverge dela. Confirme novamente.
        </p>
      )}

      <ul>
        {conflito.valores.map((v) => (
          <li key={`${v.tipoDocumento}-${v.documentoId}`}>
            {v.tipoDocumento} ({v.documentoId}): {String(v.valor)}{" "}
            <Button variant="secondary" onClick={() => onResolver({ valorEscolhido: v, motivo: `escolhido: ${v.tipoDocumento}` })}>
              Escolher esta fonte
            </Button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Input placeholder="Informar valor correto" value={valorManual} onChange={(e) => setValorManual(e.target.value)} />
        <Button
          variant="secondary"
          disabled={!valorManual.trim()}
          onClick={() => {
            onResolver({ valorEscolhido: { digitado: valorManual }, motivo: "valor informado manualmente pelo contador" });
            setValorManual("");
          }}
        >
          Informar valor correto
        </Button>
      </div>
    </Alert>
  );
}
