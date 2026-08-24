import type { RegistroSped } from "./tipos";

/**
 * Tokeniza um arquivo SPED (texto delimitado por "|", uma linha por registro,
 * primeiro e último campo vazios por convenção: "|0000|...|"). Ignora linhas
 * vazias. Não valida a hierarquia de blocos — cada extrator específico lê só
 * os registros que precisa, na ordem em que aparecem.
 */
export function tokenizarSped(conteudo: string): RegistroSped[] {
  const linhas = conteudo.split(/\r?\n/);
  const registros: RegistroSped[] = [];
  for (const linhaBruta of linhas) {
    const linha = linhaBruta.trim();
    if (!linha) continue;
    const partes = linha.split("|");
    // remove o primeiro e o último elemento (vazios, resultantes do pipe inicial/final)
    const campos = partes.slice(1, partes.length - 1);
    if (campos.length === 0) continue;
    const [reg, ...resto] = campos;
    registros.push({ reg, campos: resto });
  }
  return registros;
}

/** Converte um número no formato SPED ("1234,56" ou "1234.56" ou vazio) para float. */
export function numeroSped(valor: string | undefined): number {
  if (!valor) return 0;
  const normalizado = valor.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Decodifica bytes de um arquivo SPED. O padrão oficial é ISO-8859-1
 * (Latin-1) sem BOM; arquivos mais novos de ECD/ECF às vezes saem em UTF-8.
 * Tenta ISO-8859-1 primeiro (padrão do leiaute) e cai para UTF-8 se o
 * resultado tiver muitos caracteres de substituição.
 */
export function decodificarBytesSped(bytes: Uint8Array): string {
  const textoLatin1 = new TextDecoder("iso-8859-1").decode(bytes);
  const textoUtf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const contagemSubstituicaoUtf8 = (textoUtf8.match(/�/g) ?? []).length;
  return contagemSubstituicaoUtf8 > 0 ? textoLatin1 : textoUtf8;
}

/** Decodifica o conteúdo de um arquivo SPED (.txt) a partir de um File do navegador. */
export async function decodificarArquivoSped(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  return decodificarBytesSped(new Uint8Array(buffer));
}

/** Identifica o tipo de arquivo SPED pelo registro 0000 (campo LAYOUT/COD_VER não é suficiente sozinho — usa o conjunto de registros presentes). */
export function identificarTipoArquivo(registros: RegistroSped[]): "efd_icms_ipi" | "efd_contribuicoes" | "ecd" | "ecf" | null {
  const regs = new Set(registros.map((r) => r.reg));
  if (regs.has("I050") || regs.has("I051") || regs.has("J100")) return "ecd";
  if (regs.has("M300") || regs.has("Y540") || (regs.has("0000") && regs.has("X280"))) return "ecf";
  if (regs.has("M200") || regs.has("M600") || regs.has("A100")) return "efd_contribuicoes";
  if (regs.has("E110") || regs.has("C190")) return "efd_icms_ipi";
  return null;
}
