/**
 * Adapter de XML (NF-e) — wrapper fino de `engine/xml/lote.ts`. NÃO reimplementa
 * parser nem deduplicação: `processarLoteXml` já deduplica por id estável e já
 * não aborta o lote em erro de item (docs/ingestao-documental-v2.md §H/§F).
 */
import { processarLoteXml } from "../../../engine/xml/lote";
import type { OperacaoTributariaNormalizada } from "../../../engine/operacaoTributaria";
import type { ResultadoIngestaoDocumento, AlertaIngestao, InconsistenciaIngestao } from "../tipos";

export interface ResultadoIngestaoXml {
  resultado: ResultadoIngestaoDocumento;
  /** Operações já deduplicadas — a camada de agregação (Bloco J) as anexa diretamente a `tributario.operacoes`, sem convertê-las em `CampoExtraido` escalar (não fazem sentido como campo único). */
  operacoes: OperacaoTributariaNormalizada[];
}

export function ingerirLoteXml(arquivos: { nomeArquivo: string; conteudo: string }[], documentoId = "lote-xml-nfe"): ResultadoIngestaoXml {
  const relatorio = processarLoteXml(arquivos);

  const alertas: AlertaIngestao[] = [];
  if (relatorio.duplicadosIgnorados > 0) {
    alertas.push({ codigo: "xml_duplicados_ignorados", mensagem: `${relatorio.duplicadosIgnorados} item(ns) duplicado(s) ignorado(s) no lote.`, gravidade: "info" });
  }

  const inconsistencias: InconsistenciaIngestao[] = relatorio.documentosComErro.map((erro) => ({
    campo: erro.nomeArquivo,
    mensagem: erro.detalhe,
    gravidade: erro.motivo === "erro_parse" ? "atencao" : "info",
  }));

  const status: ResultadoIngestaoDocumento["status"] = relatorio.documentosProcessados === 0 ? "falhou" : relatorio.documentosComErro.length > 0 ? "processado_com_ressalvas" : "processado";

  return {
    resultado: {
      documentoId,
      tipoDocumento: "xml_nfe",
      status,
      camposExtraidos: [],
      alertas,
      inconsistencias,
      limitacoes: [],
      metadados: {
        nomeArquivo: `${arquivos.length} arquivo(s)`,
        processadoEm: new Date().toISOString(),
        documentosProcessados: relatorio.documentosProcessados,
        documentosComErro: relatorio.documentosComErro.length,
        duplicadosIgnorados: relatorio.duplicadosIgnorados,
      },
    },
    operacoes: relatorio.operacoes,
  };
}
