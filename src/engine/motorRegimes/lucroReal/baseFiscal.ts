/**
 * Formação da base fiscal — nunca `IRPJ = lucro contábil × alíquota`
 * (seção 6 do pedido). Fluxo: lucro contábil → adições → exclusões →
 * (compensação tratada em prejuizoFiscal.ts, propositalmente separada —
 * ver seção 7 do pedido) → base fiscal.
 */

import type { AjusteFiscal } from "../../cenarioEmpresa";

export type Tributo = "irpj" | "csll";

export interface ResultadoBaseAjustada {
  lucroContabil: number;
  adicoes: AjusteFiscal[];
  exclusoes: AjusteFiscal[];
  totalAdicoes: number;
  totalExclusoes: number;
  /** Lucro líquido ajustado (antes da compensação de prejuízo) — é sobre ESTE valor que a trava de 30% incide. */
  lucroLiquidoAjustado: number;
  /** false quando NENHUM ajuste foi informado — não significa "sem ajustes reais", ver qualidade.ts. */
  ajustesInformados: boolean;
}

function ajustesDoTributo(ajustes: AjusteFiscal[], tributo: Tributo, tipo: "adicao" | "exclusao"): AjusteFiscal[] {
  return ajustes.filter((a) => a.tipo === tipo && (a.tributoAplicavel === tributo || a.tributoAplicavel === "ambos"));
}

/**
 * `lucroContabilValor` é o lucro contábil do ANO JÁ PROJETADO (a partir
 * de `EconomicoFinanceiroEmpresa.lucroAtual` — campo já existente desde
 * a fundação setorial, reaproveitado como "lucro contábil antes de
 * IRPJ/CSLL", nunca duplicado em um campo novo) — a projeção ano a ano
 * é responsabilidade de quem chama (motor.ts), não deste módulo.
 */
export function calcularBaseAjustada(lucroContabilValor: number, ajustesFiscais: AjusteFiscal[] | undefined, tributo: Tributo): ResultadoBaseAjustada {
  const todosAjustes = ajustesFiscais ?? [];
  const adicoes = ajustesDoTributo(todosAjustes, tributo, "adicao");
  const exclusoes = ajustesDoTributo(todosAjustes, tributo, "exclusao");
  const totalAdicoes = adicoes.reduce((s, a) => s + a.valor, 0);
  const totalExclusoes = exclusoes.reduce((s, a) => s + a.valor, 0);

  return {
    lucroContabil: lucroContabilValor,
    adicoes,
    exclusoes,
    totalAdicoes,
    totalExclusoes,
    lucroLiquidoAjustado: lucroContabilValor + totalAdicoes - totalExclusoes,
    ajustesInformados: todosAjustes.length > 0,
  };
}
