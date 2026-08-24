/**
 * Adapter — converte `ResultadoPontoVirada` (motorPontosVirada) para o
 * contrato universal, SEM RECALCULAR NADA (seção 32/33 do pedido).
 * Preserva estadoAntes/estadoDepois.
 */

import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import type { AchadoEstrategico, CodigoAchadoEstrategico } from "./tipos";

const CODIGO_POR_VARIAVEL: Partial<Record<string, CodigoAchadoEstrategico>> = {
  faturamento: "PONTO_VIRADA_FATURAMENTO",
  creditosIbsCbs: "PONTO_VIRADA_CREDITOS",
  folha: "PONTO_VIRADA_FATOR_R",
  custoCapital: "PONTO_VIRADA_CUSTO_CAPITAL",
  percentualRecebimentosSujeitosSplit: "PONTO_VIRADA_CAPITAL_GIRO",
  percentualTributoSegregadoSplit: "PONTO_VIRADA_CAPITAL_GIRO",
};

export function converterPontoVirada(resultado: ResultadoPontoVirada, ano: number, cenarioId?: string): AchadoEstrategico[] {
  if (resultado.status !== "encontrado" || resultado.valorEncontrado === undefined) return [];

  const codigo = CODIGO_POR_VARIAVEL[resultado.variavel] ?? "PONTO_VIRADA_GENERICO";
  const antes = resultado.estadoAntes?.estadoCategorico;
  const depois = resultado.estadoDepois?.estadoCategorico;

  return [
    {
      id: `ponto_virada:${resultado.tipo}:${resultado.variavel}:${ano}`,
      codigo,
      categoria: "ponto_virada",
      tituloTecnico: `Ponto de virada — ${resultado.tipo}`,
      descricaoTecnica: `No valor ${resultado.valorEncontrado.toFixed(2)} da variável "${resultado.variavel}", o estado muda${antes ? ` de "${antes}"` : ""}${depois ? ` para "${depois}"` : ""} (precisão: ${resultado.precisao}).`,
      valor: resultado.valorEncontrado,
      periodo: { ano },
      cenarioId,
      evidencias: [
        { origem: "motor_pontos_virada", referencia: `ResultadoPontoVirada.${resultado.tipo}.${resultado.variavel}.valorEncontrado`, valor: resultado.valorEncontrado },
        ...(antes ? [{ origem: "motor_pontos_virada" as const, referencia: `estadoAntes: ${antes}` }] : []),
        ...(depois ? [{ origem: "motor_pontos_virada" as const, referencia: `estadoDepois: ${depois}` }] : []),
      ],
      qualidade: resultado.qualidade,
      premissas: resultado.premissas as AchadoEstrategico["premissas"],
      origens: ["classificacao_vgr"],
      status: resultado.qualidade === "alta" ? "confirmado" : "estimado",
    },
  ];
}
