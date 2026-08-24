/**
 * Adapter de Folha/FS12 — entrada é um resumo ESTRUTURADO já preenchido pelo
 * usuário/contador (formulário simples na UI), não um parser de arquivo de
 * eSocial (fora de escopo nesta fase, docs/ingestao-documental-v2.md §M).
 *
 * Regras que este adapter NUNCA quebra:
 * - Nunca converte terceiros/autônomos automaticamente em FS12.
 * - Nunca gera/sugere pró-labore — só existe se vier explicitamente no resumo.
 */
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento } from "../tipos";

export interface ResumoFolhaEstruturado {
  periodo: string;
  numeroEmpregados?: number;
  folhaBruta?: number;
  encargos?: number;
  proLaboreDeclarado?: number;
}

export function ingerirResumoFolha(resumo: ResumoFolhaEstruturado, documentoId: string): ResultadoIngestaoDocumento {
  const ctx = { documentoId, tipoDocumento: "folha_fs12" as const, periodo: resumo.periodo, evidencia: "resumo de folha informado pelo contador" };
  const campos = [];

  if (resumo.numeroEmpregados !== undefined) campos.push(campoExtraido(resumo.numeroEmpregados, "confirmado", { ...ctx, observacao: "numeroEmpregados" }));
  if (resumo.folhaBruta !== undefined) campos.push(campoExtraido(resumo.folhaBruta, "confirmado", { ...ctx, observacao: "folhaAnual" }));
  if (resumo.encargos !== undefined) campos.push(campoExtraido(resumo.encargos, "confirmado", { ...ctx, observacao: "encargosAnual" }));
  if (resumo.proLaboreDeclarado !== undefined) campos.push(campoExtraido(resumo.proLaboreDeclarado, "confirmado", { ...ctx, observacao: "proLaboreAnual" }));

  return {
    documentoId,
    tipoDocumento: "folha_fs12",
    periodo: resumo.periodo,
    status: campos.length > 0 ? "processado" : "falhou",
    camposExtraidos: campos,
    alertas: [],
    inconsistencias: campos.length === 0 ? [{ campo: "resumoFolha", mensagem: "Nenhum valor informado no resumo de folha.", gravidade: "atencao" }] : [],
    limitacoes: [
      { descricao: "Entrada é um resumo estruturado informado manualmente — não há importador de eSocial nesta fase." },
      { descricao: "Terceiros/autônomos nunca são convertidos automaticamente em FS12; pró-labore nunca é sugerido/calculado — só o que vier explícito no resumo." },
    ],
    metadados: { nomeArquivo: `resumo-folha-${documentoId}`, processadoEm: new Date().toISOString() },
  };
}
