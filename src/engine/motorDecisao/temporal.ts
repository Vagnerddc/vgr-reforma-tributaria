/**
 * Consolidação do horizonte (seção 27-30 do pedido) — uma preferência
 * pode mudar ao longo de 2026-2033; nunca forçada a um único valor.
 * Reaproveita `decidirRegimeTributario` ano a ano, nunca uma segunda
 * lógica de comparação.
 */

import { ANOS_SIMULACAO } from "../parametros";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import { decidirRegimeTributario, type OpcoesDecisaoRegime } from "./regime";
import type { ConclusaoHorizonte, DecisaoPorPeriodo, HorizonteDecisao, TransicaoHorizonte } from "./tipos";

export function decidirRegimeTributarioNoHorizonte(resultado: ResultadoCenario, opcoes: Omit<OpcoesDecisaoRegime, "ano">): HorizonteDecisao {
  const decisoesPorAno: DecisaoPorPeriodo[] = ANOS_SIMULACAO.map((ano) => {
    const decisao = decidirRegimeTributario(resultado, { ...opcoes, ano });
    return { ano, statusConclusao: decisao.statusConclusao, alternativaPreferida: decisao.alternativaPreferida };
  });

  const transicoes: TransicaoHorizonte[] = [];
  for (let i = 1; i < decisoesPorAno.length; i++) {
    const antes = decisoesPorAno[i - 1];
    const depois = decisoesPorAno[i];
    if (antes.alternativaPreferida !== depois.alternativaPreferida) {
      transicoes.push({ anoAntes: antes.ano, anoDepois: depois.ano, alternativaAntes: antes.alternativaPreferida, alternativaDepois: depois.alternativaPreferida });
    }
  }

  const preferenciasDefinidas = decisoesPorAno.filter((d) => d.alternativaPreferida !== undefined);
  let conclusaoHorizonte: ConclusaoHorizonte;
  if (preferenciasDefinidas.length === 0) {
    conclusaoHorizonte = "sem_preferencia_unica";
  } else if (transicoes.length === 0 && preferenciasDefinidas.length === decisoesPorAno.length) {
    conclusaoHorizonte = "preferencia_estavel_no_horizonte";
  } else {
    conclusaoHorizonte = "preferencia_muda_no_horizonte";
  }

  return { decisoesPorAno, conclusaoHorizonte, transicoes };
}
