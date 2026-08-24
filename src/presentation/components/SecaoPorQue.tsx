/**
 * Seção "Por quê?" (seção 5 do pedido) — consome diretamente evidências
 * favoráveis/contrárias e condições já vindas do Motor de Decisão.
 * Nenhuma justificativa é construída na UI.
 */

import { Card } from "../../design-system";
import type { DecisaoViewModel } from "../viewModels/decisao";

export function SecaoPorQue({ vm }: { vm: DecisaoViewModel }) {
  if (vm.evidencias.length === 0 && vm.condicoes.length === 0) return null;

  return (
    <Card title="Por quê?">
      <ul style={{ listStyle: "none", paddingLeft: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {vm.evidencias.map((e, i) => (
          <li key={i}>
            <span aria-hidden style={{ color: e.favoravel ? "var(--vgr-accent, #4BAF4F)" : "#B08900" }}>
              {e.favoravel ? "✓" : "⚠"}
            </span>{" "}
            {e.descricao}
          </li>
        ))}
        {vm.condicoes.map((c, i) => (
          <li key={`c-${i}`}>
            <span aria-hidden style={{ color: "#B08900" }}>
              ⚠
            </span>{" "}
            {c.descricao}
          </li>
        ))}
      </ul>
    </Card>
  );
}
