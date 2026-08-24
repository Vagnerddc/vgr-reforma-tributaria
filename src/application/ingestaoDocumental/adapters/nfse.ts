/**
 * Adapter de NFS-e — contrato preparado, sem implementação real (docs/ingestao-
 * documental-v2.md §I). Não existe hoje um layout nacional único de NFS-e (cada
 * município tem seu próprio padrão/ABRASF parcialmente adotado); inventar um
 * parser sem referência real seria fabricar cobertura que não existe. Mantém a
 * mesma assinatura de `ingerirLoteXml` para o roteador/UI poderem tratar os dois
 * adapters de forma uniforme quando um parser real for implementado.
 */
import type { ResultadoIngestaoDocumento } from "../tipos";

export interface ResultadoIngestaoNfse {
  resultado: ResultadoIngestaoDocumento;
}

export function ingerirLoteNfse(arquivos: { nomeArquivo: string; conteudo: string }[], documentoId = "lote-nfse"): ResultadoIngestaoNfse {
  return {
    resultado: {
      documentoId,
      tipoDocumento: "nfse",
      status: "falhou",
      camposExtraidos: [],
      alertas: [],
      inconsistencias: [],
      limitacoes: [{ descricao: "Parser de NFS-e não implementado nesta fase — não há referência de layout nacional único (cada município adota um padrão próprio)." }],
      metadados: { nomeArquivo: `${arquivos.length} arquivo(s)`, processadoEm: new Date().toISOString() },
    },
  };
}
