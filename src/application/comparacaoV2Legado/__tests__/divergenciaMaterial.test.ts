import { describe, it, expect } from "vitest";
import { compararMetrica, construirResultadoComparacao } from "../comparador";
import { valoresMonetariosEquivalentes, percentuaisEquivalentes } from "../tolerancias";
import { executarFluxoLegado, executarFluxoV2, rascunhoV2Equivalente } from "./fixtures";
import type { EntradaEquivalente } from "./fixtures";

describe("64/25 — divergência material sintética é detectada, nunca reduzida silenciosamente", () => {
  it("faturamentos diferentes entre legado e V2 geram divergencia_material", () => {
    const entradaLegado: EntradaEquivalente = {
      nomeEmpresa: "Divergente",
      faturamentoAnual: 5_000_000,
      regimeAtual: "lucro_presumido",
      pisCofinsPercentualAtual: 0.0365,
      icmsIpiPercentualAtual: 0.05,
      b2b: 0.6,
      b2c: 0.4,
      meioPagamentoPredominante: "pix",
    };
    const entradaV2: EntradaEquivalente = { ...entradaLegado, faturamentoAnual: 5_500_000 };

    const legado = executarFluxoLegado(entradaLegado);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entradaV2));

    const divergenciaEntrada = compararMetrica("faturamento_anual", legado.cenario.receita.faturamentoAnual?.valor, v2.cenario.receita.faturamentoAnual?.valor, { tipo: "monetario" });
    expect(divergenciaEntrada.classificacao).toBe("divergencia_material");

    const resultado = construirResultadoComparacao({ casoId: "caso-divergente", divergenciasEntrada: [divergenciaEntrada], divergenciasResultado: [] });
    expect(resultado.classificacao).toBe("divergencia_material");
    expect(resultado.impactosMateriais.length).toBeGreaterThan(0);
  });

  it("26 — nenhuma divergência material é reduzida automaticamente pelo classificador de conjunto", () => {
    const divergenciaMaterial = compararMetrica("carga", 100_000, 200_000, { tipo: "monetario" });
    const divergenciaEquivalente = compararMetrica("margem", 0.2, 0.201, { tipo: "percentual" });
    const resultado = construirResultadoComparacao({ casoId: "caso-misto", divergenciasEntrada: [], divergenciasResultado: [divergenciaMaterial, divergenciaEquivalente] });
    expect(resultado.classificacao).toBe("divergencia_material");
  });
});

describe("65 — tolerância monetária absorve ruído de arredondamento sem esconder diferença real", () => {
  it("R$ 0,01 de diferença é tratado como ruído", () => {
    expect(valoresMonetariosEquivalentes(100_000, 100_000.01)).toBe(true);
  });

  it("diferença de R$ 5.000 num valor de R$ 100.000 é material (5%, muito acima da tolerância)", () => {
    expect(valoresMonetariosEquivalentes(100_000, 105_000)).toBe(false);
  });
});

describe("66 — tolerância percentual absorve ruído binário sem esconder diferença de alíquota/regime", () => {
  it("0,05 p.p. de diferença é ruído", () => {
    expect(percentuaisEquivalentes(0.154, 0.1545)).toBe(true);
  });

  it("15,4% vs 16,1% é divergência material (seção 11 do pedido, exemplo explícito)", () => {
    expect(percentuaisEquivalentes(0.154, 0.161)).toBe(false);
  });
});

describe("67 — indisponível e zero nunca são equivalentes", () => {
  it("compararMetrica nunca trata undefined como 0", () => {
    const divergencia = compararMetrica("carga", undefined, 0, { tipo: "monetario" });
    expect(divergencia.classificacao).toBe("divergencia_material");
  });

  it("undefined em ambos os lados é equivalente (ambos indisponíveis), mas não é o mesmo que comparar contra 0", () => {
    const ambosIndisponiveis = compararMetrica("carga", undefined, undefined, { tipo: "monetario" });
    const umZero = compararMetrica("carga", undefined, 0, { tipo: "monetario" });
    expect(ambosIndisponiveis.classificacao).toBe("equivalente");
    expect(umZero.classificacao).not.toBe("equivalente");
  });
});
