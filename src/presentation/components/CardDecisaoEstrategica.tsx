/**
 * Card de Decisão (seção 4 do pedido) — trata explicitamente os 7
 * estados de `StatusConclusao`. Regras obrigatórias já garantidas pelo
 * ViewModel (decisao.ts), reforçadas aqui na apresentação: condição
 * sempre visível em preferência condicionada; conflito nunca destaca
 * vencedor; obrigação jurídica nunca aparece como "melhor regime";
 * dados insuficientes mostram o motivo.
 */

import { Alert, Badge, Card } from "../../design-system";
import type { DecisaoViewModel, ToneDecisao } from "../viewModels/decisao";

const TONE_ALERT: Record<ToneDecisao, "info" | "warn" | "danger"> = { neutral: "info", good: "info", warn: "warn", bad: "danger" };
const TONE_BADGE: Record<ToneDecisao, "accent" | "gold" | "danger" | "neutral"> = { neutral: "neutral", good: "accent", warn: "gold", bad: "danger" };

export function CardDecisaoEstrategica({ vm }: { vm: DecisaoViewModel }) {
  return (
    <Card title={`Decisão — ${vm.ano}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Badge tone={TONE_BADGE[vm.tone]}>{vm.rotuloStatus}</Badge>
        <Badge tone="neutral">Qualidade: {vm.qualidade}</Badge>
      </div>

      {vm.ehObrigacaoJuridica && vm.alternativaPreferida && (
        <Alert tone="info">
          <strong>{vm.alternativaPreferida}</strong> é o regime juridicamente obrigatório neste cenário — não se trata de preferência entre alternativas.
        </Alert>
      )}

      {!vm.ehObrigacaoJuridica && vm.alternativaPreferida && (
        <p>
          <strong>{vm.alternativaPreferida}</strong>
        </p>
      )}

      {vm.status === "conflito_nao_resolvido" && vm.alternativasEmConflito.length > 0 && (
        <Alert tone="warn">
          As alternativas ({vm.alternativasEmConflito.join(", ")}) apresentam vantagens em dimensões distintas — os dados atuais não sustentam uma preferência técnica única. Nenhuma delas é destacada como vencedora.
        </Alert>
      )}

      {vm.status === "alternativas_equivalentes" && vm.alternativasEquivalentes.length > 0 && (
        <Alert tone="info">As alternativas ({vm.alternativasEquivalentes.join(", ")}) produzem resultados equivalentes dentro da precisão analisada.</Alert>
      )}

      {(vm.status === "dados_insuficientes" || vm.status === "bloqueado") && vm.motivoIndisponibilidade && <Alert tone={TONE_ALERT[vm.tone]}>{vm.motivoIndisponibilidade}</Alert>}

      {vm.condicoes.length > 0 && (
        <Alert tone="warn">
          <strong>Condição:</strong>
          <ul>
            {vm.condicoes.map((c, i) => (
              <li key={i}>{c.descricao}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Card>
  );
}
