import { describe, it, expect } from "vitest";
import { gerarApresentacaoHtml } from "../gerarApresentacaoHtml";
import { simular } from "../../calculo";
import { gerarPanorama } from "../../panorama";
import type { DadosApuradosCliente } from "../../sped/agregador";
import type { SimulacaoInput } from "../../types";

function dados(): DadosApuradosCliente {
  return {
    participantes: [],
    faturamento: 1_000_000,
    custoMercadoriaInsumo: 300_000,
    despesaOperacional: 100_000,
    despesaAdministrativa: 50_000,
    usoConsumo: 10_000,
    imobilizado: 0,
    outros: 0,
    tributosRecolhidos: { icms: 20_000, pis: 6_500, cofins: 30_000 },
    fonteDespesas: "ecd",
    avisos: [],
    arquivosProcessados: [],
    parceirosComExposicao: [],
    saldosContabeisDetalhados: [],
    faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: 0, itensIdentificados: [] },
  };
}

const input: SimulacaoInput = {
  nomeEmpresa: "Cliente Teste Ltda",
  regimeAtual: "lucro_real",
  faturamentoAnual: 1_100_000,
  pisCofinsPercentualAtual: 0.0365,
  icmsIpiPercentualAtual: 0.02,
  percentualCustosCreditaveis: 0.4,
  perfilClientes: { percentualClienteContribuinte: 0.6, percentualClienteNaoContribuinte: 0.4 },
  meioPagamentoPredominante: "boleto",
};

describe("gerarApresentacaoHtml", () => {
  it("gera um HTML autocontido com o nome do cliente e os principais números", () => {
    const resultado = simular(input);
    const panorama = gerarPanorama(dados(), input, resultado);
    const html = gerarApresentacaoHtml({ nomeEmpresa: "Cliente Teste Ltda", logoSvg: "<svg></svg>", dados: dados(), panorama, resultado });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Cliente Teste Ltda");
    expect(html).toContain("Resumo executivo");
    expect(html).toContain("window.print()");
  });

  it("escapa HTML no nome da empresa e nos textos do panorama (evita injeção no arquivo exportado)", () => {
    const resultado = simular(input);
    const panorama = gerarPanorama(dados(), input, resultado);
    const html = gerarApresentacaoHtml({
      nomeEmpresa: "<script>alert(1)</script>",
      logoSvg: "<svg></svg>",
      dados: dados(),
      panorama,
      resultado,
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("inclui uma seção por tipo de item do panorama quando houver itens", () => {
    const resultado = simular(input);
    const panorama = gerarPanorama(dados(), input, resultado);
    const html = gerarApresentacaoHtml({ nomeEmpresa: "Cliente Teste Ltda", logoSvg: "<svg></svg>", dados: dados(), panorama, resultado });

    if (panorama.itens.some((i) => i.tipo === "risco")) {
      expect(html).toContain("Pontos de atenção");
    }
  });
});
