/**
 * Cálculo mensal do fluxo atual × fluxo com split — seções 8-18 do pedido.
 * Granularidade mensal agregada (seção 25): nunca constrói contas a
 * receber detalhadas, só médias/percentuais sobre o agregado do mês.
 */

import type { ResultadoMesImpactoCaixa } from "./tipos";

export interface EntradaMes {
  mes: number;
  receita: number;
  /** 0 a 1 — ausente = split não calculável neste mês (indeterminado, nunca 0 assumido). */
  percentualRecebimentosSujeitos?: number;
  /** 0 a 1 — sobre a parcela sujeita. */
  percentualTributoSegregado?: number;
  taxaCustoCapitalMensal?: number;
  caixaMinimoOperacional?: number;
}

/**
 * Um mês: fluxo atual = 100% do recebimento entra no caixa, tributo é pago
 * depois (seção 8); fluxo com split = parcela segregada na liquidação,
 * recebimento líquido menor (seção 9). `reducaoDisponibilidadeCaixa` é a
 * diferença entre os dois — nunca chamada de "perda" (seção 10).
 */
export function calcularMesImpactoCaixa(entrada: EntradaMes): ResultadoMesImpactoCaixa {
  const { mes, receita, percentualRecebimentosSujeitos, percentualTributoSegregado, taxaCustoCapitalMensal, caixaMinimoOperacional } = entrada;

  const recebimentoBruto = receita;
  const caixaDisponivelAntesTributo = recebimentoBruto; // fluxo atual: 100% disponível até o pagamento do tributo.

  if (percentualRecebimentosSujeitos === undefined || percentualTributoSegregado === undefined) {
    return { mes, receita, recebimentoBruto, caixaDisponivelAntesTributo };
  }

  const parcelaSujeita = recebimentoBruto * percentualRecebimentosSujeitos;
  const valorSegregado = parcelaSujeita * percentualTributoSegregado;
  const caixaLiquido = recebimentoBruto - valorSegregado;
  const reducaoDisponibilidadeCaixa = valorSegregado;
  const necessidadeCapitalGiro = reducaoDisponibilidadeCaixa;

  const custoFinanceiro = taxaCustoCapitalMensal !== undefined ? necessidadeCapitalGiro * taxaCustoCapitalMensal : undefined;

  let financiamentoAdicionalNecessario: number | undefined;
  if (caixaMinimoOperacional !== undefined && caixaLiquido < caixaMinimoOperacional) {
    financiamentoAdicionalNecessario = caixaMinimoOperacional - caixaLiquido;
  }

  return {
    mes,
    receita,
    recebimentoBruto,
    valorSegregado,
    caixaLiquido,
    caixaDisponivelAntesTributo,
    reducaoDisponibilidadeCaixa,
    necessidadeCapitalGiro,
    custoFinanceiro,
    financiamentoAdicionalNecessario,
  };
}
