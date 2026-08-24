/**
 * Seção "Configurações eficientes encontradas" (seção 14 do pedido) —
 * nunca "solução ótima", nunca numerada como ranking (1º/2º/3º).
 */

import { Alert, Card } from "../../design-system";
import { formatarReais } from "../formatters";
import type { ParetoViewModel } from "../viewModels/pareto";

export function SecaoParetoFronteira({ vm }: { vm: ParetoViewModel }) {
  if (vm.configuracoes.length === 0) return null;

  return (
    <Card title="Configurações eficientes encontradas">
      <Alert tone="info">{vm.explicacaoMetodologica}</Alert>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
        {vm.configuracoes.map((c) => (
          <div key={c.id} className="vgr-card">
            {c.rotulosObjetivosExtremos.length > 0 && <div>{c.rotulosObjetivosExtremos.join(" · ")}</div>}
            {c.objetivos.map((o) => (
              <div key={o.objetivo}>
                {o.rotulo}: {o.valor !== undefined ? formatarReais(o.valor) : "Indisponível"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
