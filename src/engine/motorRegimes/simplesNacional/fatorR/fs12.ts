/**
 * FS12 — "folha de salários incluídos encargos" (LC 123/2006, art. 18,
 * §§24/25, com redação da LC 155/2016): salários pagos a empregados e
 * trabalhadores temporários (incluído 13º), retiradas de PRÓ-LABORE de
 * contribuintes individuais, contribuição patronal previdenciária (CPP)
 * efetivamente recolhida e FGTS efetivamente recolhido — TUDO nos 12
 * meses anteriores ao período de apuração. Confirmado por busca externa
 * nesta fase (ver docs/motor-fator-r.md, seção L).
 *
 * NUNCA inclui (seção 6 do pedido, confirmado normativamente): pagamentos
 * a pessoa jurídica (médicos PJ, terceirizados, prestadores PJ),
 * autônomos fora da relação de contribuinte individual computável, nem
 * distribuição de lucros.
 */

import type { PessoasEmpresa } from "../../../cenarioEmpresa";
import type { StatusInformacao } from "../../../operacaoTributaria";

export interface ResultadoFs12Anual {
  /** undefined = indeterminada — nenhum componente computável foi informado. */
  valor: number | undefined;
  componentesConsiderados: string[];
  componentesAusentes: string[];
  status: StatusInformacao;
}

/**
 * Calcula a FS12 ANUAL (antes de qualquer rolagem mensal — ver
 * fs12Mensal.ts) a partir de `CenarioEmpresa.pessoas`. `folhaAnual` e
 * `encargosAnual` são tratados como proxy dos salários+13º e de
 * CPP+FGTS respectivamente — `CenarioEmpresa` não os separa em campos
 * distintos; isso é uma aproximação documentada, não uma segregação
 * normativa exata (ver limitações).
 */
export function calcularFs12Anual(pessoas: PessoasEmpresa): ResultadoFs12Anual {
  const considerados: string[] = [];
  const ausentes: string[] = [];
  let total = 0;
  let algumPresente = false;
  const statusEncontrados: StatusInformacao[] = [];

  if (pessoas.folhaAnual !== undefined) {
    total += pessoas.folhaAnual.valor;
    considerados.push("folhaAnual (salários e 13º)");
    statusEncontrados.push(pessoas.folhaAnual.status);
    algumPresente = true;
  } else {
    ausentes.push("folhaAnual");
  }

  if (pessoas.encargosAnual !== undefined) {
    total += pessoas.encargosAnual.valor;
    considerados.push("encargosAnual (proxy de CPP + FGTS efetivamente recolhidos)");
    statusEncontrados.push(pessoas.encargosAnual.status);
    algumPresente = true;
  } else {
    ausentes.push("encargosAnual");
  }

  if (pessoas.proLaboreAnual !== undefined) {
    total += pessoas.proLaboreAnual.valor;
    considerados.push("proLaboreAnual (retiradas de pró-labore)");
    statusEncontrados.push(pessoas.proLaboreAnual.status);
    algumPresente = true;
  } else {
    ausentes.push("proLaboreAnual");
  }

  // terceirosAutonomosAnual É DELIBERADAMENTE EXCLUÍDO — pagamento a PJ/terceirizado/autônomo
  // fora da relação de contribuinte individual não compõe a FS12 (LC 123/2006, art. 18, §25,
  // c/c art. 32, IV, da Lei 8.212/1991).

  if (!algumPresente) {
    return { valor: undefined, componentesConsiderados: [], componentesAusentes: ["folhaAnual", "encargosAnual", "proLaboreAnual"], status: "importado" };
  }

  const status: StatusInformacao = statusEncontrados.includes("estimado") ? "estimado" : statusEncontrados.every((s) => s === "confirmado") ? "confirmado" : "estimado";
  return { valor: total, componentesConsiderados: considerados, componentesAusentes: ausentes, status };
}
