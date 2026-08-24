import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { PerdaAdaptacaoLegado } from "../../analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensExecucao(analise: AnaliseEstrategicaCompleta, perdasLegado?: PerdaAdaptacaoLegado[]): ItemMemoriaTecnica[] {
  const itens: ItemMemoriaTecnica[] = [];
  const auditoria = analise.auditoriaExecucao;

  const idResumo = "execucao:resumo";
  itens.push({
    id: idResumo,
    codigo: idResumo,
    categoria: "execucao",
    titulo: "Execução da análise",
    descricao: `Etapas executadas: ${auditoria.etapasExecutadas.join(", ") || "nenhuma"}. Etapas indisponíveis: ${auditoria.etapasIndisponiveis.join(", ") || "nenhuma"}.`,
    valor: auditoria.duracaoMs,
    unidade: "ms",
    origemResultado: "orquestrador_execucao",
    origemInformacao: NAO_INFORMADO,
    origemCalculo: NAO_INFORMADO,
    motor: "orquestradorAnaliseEstrategica",
    status: auditoria.erros.length > 0 ? "parcial" : "calculado",
    qualidade: NAO_INFORMADO,
    premissas: [],
    evidencias: [],
    fundamentos: [],
    dependencias: [],
    limitacoes: auditoria.erros.map((erro) => `${erro.etapa}: ${erro.mensagem}`),
  });

  (perdasLegado ?? []).forEach((perda, indice) => {
    const id = `legado:perda:${String(indice).padStart(2, "0")}`;
    itens.push({
      id,
      codigo: id,
      categoria: "execucao",
      titulo: `Limitação do adapter legado — ${perda.campo}`,
      descricao: perda.motivo,
      origemResultado: "adapter_legado",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "adapterLegadoParaCenarioEmpresa",
      status: "indisponivel",
      qualidade: NAO_INFORMADO,
      premissas: [],
      evidencias: [],
      fundamentos: [],
      dependencias: [],
      limitacoes: [perda.motivo],
    });
  });

  return itens;
}
