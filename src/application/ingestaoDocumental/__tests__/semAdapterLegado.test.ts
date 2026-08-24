import { describe, it, expect } from "vitest";

const TERMOS_PROIBIDOS = ["legadoParaCenarioEmpresa", "DadosApuradosCliente", "ClienteDataContext", "useClienteData"];

const arquivosFonte = import.meta.glob("../**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

describe("Camada de ingestão documental não depende do fluxo legado", () => {
  it("nenhum arquivo de src/application/ingestaoDocumental importa DadosApuradosCliente, o adapter legado ou ClienteDataContext", () => {
    // Espelha wizardEstrategico/__tests__/semAdapterLegado.test.ts — a ingestão alimenta o Wizard V2 via
    // RascunhoCenarioEmpresa e nunca deve passar por sped/agregador.ts (DadosApuradosCliente) ou pelo adapter legado.
    const caminhos = Object.keys(arquivosFonte).filter((caminho) => !/\.test\.tsx?$/.test(caminho));
    expect(caminhos.length).toBeGreaterThan(5);

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
