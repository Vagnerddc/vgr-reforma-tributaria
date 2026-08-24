import { describe, it, expect } from "vitest";
import { apurarMetodologiaMultiAno, sintetizarDadosParaProjecao } from "../metodologiaMultiAno";
import type { DadosApuradosCliente } from "../sped/agregador";

function dados(overrides: Partial<DadosApuradosCliente>): DadosApuradosCliente {
  return {
    participantes: [],
    faturamento: 100000,
    custoMercadoriaInsumo: 0,
    despesaOperacional: 0,
    despesaAdministrativa: 0,
    usoConsumo: 0,
    imobilizado: 0,
    outros: 0,
    tributosRecolhidos: { icms: 0, pis: 0, cofins: 0 },
    fonteDespesas: "ecd",
    avisos: [],
    arquivosProcessados: [],
    parceirosComExposicao: [],
    saldosContabeisDetalhados: [],
    faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: 0, itensIdentificados: [] },
    ...overrides,
  };
}

describe("apurarMetodologiaMultiAno", () => {
  it("com dois anos, usa faturamento real (não o declarado) para calcular a carga efetiva e a taxa de crescimento", () => {
    const resultado = apurarMetodologiaMultiAno([
      {
        ano: 2025,
        faturamentoReal: 1000000,
        dados: dados({ faturamento: 600000, despesaOperacional: 200000, tributosRecolhidos: { icms: 50000, pis: 10000, cofins: 20000 } }),
      },
      {
        ano: 2026,
        faturamentoReal: 1200000,
        dados: dados({ faturamento: 700000, despesaOperacional: 240000, tributosRecolhidos: { icms: 60000, pis: 12000, cofins: 24000 } }),
      },
    ]);

    expect(resultado.taxaCrescimentoReal).toBeCloseTo((1200000 - 1000000) / 1000000);
    expect(resultado.despesaOperacional).toBeCloseTo((200000 + 240000) / 2);
    expect(resultado.faturamentoRealBase).toBe(1200000);

    const carga2025 = 80000 / 1000000;
    const carga2026 = 96000 / 1200000;
    expect(resultado.cargaTributariaAtualMedia).toBeCloseTo((carga2025 + carga2026) / 2);
  });

  it("sintetiza um DadosApuradosCliente com faturamento real e médias, mantendo a mesma carga efetiva total", () => {
    const anos = [
      {
        ano: 2025,
        faturamentoReal: 1000000,
        dados: dados({ faturamento: 600000, despesaOperacional: 200000, tributosRecolhidos: { icms: 50000, pis: 10000, cofins: 20000 } }),
      },
      {
        ano: 2026,
        faturamentoReal: 1200000,
        dados: dados({ faturamento: 700000, despesaOperacional: 240000, tributosRecolhidos: { icms: 60000, pis: 12000, cofins: 24000 } }),
      },
    ];
    const resultado = apurarMetodologiaMultiAno(anos);
    const sintetizado = sintetizarDadosParaProjecao(anos, resultado);

    expect(sintetizado.faturamento).toBe(1200000);
    expect(sintetizado.despesaOperacional).toBeCloseTo(220000);
    const cargaSintetizada =
      (sintetizado.tributosRecolhidos.icms + sintetizado.tributosRecolhidos.pis + sintetizado.tributosRecolhidos.cofins) /
      sintetizado.faturamento;
    expect(cargaSintetizada).toBeCloseTo(resultado.cargaTributariaAtualMedia);
  });

  it("com um único ano, não calcula taxa de crescimento e usa a carga daquele ano só", () => {
    const resultado = apurarMetodologiaMultiAno([
      {
        ano: 2026,
        faturamentoReal: 1000000,
        dados: dados({ tributosRecolhidos: { icms: 50000, pis: 10000, cofins: 20000 } }),
      },
    ]);

    expect(resultado.taxaCrescimentoReal).toBeNull();
    expect(resultado.cargaTributariaAtualMedia).toBeCloseTo(80000 / 1000000);
  });

  it("sem faturamento real informado, cai de volta pro faturamento declarado no SPED e avisa", () => {
    const resultado = apurarMetodologiaMultiAno([
      { ano: 2026, faturamentoReal: 0, dados: dados({ faturamento: 500000, tributosRecolhidos: { icms: 40000, pis: 0, cofins: 0 } }) },
    ]);

    expect(resultado.cargaTributariaAtualMedia).toBeCloseTo(40000 / 500000);
    expect(resultado.avisos.some((a) => a.includes("2026"))).toBe(true);
  });

  it("um ano com faturamento zero (ex.: só ECD importada, sem nenhuma EFD daquele ano) não gera NaN — usa só o ano com faturamento apurado (achado num teste geral com dado real)", () => {
    const resultado = apurarMetodologiaMultiAno([
      { ano: 2025, faturamentoReal: 0, dados: dados({ faturamento: 0, tributosRecolhidos: { icms: 0, pis: 0, cofins: 0 } }) },
      { ano: 2026, faturamentoReal: 1000000, dados: dados({ faturamento: 1000000, tributosRecolhidos: { icms: 50000, pis: 10000, cofins: 20000 } }) },
    ]);

    expect(Number.isNaN(resultado.cargaTributariaAtualMedia)).toBe(false);
    expect(resultado.cargaTributariaAtualMedia).toBeCloseTo(80000 / 1000000);
    expect(Number.isNaN(resultado.tributosEfetivos.icms)).toBe(false);
    expect(resultado.avisos.some((a) => a.includes("2025") && a.includes("faturamento zero"))).toBe(true);
  });

  it("os dois anos com faturamento zero: carga fica 0 (não NaN), com aviso explícito", () => {
    const resultado = apurarMetodologiaMultiAno([
      { ano: 2025, faturamentoReal: 0, dados: dados({ faturamento: 0 }) },
      { ano: 2026, faturamentoReal: 0, dados: dados({ faturamento: 0 }) },
    ]);
    expect(resultado.cargaTributariaAtualMedia).toBe(0);
    expect(resultado.avisos.some((a) => a.includes("Nenhum dos anos informados"))).toBe(true);
  });

  it("rejeita mais de dois anos", () => {
    const um = { ano: 2024, faturamentoReal: 1, dados: dados({}) };
    expect(() => apurarMetodologiaMultiAno([um, { ...um, ano: 2025 }, { ...um, ano: 2026 }])).toThrow();
  });
});
