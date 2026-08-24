import { processarEfdContribuicoes } from "../../../engine/sped/efdContribuicoes";
import { empacotarArquivoSped } from "./spedComum";
import type { ResultadoIngestaoDocumento } from "../tipos";

export function ingerirEfdContribuicoes(nomeArquivo: string, conteudo: string, documentoId: string): ResultadoIngestaoDocumento {
  const arquivo = processarEfdContribuicoes(nomeArquivo, conteudo);
  return empacotarArquivoSped(arquivo, documentoId);
}
