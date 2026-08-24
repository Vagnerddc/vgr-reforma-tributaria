import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensPareto(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const otimizacao = analise.otimizacao;
  if (!otimizacao) return [];

  // Ordem preservada tal como produzida pelo motor — nunca numerada como ranking (seção 30).
  return otimizacao.fronteiraPareto.map((pontoFronteira, indice) => {
    const ponto = pontoFronteira.ponto;
    const id = `pareto:${analise.ano}:${String(indice).padStart(2, "0")}`;
    const bloqueioTexto = ponto.bloqueadoJuridicamente ? ` Bloqueado juridicamente: ${ponto.motivoBloqueio ?? NAO_INFORMADO}.` : "";

    return {
      id,
      codigo: id,
      categoria: "otimizacao",
      titulo: "Configuração eficiente (fronteira de Pareto)",
      descricao: `Variáveis avaliadas: ${JSON.stringify(ponto.valoresVariaveis)}. Objetivos considerados: ${otimizacao.objetivos.join(", ")}.${bloqueioTexto}`,
      periodo: { ano: analise.ano },
      origemResultado: "motor_otimizacao",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "otimizacaoMultidimensional",
      metodologia: otimizacao.metodologiaId,
      metodologiaVersao: otimizacao.metodologiaVersao,
      status: ponto.bloqueadoJuridicamente ? "indisponivel" : "calculado",
      qualidade: NAO_INFORMADO,
      premissas: [],
      evidencias: [],
      fundamentos: [],
      dependencias: [],
      limitacoes: ponto.motivoBloqueio ? [ponto.motivoBloqueio] : [],
    };
  });
}
