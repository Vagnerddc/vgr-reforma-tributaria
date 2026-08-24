/**
 * Seção Score Estratégico (seção 12 do pedido) — perfil dimensional em
 * destaque; o consolidado aparece só como mais um dado (nunca em
 * tamanho/posição que sugira ser a conclusão). "Score Estratégico da
 * Alternativa", nunca "Score da Empresa".
 */

import { Card, DetailToggle } from "../../design-system";
import type { ScoreAlternativaViewModel } from "../viewModels/score";

export function SecaoScoreEstrategico({ scores }: { scores: ScoreAlternativaViewModel[] }) {
  if (scores.length === 0) return null;

  return (
    <Card title="Score Estratégico da Alternativa">
      {scores.map((s) => (
        <div key={s.alternativaId} style={{ marginBottom: 16 }}>
          <h4>{s.alternativaId}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {s.dimensoes.map((d) => (
              <div key={d.dimensao}>
                <div>{d.rotulo}</div>
                <div>{d.valor !== undefined ? `${d.valor.toFixed(0)}/100` : d.status.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          <DetailToggle label="Ver consolidado e fatores">
            <p>Score consolidado: {s.scoreConsolidado !== undefined ? `${s.scoreConsolidado.toFixed(0)}/100` : `indisponível (${s.statusConsolidado.replace(/_/g, " ")})`}</p>
            {s.fatoresPositivos.length > 0 && (
              <p>
                Fatores favoráveis: {s.fatoresPositivos.join(", ")}
              </p>
            )}
            {s.fatoresLimitantes.length > 0 && (
              <p>
                Fatores limitantes: {s.fatoresLimitantes.join(", ")}
              </p>
            )}
          </DetailToggle>
        </div>
      ))}
    </Card>
  );
}
