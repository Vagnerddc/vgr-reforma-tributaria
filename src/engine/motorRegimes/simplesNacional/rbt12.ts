/**
 * RBT12 — receita bruta acumulada dos 12 meses anteriores ao mês de
 * apuração (LC 123/2006, art. 3º, §1º). NUNCA confundida com faturamento
 * anual projetado (seção 7 do pedido): é uma janela ROLANTE, recalculada
 * mês a mês. Como `CenarioEmpresa` só tem receita anual (não uma série
 * mensal real), a RBT12 aqui é necessariamente uma ESTIMATIVA — nunca
 * apresentada como dado real, sempre com `status: "estimado"` e
 * metodologia explícita.
 */

import type { StatusInformacao } from "../../operacaoTributaria";

export interface Rbt12Mensal {
  mes: number; // 1–12
  rbt12: number;
  status: StatusInformacao;
  metodologia: string;
}

interface DataAbertura {
  ano: number;
  mes: number;
}

function parseDataAbertura(data: string | undefined): DataAbertura | undefined {
  if (!data) return undefined;
  const m = /^(\d{4})-(\d{2})/.exec(data);
  if (!m) return undefined;
  return { ano: parseInt(m[1], 10), mes: parseInt(m[2], 10) };
}

/**
 * Calcula a RBT12 mês a mês para UM ano, a partir da receita TOTAL da
 * empresa (soma de todas as atividades, nunca per-atividade — o RBT12 é
 * sempre no nível da empresa) do próprio ano e do ano anterior.
 *
 * Início de atividade (ano de abertura): RBT12 proporcionalizada (LC
 * 123/2006, art. 3º, §2º) — constante ao longo dos meses ativos do ano,
 * como simplificação documentada (a lei prevê recálculo mês a mês
 * conforme a receita acumulada real; sem série mensal real, usamos a
 * média do próprio ano parcial). Meses ANTERIORES à abertura não geram
 * entrada — não existiram.
 *
 * Ano seguinte ao de abertura, ainda sem 12 meses completos até janeiro:
 * NÃO tratado com a mesma precisão (limitação conhecida, documentada em
 * docs/motor-simples-nacional.md) — cai no cálculo rolante normal.
 */
export function calcularRbt12MensalDoAno(receitaTotalAnoAtual: number, receitaTotalAnoAnterior: number | undefined, dataAberturaTexto: string | undefined, ano: number): Rbt12Mensal[] {
  const abertura = parseDataAbertura(dataAberturaTexto);

  if (abertura && abertura.ano === ano) {
    const mesesAtivos = 13 - abertura.mes;
    const rbt12Proporcional = mesesAtivos > 0 ? (receitaTotalAnoAtual / mesesAtivos) * 12 : receitaTotalAnoAtual;
    const meses: Rbt12Mensal[] = [];
    for (let mes = abertura.mes; mes <= 12; mes++) {
      meses.push({
        mes,
        rbt12: rbt12Proporcional,
        status: "estimado",
        metodologia: `Início de atividade (abertura em ${dataAberturaTexto}) — RBT12 proporcionalizada: (receita do ano parcial ÷ ${mesesAtivos} meses ativos) × 12 (LC 123/2006, art. 3º, §2º).`,
      });
    }
    return meses;
  }

  const mensalAtual = receitaTotalAnoAtual / 12;
  const semDadoAnoAnterior = receitaTotalAnoAnterior === undefined;
  const mensalAnterior = receitaTotalAnoAnterior !== undefined ? receitaTotalAnoAnterior / 12 : mensalAtual;

  const metodologia = semDadoAnoAnterior
    ? "Sem receita do ano anterior disponível — RBT12 aproximada pela receita do próprio ano (primeiro ano simulado), constante nos 12 meses."
    : "RBT12 rolante: (meses restantes do ano anterior × média mensal do ano anterior) + (meses já decorridos do ano atual × média mensal do ano atual) — ambas as médias mensais são premissas de distribuição uniforme, não série real.";

  const meses: Rbt12Mensal[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const rbt12 = (12 - mes) * mensalAnterior + mes * mensalAtual;
    meses.push({ mes, rbt12, status: "estimado", metodologia });
  }
  return meses;
}
