import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensCaixa(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const itens: ItemMemoriaTecnica[] = [];
  const porRegime = analise.resultadoCenario?.resultadoCaixaPorRegime ?? [];

  for (const caixaRegime of porRegime) {
    const anoCaixa = caixaRegime.anos.find((a) => a.ano === analise.ano);
    if (!anoCaixa) continue;

    const disponivel = anoCaixa.disponivel;
    const base = {
      periodo: { ano: analise.ano },
      regime: caixaRegime.regime,
      origemResultado: "motor_caixa" as const,
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "motorFinanceiro/splitPayment",
      status: disponivel ? ("calculado" as const) : ("indisponivel" as const),
      qualidade: anoCaixa.qualidade,
      premissas: Object.keys(anoCaixa.premissas ?? {}),
      evidencias: (anoCaixa.achados ?? []).map((a) => a.descricao),
      fundamentos: [] as string[],
      dependencias: [] as string[],
      limitacoes: anoCaixa.alertas ?? [],
    };

    const idReducao = `caixa:${caixaRegime.regime}:${analise.ano}:reducao_disponibilidade`;
    itens.push({
      ...base,
      id: idReducao,
      codigo: idReducao,
      categoria: "caixa",
      titulo: "Redução de disponibilidade de caixa",
      descricao: "Redução média na disponibilidade de caixa decorrente da retenção/segregação tributária — nunca tratada como perda.",
      valor: disponivel ? anoCaixa.impactoMedioCaixa : undefined,
      unidade: "reais",
    });

    const idCapital = `caixa:${caixaRegime.regime}:${analise.ano}:capital_adicional`;
    itens.push({
      ...base,
      id: idCapital,
      codigo: idCapital,
      categoria: "caixa",
      titulo: "Pico de capital de giro adicional",
      descricao: "Necessidade adicional de capital de giro no pico do período, decorrente do split payment.",
      valor: disponivel ? anoCaixa.picoCapitalGiroAdicional : undefined,
      unidade: "reais",
    });

    if (anoCaixa.mesPicoCapitalGiro !== undefined) {
      const idPeriodoPico = `caixa:${caixaRegime.regime}:${analise.ano}:periodo_pico`;
      itens.push({
        ...base,
        id: idPeriodoPico,
        codigo: idPeriodoPico,
        categoria: "caixa",
        titulo: "Período do pico de capital de giro",
        descricao: "Mês do ano em que a necessidade de capital de giro adicional é máxima.",
        valor: anoCaixa.mesPicoCapitalGiro,
        unidade: "mes",
      });
    }

    const idCusto = `caixa:${caixaRegime.regime}:${analise.ano}:custo_financeiro`;
    itens.push({
      ...base,
      id: idCusto,
      codigo: idCusto,
      categoria: "caixa",
      titulo: "Custo financeiro anual",
      descricao: "Custo financeiro anual estimado do financiamento da necessidade de capital de giro adicional.",
      valor: disponivel ? anoCaixa.custoFinanceiroAnual : undefined,
      unidade: "reais",
    });
  }

  return itens;
}
