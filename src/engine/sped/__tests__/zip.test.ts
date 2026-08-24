import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { decodificarArquivosOuZip } from "../zip";

function criarArquivoZip(nome: string, entradas: Record<string, string>): File {
  const dados: Record<string, Uint8Array> = {};
  for (const [caminho, conteudo] of Object.entries(entradas)) {
    dados[caminho] = strToU8(conteudo);
  }
  const bytes = zipSync(dados);
  return new File([bytes], nome, { type: "application/zip" });
}

describe("decodificarArquivosOuZip", () => {
  it("expande um .zip em memória e devolve cada .txt como um arquivo próprio", async () => {
    const zip = criarArquivoZip("speds.zip", {
      "EFDICMS.txt": "|0000|conteudo icms|\n",
      "EFDCONTRIB.txt": "|0000|conteudo contrib|\n",
    });
    const resultado = await decodificarArquivosOuZip([zip]);
    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.nomeArquivo)).toEqual(
      expect.arrayContaining(["speds.zip » EFDICMS.txt", "speds.zip » EFDCONTRIB.txt"])
    );
    expect(resultado.find((r) => r.nomeArquivo.includes("EFDICMS"))?.conteudo).toContain("conteudo icms");
  });

  it("ignora pastas, arquivos de sistema (__MACOSX) e extensões não-SPED dentro do zip", async () => {
    const zip = criarArquivoZip("speds.zip", {
      "pasta/": "",
      "__MACOSX/._EFDICMS.txt": "lixo",
      "nota.xml": "<xml/>",
      "EFDICMS.txt": "|0000|conteudo|\n",
    });
    const resultado = await decodificarArquivosOuZip([zip]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nomeArquivo).toContain("EFDICMS.txt");
  });

  it("trata arquivos .txt soltos (fora de zip) normalmente", async () => {
    const arquivoTxt = new File(["|0000|conteudo solto|\n"], "solto.txt", { type: "text/plain" });
    const resultado = await decodificarArquivosOuZip([arquivoTxt]);
    expect(resultado).toEqual([{ nomeArquivo: "solto.txt", conteudo: "|0000|conteudo solto|\n" }]);
  });

  it("mistura .zip e .txt soltos no mesmo envio", async () => {
    const zip = criarArquivoZip("speds.zip", { "A.txt": "|0000|a|\n" });
    const solto = new File(["|0000|b|\n"], "B.txt", { type: "text/plain" });
    const resultado = await decodificarArquivosOuZip([zip, solto]);
    expect(resultado).toHaveLength(2);
  });
});
