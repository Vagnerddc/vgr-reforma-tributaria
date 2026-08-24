import { processarEfdIcmsIpi } from "../../../engine/sped/efdIcmsIpi";
import { empacotarArquivoSped } from "./spedComum";
import type { ResultadoIngestaoDocumento } from "../tipos";

export function ingerirEfdIcmsIpi(nomeArquivo: string, conteudo: string, documentoId: string): ResultadoIngestaoDocumento {
  const arquivo = processarEfdIcmsIpi(nomeArquivo, conteudo);
  return empacotarArquivoSped(arquivo, documentoId);
}
