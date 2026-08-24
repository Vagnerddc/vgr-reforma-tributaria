/**
 * Empacotamento comum para os wrappers de EFD ICMS/IPI, EFD-Contribuições, ECD
 * e ECF — todos chamam um parser já existente em `engine/sped/` e só reempacotam
 * o `ArquivoSpedProcessado` resultante em `ResultadoIngestaoDocumento`. Nenhum
 * wrapper recalcula nada; a reconciliação de movimentos/saldos em campos do
 * rascunho é responsabilidade do agregador (Bloco J), que consome
 * `ArquivoSpedProcessado` completo via `metadados.arquivoSpedProcessado`.
 */
import type { ArquivoSpedProcessado, TipoArquivoSped } from "../../../engine/sped/tipos";
import type { CampoExtraido, ResultadoIngestaoDocumento, TipoDocumento } from "../tipos";
import { campoExtraido } from "../tipos";

const TIPO_SPED_PARA_DOCUMENTO: Record<TipoArquivoSped, TipoDocumento> = {
  efd_icms_ipi: "efd_icms_ipi",
  efd_contribuicoes: "efd_contribuicoes",
  ecd: "ecd",
  ecf: "ecf",
};

export function empacotarArquivoSped(arquivo: ArquivoSpedProcessado, documentoId: string): ResultadoIngestaoDocumento {
  const tipoDocumento = TIPO_SPED_PARA_DOCUMENTO[arquivo.tipo];
  const periodo = arquivo.periodoInicio && arquivo.periodoFim ? `${arquivo.periodoInicio}_${arquivo.periodoFim}` : arquivo.periodoInicio;

  const campos: CampoExtraido<unknown>[] = [];
  const ctx = { documentoId, tipoDocumento, periodo };

  if (arquivo.receitaConsolidada !== undefined) {
    campos.push(campoExtraido(arquivo.receitaConsolidada, "confirmado", { ...ctx, evidencia: "F500/F550 — receita consolidada", observacao: "receitaConsolidada" }));
  }
  for (const apuracao of arquivo.apuracoes) {
    campos.push(campoExtraido(apuracao.valorRecolher, "confirmado", { ...ctx, periodo: apuracao.periodo, evidencia: `apuração ${apuracao.tributo}`, observacao: `apuracao.${apuracao.tributo}` }));
  }

  const status: ResultadoIngestaoDocumento["status"] = arquivo.avisos.length > 0 ? "processado_com_ressalvas" : "processado";

  return {
    documentoId,
    tipoDocumento,
    periodo,
    status,
    camposExtraidos: campos,
    alertas: arquivo.avisos.map((mensagem) => ({ codigo: "aviso_parser_sped", mensagem, gravidade: "info" as const })),
    inconsistencias: [],
    limitacoes: [],
    metadados: {
      nomeArquivo: arquivo.nomeArquivo,
      processadoEm: new Date().toISOString(),
      arquivoSpedProcessado: arquivo,
    },
  };
}
