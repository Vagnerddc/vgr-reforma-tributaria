import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica, StatusItemMemoria } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

function mapStatus(status: string): StatusItemMemoria {
  if (status === "concluida") return "calculado";
  if (status === "nao_aplicavel") return "nao_aplicavel";
  if (status === "bloqueada") return "indisponivel";
  return "parcial";
}

export function construirItensPlano(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const plano = analise.planoAcao;
  if (!plano) return [];

  return plano.acoes.map((acao) => {
    const id = `plano:${acao.codigo}:${acao.id}`;
    return {
      id,
      codigo: acao.codigo,
      categoria: "plano_acao",
      titulo: acao.titulo,
      descricao: `${acao.descricaoTecnica} Critério de conclusão: ${acao.criterioConclusao}. Responsabilidade sugerida: ${acao.responsabilidadeSugerida.join(", ") || NAO_INFORMADO}.`,
      periodo: acao.periodoAplicavel,
      origemResultado: "motor_plano_acao",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "planoAcao",
      status: mapStatus(acao.status),
      qualidade: acao.qualidade,
      premissas: Object.keys(acao.premissas ?? {}),
      evidencias: acao.evidencias.map((e) => e.descricao),
      fundamentos: [],
      dependencias: acao.dependeDe,
      limitacoes: [...acao.bloqueios.map((b) => b.descricao), ...acao.condicoes],
    };
  });
}
