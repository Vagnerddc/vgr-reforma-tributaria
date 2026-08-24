import { unzipSync } from "fflate";

export interface ArquivoXmlDecodificado {
  nomeArquivo: string;
  conteudo: string;
}

const decodificadorUtf8 = new TextDecoder("utf-8", { fatal: false });

function deveIgnorar(nome: string): boolean {
  if (nome.endsWith("/")) return true;
  const base = nome.split("/").pop() ?? nome;
  if (base.startsWith(".") || base.startsWith("__MACOSX")) return true;
  return !base.toLowerCase().endsWith(".xml");
}

function expandirZip(nomeZip: string, bytes: Uint8Array): ArquivoXmlDecodificado[] {
  const entradas = unzipSync(bytes);
  const arquivos: ArquivoXmlDecodificado[] = [];
  for (const [caminho, dados] of Object.entries(entradas)) {
    if (deveIgnorar(caminho)) continue;
    const nomeBase = caminho.split("/").pop() ?? caminho;
    arquivos.push({ nomeArquivo: `${nomeZip} » ${nomeBase}`, conteudo: decodificadorUtf8.decode(dados) });
  }
  return arquivos;
}

/**
 * Expansão de .zip específica para XML — deliberadamente separada de
 * sped/zip.ts (que hoje ignora .xml de propósito, por ser um utilitário
 * SPED). NF-e é sempre UTF-8 (padrão do leiaute), diferente do SPED
 * (ISO-8859-1) — por isso não reaproveita decodificarBytesSped.
 */
export async function decodificarArquivosXmlOuZip(arquivos: File[]): Promise<ArquivoXmlDecodificado[]> {
  const resultado: ArquivoXmlDecodificado[] = [];
  for (const arquivo of arquivos) {
    const buffer = await arquivo.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (arquivo.name.toLowerCase().endsWith(".zip")) {
      resultado.push(...expandirZip(arquivo.name, bytes));
    } else if (arquivo.name.toLowerCase().endsWith(".xml")) {
      resultado.push({ nomeArquivo: arquivo.name, conteudo: decodificadorUtf8.decode(bytes) });
    }
  }
  return resultado;
}
