import { unzipSync } from "fflate";
import { decodificarBytesSped } from "./parser";

export interface ArquivoDecodificado {
  nomeArquivo: string;
  conteudo: string;
}

const EXTENSOES_IGNORADAS = [".pdf", ".jpg", ".jpeg", ".png", ".xml", ".xlsx", ".doc", ".docx"];

function deveIgnorar(nome: string): boolean {
  if (nome.endsWith("/")) return true; // diretório
  const nomeBase = nome.split("/").pop() ?? nome;
  if (nomeBase.startsWith(".") || nomeBase.startsWith("__MACOSX")) return true;
  return EXTENSOES_IGNORADAS.some((ext) => nomeBase.toLowerCase().endsWith(ext));
}

/** Expande um .zip em memória para a lista de arquivos de texto contidos (ignora pastas, imagens e outros formatos não-SPED). */
function expandirZip(nomeZip: string, bytes: Uint8Array): ArquivoDecodificado[] {
  const entradas = unzipSync(bytes);
  const arquivos: ArquivoDecodificado[] = [];
  for (const [caminho, dados] of Object.entries(entradas)) {
    if (deveIgnorar(caminho)) continue;
    const nomeBase = caminho.split("/").pop() ?? caminho;
    arquivos.push({ nomeArquivo: `${nomeZip} » ${nomeBase}`, conteudo: decodificarBytesSped(dados) });
  }
  return arquivos;
}

/**
 * Decodifica uma lista de Files vindos do input de upload — arquivos .zip são
 * expandidos automaticamente (um .zip pode conter vários .txt de SPED); os
 * demais são tratados como .txt direto. Tudo em memória, no navegador.
 */
export async function decodificarArquivosOuZip(arquivos: File[]): Promise<ArquivoDecodificado[]> {
  const resultado: ArquivoDecodificado[] = [];
  for (const arquivo of arquivos) {
    const buffer = await arquivo.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (arquivo.name.toLowerCase().endsWith(".zip")) {
      resultado.push(...expandirZip(arquivo.name, bytes));
    } else {
      resultado.push({ nomeArquivo: arquivo.name, conteudo: decodificarBytesSped(bytes) });
    }
  }
  return resultado;
}
