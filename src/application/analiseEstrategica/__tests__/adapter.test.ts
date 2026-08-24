import { describe, it, expect } from "vitest";
import { adaptarClienteLegadoParaCenarioEmpresa } from "../adapters/legadoParaCenarioEmpresa";
import type { ClienteData } from "../../../context/ClienteDataContext";
import type { SimulacaoInput } from "../../../engine/types";

function clienteBase(input: Partial<SimulacaoInput> = {}): ClienteData {
  const simulacaoInput: SimulacaoInput = {
    nomeEmpresa: "Empresa Legada",
    regimeAtual: "lucro_presumido",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.05,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: 0.7, percentualClienteNaoContribuinte: 0.3 },
    meioPagamentoPredominante: "pix",
    ...input,
  };
  return {
    nomeEmpresa: "Empresa Legada",
    dados: {} as never,
    resultadoSimulacao: { input: simulacaoInput, anos: [], recomendacao: "", avisos: [] },
    panorama: null,
  };
}

describe("47 — adapter legado nunca inventa dado ausente", () => {
  it("sem resultadoSimulacao, o adapter retorna undefined (nunca um cenário fabricado)", () => {
    const cliente: ClienteData = { nomeEmpresa: "X", dados: {} as never, resultadoSimulacao: null, panorama: null };
    expect(adaptarClienteLegadoParaCenarioEmpresa(cliente)).toBeUndefined();
  });

  it("FS12/pessoas nunca são preenchidos — o legado não segrega folha", () => {
    const resultado = adaptarClienteLegadoParaCenarioEmpresa(clienteBase())!;
    expect(resultado.cenario.pessoas.folhaAnual).toBeUndefined();
    expect(resultado.cenario.pessoas.encargosAnual).toBeUndefined();
    expect(resultado.perdas.some((p) => p.campo.includes("folhaAnual"))).toBe(true);
  });

  it("custos.itens fica vazio — nenhum item de custo é sintetizado sem classificação de crédito", () => {
    const resultado = adaptarClienteLegadoParaCenarioEmpresa(clienteBase())!;
    expect(resultado.cenario.custos.itens).toEqual([]);
    expect(resultado.perdas.some((p) => p.campo === "custos.itens")).toBe(true);
  });

  it("premissas de split payment nunca são inventadas — economicoFinanceiro não recebe percentuais de split", () => {
    const resultado = adaptarClienteLegadoParaCenarioEmpresa(clienteBase())!;
    expect((resultado.cenario.economicoFinanceiro as Record<string, unknown>).percentualRecebimentosSujeitos).toBeUndefined();
  });

  it("faturamento/regime/meio de pagamento vêm diretamente do SimulacaoInput já preenchido, sem reformulação", () => {
    const resultado = adaptarClienteLegadoParaCenarioEmpresa(clienteBase({ faturamentoAnual: 2_500_000, regimeAtual: "lucro_real" }))!;
    expect(resultado.cenario.receita.faturamentoAnual?.valor).toBe(2_500_000);
    expect(resultado.cenario.tributario.regimeAtual?.valor).toBe("lucro_real");
    expect(resultado.cenario.economicoFinanceiro.meioPagamentoPredominante?.valor).toBe("pix");
  });
});
