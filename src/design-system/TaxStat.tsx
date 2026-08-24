/**
 * Componente central para exibição de indicadores tributários.
 *
 * Regra fixa do Design System (definida no protótipo aprovado): o percentual
 * é sempre a informação em destaque, o valor em R$ aparece como complemento
 * abaixo, menor e mais claro. Nunca inverter essa hierarquia nem recalcular
 * "% de redução" separadamente em cada tela — usar sempre
 * `compararCargaTributaria` abaixo para não confundir pontos percentuais
 * (p.p.) com redução percentual relativa.
 */

export function formatarPercentualPt(valor: number, casas = 1): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export interface ComparativoCargaTributaria {
  /** Carga atual, em fração (0.187 = 18,7%). */
  cargaAtual: number;
  /** Carga projetada, em fração. */
  cargaProjetada: number;
  faturamentoAtual: number;
  faturamentoProjetado?: number;
  /** Diferença em pontos percentuais (cargaAtual − cargaProjetada), positivo = redução. */
  deltaPontosPercentuais: number;
  /** Redução percentual RELATIVA à carga atual — não confundir com p.p. */
  deltaRelativoPercentual: number;
  economiaReais: number;
}

/**
 * Única função que deve calcular a relação entre carga atual/projetada,
 * p.p. e redução relativa — para não haver essa conta duplicada (e
 * potencialmente divergente) em Dashboard, Resultado e Análises.
 */
export function compararCargaTributaria(
  cargaAtual: number,
  cargaProjetada: number,
  faturamentoAtual: number,
  faturamentoProjetado: number = faturamentoAtual
): ComparativoCargaTributaria {
  const deltaPontosPercentuais = (cargaAtual - cargaProjetada) * 100;
  const deltaRelativoPercentual = cargaAtual > 0 ? ((cargaAtual - cargaProjetada) / cargaAtual) * 100 : 0;
  const economiaReais = cargaAtual * faturamentoAtual - cargaProjetada * faturamentoProjetado;
  return {
    cargaAtual,
    cargaProjetada,
    faturamentoAtual,
    faturamentoProjetado,
    deltaPontosPercentuais,
    deltaRelativoPercentual,
    economiaReais,
  };
}

type TaxStatTone = "neutral" | "good" | "bad";

/** Carga tributária isolada: % em destaque, R$ como complemento. */
export function TaxStat({
  percent,
  reais,
  reaisLabel,
  tone = "neutral",
  size = "md",
}: {
  percent: number;
  reais?: number;
  reaisLabel?: string;
  tone?: TaxStatTone;
  size?: "md" | "lg";
}) {
  return (
    <span className={`vgr-tstat ${tone === "neutral" ? "" : tone} ${size === "lg" ? "lg" : ""}`}>
      <span className="vgr-tstat-pct">{formatarPercentualPt(percent * 100)}</span>
      {(reais !== undefined || reaisLabel) && (
        <span className="vgr-tstat-reais">{reaisLabel ?? formatarReais(reais!)}</span>
      )}
    </span>
  );
}

/** Redução de carga: p.p. em destaque, com o % relativo ao lado e o R$ de economia como complemento. */
export function TaxReductionStat({
  comparativo,
  tone = "good",
  size = "md",
}: {
  comparativo: ComparativoCargaTributaria;
  tone?: TaxStatTone;
  size?: "md" | "lg";
}) {
  const pp = formatarPercentualPt(comparativo.deltaPontosPercentuais).replace("%", " p.p.");
  const relativo = formatarPercentualPt(comparativo.deltaRelativoPercentual);
  return (
    <span className={`vgr-tstat ${tone === "neutral" ? "" : tone} ${size === "lg" ? "lg" : ""}`}>
      <span className="vgr-tstat-pct">
        {pp}
        <span className="vgr-pp-tag">·{relativo} relativo</span>
      </span>
      <span className="vgr-tstat-reais">{formatarReais(comparativo.economiaReais)} de economia</span>
    </span>
  );
}
