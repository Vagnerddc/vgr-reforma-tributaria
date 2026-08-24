import { processarEcd } from "../../../engine/sped/ecd";
import { empacotarArquivoSped } from "./spedComum";
import type { ResultadoIngestaoDocumento } from "../tipos";

export function ingerirEcd(nomeArquivo: string, conteudo: string, documentoId: string): ResultadoIngestaoDocumento {
  const arquivo = processarEcd(nomeArquivo, conteudo);
  return empacotarArquivoSped(arquivo, documentoId);
}
