import { describe, it, expect } from "vitest";
import { reclassificarSaldosPorSegmento, aplicarReclassificacaoSegmento } from "../reclassificacaoSegmento";
import type { SaldoContaContabil } from "../sped/tipos";
import type { DadosApuradosCliente } from "../sped/agregador";

function saldo(descricao: string, natureza: SaldoContaContabil["natureza"], valorPeriodo = 1000): SaldoContaContabil {
  return { codCta: "1", descricao, natureza, valorPeriodo };
}

function dadosComSaldos(saldosContabeisDetalhados: SaldoContaContabil[]): DadosApuradosCliente {
  return {
    participantes: [],
    faturamento: 0,
    custoMercadoriaInsumo: 0,
    despesaOperacional: 0,
    despesaAdministrativa: saldosContabeisDetalhados
      .filter((s) => s.natureza === "despesaAdministrativa")
      .reduce((s, v) => s + v.valorPeriodo, 0),
    usoConsumo: 0,
    imobilizado: 0,
    outros: 0,
    tributosRecolhidos: { icms: 0, pis: 0, cofins: 0 },
    fonteDespesas: "ecd",
    avisos: [],
    arquivosProcessados: [],
    parceirosComExposicao: [],
    saldosContabeisDetalhados,
    faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: 0, itensIdentificados: [] },
  };
}

describe("reclassificarSaldosPorSegmento", () => {
  it("reclassifica serviço de terceiro lançado como despesa administrativa para custo, na construção civil", () => {
    const saldos = [saldo("SERVIÇOS PRESTADOS POR TERCEIROS - MAO DE OBRA OBRA", "despesaAdministrativa")];
    const resultado = reclassificarSaldosPorSegmento(saldos, "construcao_civil");

    expect(resultado.saldos[0].natureza).toBe("custoMercadoriaInsumo");
    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toContain("Reclassificado");
  });

  it("não reclassifica quando a descrição não bate com nenhuma regra do segmento", () => {
    const saldos = [saldo("ALUGUEL DO ESCRITORIO CENTRAL", "despesaAdministrativa")];
    const resultado = reclassificarSaldosPorSegmento(saldos, "construcao_civil");

    expect(resultado.saldos[0].natureza).toBe("despesaAdministrativa");
    expect(resultado.avisos).toHaveLength(0);
  });

  it("aplica regras diferentes por segmento (combustível de frota vs. combustível de aeronave)", () => {
    const saldos = [saldo("COMBUSTIVEL", "despesaAdministrativa")];
    const transporte = reclassificarSaldosPorSegmento(saldos, "transporte_rodoviario_cargas");
    const aviacao = reclassificarSaldosPorSegmento(saldos, "aviacao_agricola");

    expect(transporte.saldos[0].natureza).toBe("custoMercadoriaInsumo");
    expect(aviacao.saldos[0].natureza).toBe("custoMercadoriaInsumo");
  });

  it("é indiferente a acentuação/caixa na descrição da conta", () => {
    const saldos = [saldo("combustível da frota", "despesaAdministrativa")];
    const resultado = reclassificarSaldosPorSegmento(saldos, "transporte_rodoviario_cargas");
    expect(resultado.saldos[0].natureza).toBe("custoMercadoriaInsumo");
  });

  it("não reclassifica se a natureza já é a correta", () => {
    const saldos = [saldo("COMBUSTIVEL DA FROTA", "custoMercadoriaInsumo")];
    const resultado = reclassificarSaldosPorSegmento(saldos, "transporte_rodoviario_cargas");
    expect(resultado.avisos).toHaveLength(0);
  });
});

describe("aplicarReclassificacaoSegmento", () => {
  it("recalcula despesaAdministrativa e custoMercadoriaInsumo do DadosApuradosCliente após reclassificar", () => {
    const dados = dadosComSaldos([
      saldo("SERVICOS PRESTADOS POR TERCEIROS - MAO DE OBRA", "despesaAdministrativa", 8000),
      saldo("ALUGUEL DO ESCRITORIO", "despesaAdministrativa", 2000),
    ]);
    const resultado = aplicarReclassificacaoSegmento(dados, "construcao_civil");

    expect(resultado.custoMercadoriaInsumo).toBeCloseTo(8000);
    expect(resultado.despesaAdministrativa).toBeCloseTo(2000);
    expect(resultado.avisos.some((a) => a.includes("Reclassificado"))).toBe(true);
  });

  it("sem ECD (saldosContabeisDetalhados vazio), devolve os dados sem alteração", () => {
    const dados = dadosComSaldos([]);
    const resultado = aplicarReclassificacaoSegmento(dados, "construcao_civil");
    expect(resultado).toBe(dados);
  });
});
