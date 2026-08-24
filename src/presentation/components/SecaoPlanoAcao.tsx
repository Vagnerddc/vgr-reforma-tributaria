/**
 * "Próximas Providências" (seção 13 do pedido) — respeita as etapas já
 * ordenadas pelo Plano de Ação; nunca um Kanban, só uma lista
 * sequencial com o motivo de bloqueio visível quando existir.
 */

import { Alert, Card } from "../../design-system";
import type { EtapaPlanoViewModel } from "../viewModels/planoAcao";

export function SecaoPlanoAcao({ etapas }: { etapas: EtapaPlanoViewModel[] }) {
  if (etapas.length === 0) return null;

  return (
    <Card title="Próximas providências">
      {etapas.map((etapa) => (
        <div key={etapa.numero} style={{ marginBottom: 12 }}>
          <h4>{etapa.titulo}</h4>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {etapa.acoes.map((a) => (
              <li key={a.id}>
                <span aria-hidden>{a.bloqueada ? "✕" : "○"}</span> {a.titulo}
                {a.bloqueada && a.motivoBloqueio && <Alert tone="danger">{a.motivoBloqueio}</Alert>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
