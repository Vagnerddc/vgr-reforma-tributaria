import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensDecisao(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const decisao = analise.decisao;
  if (!decisao) return [];

  const id = `decisao:${analise.ano}`;
  const naturezaTexto = decisao.naturezaConclusao ?? NAO_INFORMADO;
  const alternativaTexto = decisao.alternativaPreferida ? ` Alternativa preferida: ${decisao.alternativaPreferida}.` : "";

  return [
    {
      id,
      codigo: id,
      categoria: "decisao",
      titulo: "Decisão estratégica",
      descricao: `Status: ${decisao.statusConclusao}. Natureza: ${naturezaTexto}.${alternativaTexto} ${decisao.justificativaEstruturada}`.trim(),
      periodo: { ano: analise.ano },
      origemResultado: "motor_decisao",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "motorDecisao",
      status: decisao.statusConclusao === "sem_conclusao" || decisao.statusConclusao === "dados_insuficientes" ? "indisponivel" : "calculado",
      qualidade: decisao.qualidade,
      premissas: Object.keys(decisao.premissas ?? {}),
      evidencias: [...decisao.evidenciasFavoraveis.map((e) => `Favorável: ${e.descricao}`), ...decisao.evidenciasContrarias.map((e) => `Contrária: ${e.descricao}`)],
      fundamentos: [],
      dependencias: [],
      limitacoes: [...decisao.bloqueios.map((b) => b.descricao), ...decisao.condicoes.map((c) => c.descricao), ...decisao.conflitos],
    },
  ];
}
