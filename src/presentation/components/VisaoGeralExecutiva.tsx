/**
 * Visão Geral Executiva (seção 3 do pedido) — primeira tela: o que
 * aconteceu, qual o impacto, existe conclusão técnica, qual a condição
 * principal. KPIs nunca aparecem quando indisponíveis — mostram um
 * estado próprio, nunca `0`.
 */

import { KpiCard, KpiGrid } from "../../design-system";
import { formatarPercentualPt, formatarReaisCompacto, ROTULO_INDISPONIVEL } from "../formatters";
import { CardDecisaoEstrategica } from "./CardDecisaoEstrategica";
import { SecaoPorQue } from "./SecaoPorQue";
import type { DecisaoViewModel } from "../viewModels/decisao";
import type { ResumoExecutivoViewModel } from "../viewModels/resumoExecutivo";

export function VisaoGeralExecutiva({ resumo, decisao }: { resumo: ResumoExecutivoViewModel; decisao: DecisaoViewModel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiGrid>
        <KpiCard label="Carga projetada" value={resumo.cargaProjetada.disponivel ? formatarPercentualPt(resumo.cargaProjetada.valor! * 100) : ROTULO_INDISPONIVEL} state={resumo.cargaProjetada.disponivel ? "neutral" : "warn"} />
        <KpiCard label="Margem projetada" value={resumo.margemProjetada.disponivel ? formatarPercentualPt(resumo.margemProjetada.valor! * 100) : ROTULO_INDISPONIVEL} state={resumo.margemProjetada.disponivel ? "neutral" : "warn"} />
        <KpiCard label="Impacto anual" value={resumo.impactoAnualReais.disponivel ? formatarReaisCompacto(resumo.impactoAnualReais.valor!) : ROTULO_INDISPONIVEL} state={resumo.impactoAnualReais.disponivel && resumo.impactoAnualReais.valor! < 0 ? "bad" : "neutral"} />
        <KpiCard label="Capital adicional" value={resumo.capitalAdicionalReais.disponivel ? formatarReaisCompacto(resumo.capitalAdicionalReais.valor!) : ROTULO_INDISPONIVEL} state={resumo.capitalAdicionalReais.disponivel ? "warn" : "neutral"} />
      </KpiGrid>

      <CardDecisaoEstrategica vm={decisao} />
      <SecaoPorQue vm={decisao} />
    </div>
  );
}
