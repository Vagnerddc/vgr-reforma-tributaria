import type { OpcoesAnaliseEstrategica } from "../../application/analiseEstrategica/tipos";
import type { RascunhoCenarioEmpresa } from "./tipos";
import { motoresParaRegimes } from "./motores";

/** Traduz o rascunho nas opções de `executarAnaliseEstrategica` — nunca inventa limite/premissa que o usuário não informou. */
export function construirOpcoesExecucao(rascunho: RascunhoCenarioEmpresa): OpcoesAnaliseEstrategica {
  const motoresRegime = motoresParaRegimes(rascunho.regimesSelecionados);
  const ano = rascunho.ano ?? new Date().getFullYear();
  const regimeBase = rascunho.regimesSelecionados[0];
  const motorBase = motoresRegime[0];

  return {
    ano: rascunho.ano,
    motoresRegime,
    incluirHorizonte: rascunho.incluirHorizonte,
    premissasSplit: rascunho.analisarCaixa ? rascunho.premissasSplit : undefined,
    pontosVirada: rascunho.pontosVirada.length > 0 ? rascunho.pontosVirada : undefined,
    otimizacao:
      rascunho.otimizacao.habilitada && rascunho.otimizacao.variaveis.length > 0 && regimeBase && motorBase
        ? { motorRegime: motorBase, regime: regimeBase, ano, variaveis: rascunho.otimizacao.variaveis, objetivos: rascunho.otimizacao.objetivos }
        : undefined,
  };
}
