/**
 * Achados de créditos — reaproveita `agregarCreditoPorSistema`
 * (creditoTributario.ts), exatamente a mesma função usada pelo adapter
 * do Motor VGR (cenarioEmpresaAdapter.ts) — nunca uma segunda leitura de
 * crédito. Nenhum threshold global "baixo"/"alto" (seção 16) — só o
 * índice objetivo; interpretação de faixa fica para configuração futura.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import { agregarCreditoPorSistema } from "../creditoTributario";
import type { AchadoEstrategico } from "./tipos";

export function gerarAchadosCredito(cenario: CenarioEmpresa, ano: number): AchadoEstrategico[] {
  const faturamento = cenario.receita.faturamentoAnual?.valor;
  if (faturamento === undefined || faturamento <= 0) return [];

  if (cenario.custos.itens.length === 0) {
    return [
      {
        id: `creditos:${ano}:CREDITOS_INDETERMINADOS`,
        codigo: "CREDITOS_INDETERMINADOS",
        categoria: "creditos",
        tituloTecnico: "Estrutura de créditos indeterminada",
        descricaoTecnica: "Nenhum item de custo/despesa foi informado — não é possível calcular o índice de crédito IBS/CBS.",
        periodo: { ano },
        evidencias: [{ origem: "motor_creditos", referencia: "cenario.custos.itens.length === 0" }],
        qualidade: "insuficiente",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
        severidadeTecnica: "informacao_insuficiente",
      },
    ];
  }

  const agregacao = agregarCreditoPorSistema(cenario.custos.itens, "ibsCbs", faturamento);
  const achados: AchadoEstrategico[] = [
    {
      id: `creditos:${ano}:INDICE_CREDITO_CALCULADO`,
      codigo: "INDICE_CREDITO_CALCULADO",
      categoria: "creditos",
      tituloTecnico: "Índice de crédito IBS/CBS calculado",
      descricaoTecnica: `${(agregacao.percentualCreditavel * 100).toFixed(1)}% do faturamento corresponde a custos/despesas creditáveis de IBS/CBS (agregarCreditoPorSistema, sistema ibsCbs).`,
      valor: agregacao.percentualCreditavel,
      unidade: "indice",
      periodo: { ano },
      evidencias: [{ origem: "motor_creditos", referencia: "agregarCreditoPorSistema(custos.itens, 'ibsCbs', faturamentoAnual).percentualCreditavel", valor: agregacao.percentualCreditavel }],
      qualidade: agregacao.percentualIndeterminado === 0 ? "alta" : agregacao.percentualIndeterminado < agregacao.percentualCreditavel ? "media" : "baixa",
      premissas: agregacao.percentualSobPremissa > 0 ? { percentualSobPremissa: agregacao.percentualSobPremissa } : {},
      origens: ["classificacao_vgr"],
      status: agregacao.percentualIndeterminado === 0 ? "confirmado" : "estimado",
    },
  ];

  if (agregacao.percentualIndeterminado > 0) {
    achados.push({
      id: `creditos:${ano}:CREDITOS_POTENCIAIS_NAO_CLASSIFICADOS`,
      codigo: "CREDITOS_INDETERMINADOS",
      categoria: "creditos",
      tituloTecnico: "Parcela dos custos ainda não classificada para fins de crédito",
      descricaoTecnica: `${(agregacao.percentualIndeterminado * 100).toFixed(1)}% do faturamento está em categorias de custo cujo tratamento de crédito IBS/CBS ainda não foi confirmado.`,
      valor: agregacao.percentualIndeterminado,
      unidade: "indice",
      periodo: { ano },
      evidencias: [{ origem: "motor_creditos", referencia: "agregarCreditoPorSistema(...).percentualIndeterminado", valor: agregacao.percentualIndeterminado }],
      qualidade: "baixa",
      premissas: {},
      origens: ["classificacao_vgr"],
      status: "estimado",
    });
  }

  return achados;
}

/**
 * Crédito adicional necessário para neutralizar o impacto tributário da
 * reforma (seção 18) — só quando `impactoTributarioReais` (Motor
 * Financeiro) e a base de custos permitirem uma leitura direta: quanto
 * de crédito ADICIONAL (em R$, sobre o mesmo faturamento) equivaleria a
 * compensar o aumento de carga. Não afirma que a empresa deveria buscar
 * isso — só o número.
 */
export function gerarAchadoCreditoNecessarioParaNeutralizar(impactoTributarioReais: number | undefined, faturamento: number | undefined, ano: number): AchadoEstrategico[] {
  if (impactoTributarioReais === undefined || impactoTributarioReais <= 0 || faturamento === undefined || faturamento <= 0) return [];

  return [
    {
      id: `creditos:${ano}:CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA`,
      codigo: "CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA",
      categoria: "creditos",
      tituloTecnico: "Crédito adicional que neutralizaria o aumento de carga tributária",
      descricaoTecnica: `Um crédito adicional de R$ ${impactoTributarioReais.toFixed(2)} no ano (${((impactoTributarioReais / faturamento) * 100).toFixed(2)}% da receita) equivaleria ao aumento de carga tributária identificado em relação ao ano-base.`,
      valor: impactoTributarioReais,
      unidade: "reais",
      periodo: { ano },
      evidencias: [{ origem: "motor_financeiro", referencia: "ResultadoAnoEconomicoFinanceiro.impactoTributarioReais", valor: impactoTributarioReais }],
      qualidade: "media",
      premissas: {},
      origens: ["classificacao_vgr"],
      status: "estimado",
    },
  ];
}
