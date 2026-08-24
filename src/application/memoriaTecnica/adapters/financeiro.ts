import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensFinanceiros(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const itens: ItemMemoriaTecnica[] = [];
  const porRegime = analise.resultadoCenario?.resultadoFinanceiroPorRegime ?? [];

  for (const financeiro of porRegime) {
    const anoFinanceiro = financeiro.resultado.anos.find((a) => a.ano === analise.ano);
    if (!anoFinanceiro) continue;

    const disponivel = anoFinanceiro.disponivel;
    const premissas = Object.keys(financeiro.resultado.premissas ?? {});
    const evidencias = (anoFinanceiro.achados ?? []).map((a) => a.descricao);
    const limitacoes = anoFinanceiro.alertas ?? [];

    const base = {
      periodo: { ano: analise.ano },
      regime: financeiro.regime,
      origemResultado: "motor_financeiro" as const,
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "motorFinanceiro",
      status: disponivel ? ("calculado" as const) : ("indisponivel" as const),
      qualidade: anoFinanceiro.qualidade,
      premissas,
      evidencias,
      fundamentos: [] as string[],
      dependencias: [] as string[],
      limitacoes,
    };

    const idMargem = `financeiro:${financeiro.regime}:${analise.ano}:margem`;
    itens.push({
      ...base,
      id: idMargem,
      codigo: idMargem,
      categoria: "economico",
      titulo: "Margem projetada",
      descricao: `Margem projetada do regime ${financeiro.regime} no ano ${analise.ano}.`,
      valor: disponivel ? anoFinanceiro.margem : undefined,
      unidade: "percentual",
    });

    const idImpacto = `financeiro:${financeiro.regime}:${analise.ano}:impacto_anual`;
    itens.push({
      ...base,
      id: idImpacto,
      codigo: idImpacto,
      categoria: "economico",
      titulo: "Impacto anual",
      descricao: `Impacto financeiro anual estimado do regime ${financeiro.regime} no ano ${analise.ano}.`,
      valor: disponivel ? anoFinanceiro.impactoAnualReais : undefined,
      unidade: "reais",
    });

    if (anoFinanceiro.reajusteMedioNecessario !== undefined) {
      const idPreco = `financeiro:${financeiro.regime}:${analise.ano}:preco_necessario`;
      itens.push({
        ...base,
        id: idPreco,
        codigo: idPreco,
        categoria: "economico",
        titulo: "Referência matemática de preço necessário",
        descricao: "Reajuste médio necessário para preservar margem — referência matemática, não recomendação comercial.",
        valor: anoFinanceiro.reajusteMedioNecessario,
        unidade: "percentual",
      });
    }

    if (anoFinanceiro.erosaoMargemPp !== undefined) {
      const idErosao = `financeiro:${financeiro.regime}:${analise.ano}:erosao_margem`;
      itens.push({
        ...base,
        id: idErosao,
        codigo: idErosao,
        categoria: "economico",
        titulo: "Erosão de margem",
        descricao: "Variação da margem em pontos percentuais em relação ao ano-base.",
        valor: anoFinanceiro.erosaoMargemPp,
        unidade: "pontos_percentuais",
      });
    }
  }

  return itens;
}
