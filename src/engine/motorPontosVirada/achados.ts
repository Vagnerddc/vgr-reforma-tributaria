/**
 * Achados estruturados — fatos objetivos sobre a busca, nunca
 * recomendação (seção 50/65 do pedido).
 */

import type { AchadoPontoVirada, TipoPontoVirada } from "./tipos";

const CODIGO_POR_TIPO: Partial<Record<TipoPontoVirada, AchadoPontoVirada["codigo"]>> = {
  mudanca_regime_menor_carga: "MUDANCA_REGIME_MENOR_CARGA",
  mudanca_anexo_simples: "MUDANCA_ANEXO",
  mudanca_elegibilidade: "MUDANCA_ELEGIBILIDADE",
  margem_zero: "MARGEM_ZERO_ENCONTRADA",
};

export function gerarAchadosPontoVirada(tipo: TipoPontoVirada, status: "encontrado" | "nao_encontrado" | "multiplos_pontos", valorEncontrado?: number, quantidadeOutros?: number): AchadoPontoVirada[] {
  const achados: AchadoPontoVirada[] = [];

  if (status === "nao_encontrado") {
    achados.push({ codigo: "PONTO_VIRADA_NAO_ENCONTRADO", valor: 0, descricao: "Nenhuma mudança de estado foi detectada no intervalo informado." });
    return achados;
  }

  if (status === "multiplos_pontos") {
    achados.push({ codigo: "MULTIPLOS_PONTOS_VIRADA", valor: quantidadeOutros ?? 0, descricao: `${quantidadeOutros ?? 0} mudanças de estado detectadas no intervalo — nenhuma foi assumida como "a" fronteira única.` });
    return achados;
  }

  achados.push({ codigo: "PONTO_VIRADA_ENCONTRADO", valor: valorEncontrado ?? 0, descricao: "Ponto de virada localizado e refinado dentro da precisão solicitada." });
  const codigoEspecifico = CODIGO_POR_TIPO[tipo];
  if (codigoEspecifico) achados.push({ codigo: codigoEspecifico, valor: valorEncontrado ?? 0, descricao: `Mudança de estado do tipo "${tipo}" confirmada no valor ${valorEncontrado}.` });

  return achados;
}
