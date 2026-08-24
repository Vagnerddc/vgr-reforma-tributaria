/**
 * Timeline 2026-2033 (seção 10-18 do pedido) — mudanças discretas
 * (regime/decisão) aparecem como eventos, nunca suavizadas. Layout de
 * cards com scroll horizontal no desktop e pilha vertical no mobile
 * (CSS puro, sem nova biblioteca — seção 38/68).
 */

import { Card, DetailToggle } from "../../design-system";
import { formatarPercentualPt, formatarReaisCompacto, ROTULO_INDISPONIVEL } from "../formatters";
import type { IndicadorAno, TimelineEstrategicaViewModel } from "../viewModels/timeline";

const ROTULO_STATUS: Record<string, string> = {
  preferencia_tecnica_robusta: "Preferência robusta",
  preferencia_tecnica_condicionada: "Preferência condicionada",
  conflito_nao_resolvido: "Conflito",
  alternativas_equivalentes: "Equivalentes",
  dados_insuficientes: "Dados insuficientes",
  bloqueado: "Bloqueado",
  sem_conclusao: "Sem conclusão",
};

function celulaPercentual(i: IndicadorAno): string {
  return i.disponivel ? formatarPercentualPt(i.valor! * 100) : ROTULO_INDISPONIVEL;
}

export function TimelineEstrategica({ vm }: { vm: TimelineEstrategicaViewModel }) {
  if (vm.anos.length === 0) return null;

  return (
    <Card title="Linha do tempo — 2026 a 2033">
      <div role="list" aria-label="Timeline anual" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {vm.anos.map((ano) => (
          <div role="listitem" key={ano.ano} className="vgr-card" style={{ minWidth: 180, flex: "0 0 auto" }}>
            <h4>{ano.ano}</h4>
            <p>
              <strong>{ano.alternativaPreferida ?? "—"}</strong>
              <br />
              {ano.statusDecisao ? ROTULO_STATUS[ano.statusDecisao] ?? ano.statusDecisao : ROTULO_INDISPONIVEL}
            </p>
            <p>Carga: {celulaPercentual(ano.carga)}</p>
            <p>Margem: {celulaPercentual(ano.margem)}</p>
            <p>Resultado: {ano.resultado.disponivel ? formatarReaisCompacto(ano.resultado.valor!) : ROTULO_INDISPONIVEL}</p>
            {ano.marcos.length > 0 && (
              <ul aria-label={`Mudanças em ${ano.ano}`}>
                {ano.marcos.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
            <DetailToggle label="Detalhes">
              <p>Capital de giro adicional: {ano.capitalGiroAdicional.disponivel ? formatarReaisCompacto(ano.capitalGiroAdicional.valor!) : ROTULO_INDISPONIVEL}</p>
              <p>Regime de menor carga comparável: {ano.regimeComparavel ?? ROTULO_INDISPONIVEL}</p>
              <p>Qualidade: {ano.qualidade ?? ROTULO_INDISPONIVEL}</p>
            </DetailToggle>
          </div>
        ))}
      </div>
    </Card>
  );
}
