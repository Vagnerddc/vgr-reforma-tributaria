import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica, StatusItemMemoria } from "../tipos";
import { NAO_INFORMADO } from "../tipos";
import { VGR_SCORE_V1 } from "../../../engine/scoreEstrategico/metodologia";

function mapStatus(status: string): StatusItemMemoria {
  if (status === "calculado") return "calculado";
  if (status === "nao_aplicavel") return "nao_aplicavel";
  if (status === "bloqueado") return "indisponivel";
  return "parcial";
}

export function construirItensScore(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const itens: ItemMemoriaTecnica[] = [];

  for (const score of analise.scores ?? []) {
    const id = `score:${score.alternativaId}:${analise.ano}`;
    itens.push({
      id,
      codigo: id,
      categoria: "score",
      titulo: `Score estratégico — ${score.regime ?? score.alternativaId}`,
      descricao: `Score consolidado calculado pela metodologia ${VGR_SCORE_V1.id} ${VGR_SCORE_V1.versao} para a alternativa ${score.alternativaId}.`,
      valor: score.scoreConsolidado,
      unidade: "pontos",
      periodo: { ano: analise.ano },
      regime: score.regime,
      origemResultado: "motor_score",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "scoreEstrategico",
      metodologia: VGR_SCORE_V1.id,
      metodologiaVersao: VGR_SCORE_V1.versao,
      status: mapStatus(score.statusConsolidado),
      qualidade: score.qualidade,
      premissas: Object.keys(score.premissas ?? {}),
      evidencias: score.evidencias.map((e) => e.descricao),
      fundamentos: [],
      dependencias: score.dimensoes.map((d) => `score:${score.alternativaId}:${analise.ano}:${d.dimensao}`),
      limitacoes: score.alertas ?? [],
    });

    for (const dimensao of score.dimensoes) {
      const idDim = `score:${score.alternativaId}:${analise.ano}:${dimensao.dimensao}`;
      const peso = VGR_SCORE_V1.pesos[dimensao.dimensao];
      itens.push({
        id: idDim,
        codigo: idDim,
        categoria: "score",
        titulo: `Dimensão de score — ${dimensao.dimensao}`,
        descricao: `Peso utilizado na metodologia ${VGR_SCORE_V1.id} ${VGR_SCORE_V1.versao}: ${peso}. Cobertura: ${dimensao.cobertura}.`,
        valor: dimensao.valor,
        unidade: "pontos",
        periodo: { ano: analise.ano },
        regime: score.regime,
        origemResultado: "motor_score",
        origemInformacao: NAO_INFORMADO,
        origemCalculo: NAO_INFORMADO,
        motor: "scoreEstrategico",
        metodologia: VGR_SCORE_V1.id,
        metodologiaVersao: VGR_SCORE_V1.versao,
        status: mapStatus(dimensao.status),
        qualidade: dimensao.qualidade,
        premissas: Object.keys(dimensao.premissas ?? {}),
        evidencias: dimensao.evidencias.map((e) => e.descricao),
        fundamentos: [],
        dependencias: [id],
        limitacoes: dimensao.limitacoes ?? [],
      });
    }
  }

  return itens;
}
