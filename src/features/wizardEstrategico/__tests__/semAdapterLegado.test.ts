import { describe, it, expect } from "vitest";

const TERMOS_PROIBIDOS = ["legadoParaCenarioEmpresa", "DadosApuradosCliente", "ClienteDataContext", "useClienteData"];

const arquivosFonte = import.meta.glob("../**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

describe("93 — Wizard Estratégico V2 não depende do adapter legado", () => {
  it("nenhum arquivo de src/features/wizardEstrategico importa o adapter legado, DadosApuradosCliente ou ClienteDataContext", () => {
    // Arquivos de teste (ex.: persistenciaAnalise.test.ts) legitimamente importam o adapter legado para
    // verificar que ELE continua intacto (seção 74/75) — só o código de produção do Wizard V2 não pode depender dele.
    const caminhos = Object.keys(arquivosFonte).filter((caminho) => !/\.test\.tsx?$/.test(caminho));
    expect(caminhos.length).toBeGreaterThan(5);

    // Só linhas de import/require contam como dependência real — comentários explicando o que NÃO é usado não violam a regra.
    const violacoes: string[] = [];
    for (const caminho of caminhos) {
      const linhasDeImport = arquivosFonte[caminho]
        .split("\n")
        .filter((linha) => /^\s*(import|export)\b.*from\s+["']/.test(linha) || /\brequire\(/.test(linha));
      for (const linha of linhasDeImport) {
        for (const termo of TERMOS_PROIBIDOS) {
          if (linha.includes(termo)) violacoes.push(`${caminho}: ${termo} — "${linha.trim()}"`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });
});
