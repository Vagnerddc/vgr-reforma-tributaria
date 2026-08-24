import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { parseTextoDre, type DadosDrePdf } from "./parseTextoDre";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extrai o texto de um PDF de DRE (ex.: gerado pelo Domínio Sistemas) direto
 * no navegador — nenhum arquivo sai da máquina do usuário, mesmo princípio
 * do import de SPED. Linhas são reconstruídas por posição vertical (Y) dos
 * itens de texto do PDF, já que pdfjs devolve fragmentos, não linhas prontas.
 */
async function extrairTextoPdf(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: buffer }).promise;
  const linhasPorPagina: string[] = [];

  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina);
    const conteudo = await pagina.getTextContent();
    const porY = new Map<number, string[]>();
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const linha = porY.get(y) ?? [];
      linha.push(item.str);
      porY.set(y, linha);
    }
    const linhasOrdenadas = Array.from(porY.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, textos]) => textos.join(" "));
    linhasPorPagina.push(linhasOrdenadas.join("\n"));
  }

  return linhasPorPagina.join("\n");
}

export async function extrairDadosDrePdf(arquivo: File): Promise<DadosDrePdf> {
  const texto = await extrairTextoPdf(arquivo);
  return parseTextoDre(texto);
}
