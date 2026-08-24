import { describe, it, expect } from "vitest";
import { parseTextoDre, mesclarDespesasDoDre, mesclarDespesasDoDreComPrecedencia } from "../parseTextoDre";
import type { DadosApuradosCliente } from "../../sped/agregador";

const DRE_EXEMPLO = `
TRENTO SOLUCOES EM CONSTRUCOES LTDA
CNPJ: 01.326.359/0001-16
Período: até 30/06/2026

RECEITA BRUTA
Prestação de serviços 1.000.000,00

DEDUÇÕES
(-) ISS 20.000,00
(-) COFINS 30.000,00
(-) PIS 6.500,00
(-) CONTRIBUIÇÃO SOCIAL 9.000,00
(-) IMPOSTO DE RENDA 15.000,00

RECEITA LÍQUIDA 919.500,00
LUCRO BRUTO 919.500,00
DESPESAS OPERACIONAIS 400.000,00
DESPESAS ADMINISTRATIVAS 400.000,00
Serviços prestados por terceiros 250.000,00
Aluguel 150.000,00

RESULTADO OPERACIONAL 519.500,00
RESULTADO ANTES DO IR E CSL 519.500,00
LUCRO LÍQUIDO DO EXERCÍCIO 495.500,00
`.trim();

describe("parseTextoDre", () => {
  it("extrai os totais principais por rótulo", () => {
    const dados = parseTextoDre(DRE_EXEMPLO);
    expect(dados.receitaLiquida).toBeCloseTo(919500);
    expect(dados.lucroBruto).toBeCloseTo(919500);
    expect(dados.despesasOperacionais).toBeCloseTo(400000);
    expect(dados.resultadoOperacional).toBeCloseTo(519500);
    expect(dados.lucroLiquidoExercicio).toBeCloseTo(495500);
  });

  it("deriva o faturamento bruto a partir da receita líquida + deduções (mais robusto que ler a seção RECEITA BRUTA)", () => {
    const dados = parseTextoDre(DRE_EXEMPLO);
    const somaDeducoes = 20000 + 30000 + 6500 + 9000 + 15000;
    expect(dados.faturamentoBrutoDerivado).toBeCloseTo(919500 + somaDeducoes);
  });

  it("avisa quando despesas administrativas batem com o total de despesas operacionais (indício de custo não detalhado)", () => {
    const dados = parseTextoDre(DRE_EXEMPLO);
    expect(dados.avisos.some((a) => a.includes("NÃO some despesas administrativas"))).toBe(true);
  });

  it("avisa quando um rótulo obrigatório não é encontrado, em vez de assumir zero silenciosamente", () => {
    const semLucroLiquido = DRE_EXEMPLO.replace("LUCRO LÍQUIDO DO EXERCÍCIO 495.500,00", "");
    const dados = parseTextoDre(semLucroLiquido);
    expect(dados.lucroLiquidoExercicio).toBe(0);
    expect(dados.avisos.some((a) => a.includes("LUCRO LIQUIDO DO EXERCICIO"))).toBe(true);
  });

  it("é indiferente a acentuação e caixa dos rótulos", () => {
    const semAcento = DRE_EXEMPLO.replace("RECEITA LÍQUIDA", "receita liquida");
    const dados = parseTextoDre(semAcento);
    expect(dados.receitaLiquida).toBeCloseTo(919500);
  });
});

describe("mesclarDespesasDoDre", () => {
  function dadosEfd(): DadosApuradosCliente {
    return {
      periodoInicio: "01012026",
      periodoFim: "30062026",
      participantes: [],
      faturamento: 950000,
      custoMercadoriaInsumo: 100000,
      despesaOperacional: 0,
      despesaAdministrativa: 0,
      usoConsumo: 5000,
      imobilizado: 0,
      outros: 0,
      tributosRecolhidos: { icms: 10000, pis: 6500, cofins: 30000 },
      fonteDespesas: "efd_parcial",
      avisos: ["aviso da EFD"],
      arquivosProcessados: [],
      parceirosComExposicao: [],
      saldosContabeisDetalhados: [],
      faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: 0, itensIdentificados: [] },
    };
  }

  it("substitui as despesas pelo total do DRE, sem contar despesa administrativa em dobro", () => {
    const dre = parseTextoDre(DRE_EXEMPLO);
    const mesclado = mesclarDespesasDoDre(dadosEfd(), dre);

    expect(mesclado.despesaOperacional).toBeCloseTo(400000);
    expect(mesclado.despesaAdministrativa).toBe(0);
    expect(mesclado.custoMercadoriaInsumo).toBe(0);
    expect(mesclado.fonteDespesas).toBe("dre_pdf");
  });

  it("preserva faturamento e tributos vindos das EFDs (o DRE só cobre despesas)", () => {
    const dre = parseTextoDre(DRE_EXEMPLO);
    const mesclado = mesclarDespesasDoDre(dadosEfd(), dre);

    expect(mesclado.faturamento).toBe(950000);
    expect(mesclado.tributosRecolhidos).toEqual({ icms: 10000, pis: 6500, cofins: 30000 });
  });

  it("acumula os avisos da EFD com os do DRE", () => {
    const dre = parseTextoDre(DRE_EXEMPLO);
    const mesclado = mesclarDespesasDoDre(dadosEfd(), dre);

    expect(mesclado.avisos).toContain("aviso da EFD");
    expect(mesclado.avisos.some((a) => a.includes("DRE em PDF"))).toBe(true);
  });

  describe("mesclarDespesasDoDreComPrecedencia (P0.3)", () => {
    it("quando a ECD já foi importada para o ano, o DRE em PDF NÃO sobrescreve as despesas — só entra um aviso explícito de precedência", () => {
      const dre = parseTextoDre(DRE_EXEMPLO);
      const comEcd: DadosApuradosCliente = { ...dadosEfd(), fonteDespesas: "ecd", despesaOperacional: 111_000, custoMercadoriaInsumo: 222_000 };

      const resultado = mesclarDespesasDoDreComPrecedencia(comEcd, dre);

      expect(resultado.fonteDespesas).toBe("ecd");
      expect(resultado.despesaOperacional).toBe(111_000);
      expect(resultado.custoMercadoriaInsumo).toBe(222_000);
      expect(resultado.avisos.some((a) => a.includes("precedência") && a.includes("ECD"))).toBe(true);
    });

    it("sem ECD (só EFD), o DRE em PDF é aplicado normalmente — mesmo comportamento de mesclarDespesasDoDre", () => {
      const dre = parseTextoDre(DRE_EXEMPLO);
      const resultado = mesclarDespesasDoDreComPrecedencia(dadosEfd(), dre);

      expect(resultado.fonteDespesas).toBe("dre_pdf");
      expect(resultado.despesaOperacional).toBeCloseTo(400000);
    });
  });
});
