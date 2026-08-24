import { describe, it, expect } from "vitest";
import { executarFluxoLegado, executarFluxoV2, rascunhoV2Equivalente } from "./fixtures";
import { compararMetrica, construirResultadoComparacao } from "../comparador";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";
import type { EntradaEquivalente } from "./fixtures";

const ENTRADA_SIMPLES: EntradaEquivalente = {
  nomeEmpresa: "Clínica Médica",
  faturamentoAnual: 1_800_000,
  regimeAtual: "simples_unificado",
  pisCofinsPercentualAtual: 0.0365,
  icmsIpiPercentualAtual: 0,
  b2b: 0.2,
  b2c: 0.8,
  meioPagamentoPredominante: "pix",
};

describe("60 — FS12/Fator R: ganho de cobertura do V2", () => {
  it("legado fica sem FS12 (pessoas vazias); V2 com FS12 informada permite Fator R calculável", () => {
    const legado = executarFluxoLegado(ENTRADA_SIMPLES);
    expect(legado.cenario.pessoas.folhaAnual).toBeUndefined();

    const rascunho = rascunhoV2Equivalente(ENTRADA_SIMPLES, ["simples_unificado"]);
    rascunho.pessoas.folhaAnual = campo(300_000, "informado_usuario", "confirmado");
    rascunho.pessoas.encargosAnual = campo(90_000, "informado_usuario", "confirmado");
    rascunho.pessoas.proLaboreAnual = campo(60_000, "informado_usuario", "confirmado");
    const v2 = executarFluxoV2(rascunho);
    expect(v2.cenario.pessoas.folhaAnual?.valor).toBe(300_000);

    const divergencia = compararMetrica("fs12_disponivel", undefined, v2.cenario.pessoas.folhaAnual?.valor, {
      tipo: "monetario",
      motivoCoberturaV2: "Legado (SPED/manual) não segrega folha de pagamento — não é possível compor FS12 a partir dessa entrada; V2 captura os componentes diretamente.",
    });
    const resultado = construirResultadoComparacao({ casoId: "caso-fs12", divergenciasEntrada: [], divergenciasResultado: [divergencia] });
    expect(resultado.classificacao).toBe("esperada_por_maior_cobertura_v2");
  });
});

describe("61 — créditos: ganho de cobertura do V2", () => {
  it("legado não classifica custos por crédito (custos.itens vazio); V2 registra CategoriaGasto/NaturezaEconomica/TratamentoCredito", () => {
    const legado = executarFluxoLegado(ENTRADA_SIMPLES);
    expect(legado.cenario.custos.itens).toEqual([]);

    const rascunho = rascunhoV2Equivalente(ENTRADA_SIMPLES);
    rascunho.custos.itens = [
      {
        categoria: {
          chave: "insumos",
          label: "Insumos",
          naturezaEconomica: "custo_direto",
          creditoPisCofins: { tratamento: "creditavel", status: "confirmado" },
          creditoIcmsIpi: { tratamento: "nao_creditavel", status: "confirmado" },
          creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" },
        },
        valorAnual: 400_000,
      },
    ];
    const v2 = executarFluxoV2(rascunho);
    expect(v2.cenario.custos.itens).toHaveLength(1);

    const divergencia = compararMetrica("itens_custo_classificados", legado.cenario.custos.itens.length, v2.cenario.custos.itens.length, {
      tipo: "monetario",
      motivoCoberturaV2: "Legado não classifica custos por natureza/crédito — V2 captura a taxonomia completa por item.",
    });
    expect(divergencia.classificacao).toBe("esperada_por_maior_cobertura_v2");
  });
});

describe("62 — Split: ganho de cobertura do V2", () => {
  it("caixa legado = indisponível; caixa V2 = disponível quando split é informado", () => {
    const legado = executarFluxoLegado(ENTRADA_SIMPLES);
    expect(legado.statusCaixa.status).toBe("indisponivel");

    const rascunho = rascunhoV2Equivalente(ENTRADA_SIMPLES);
    rascunho.analisarCaixa = true;
    rascunho.premissasSplit = {
      percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"),
      percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"),
      taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado"),
    };
    const v2 = executarFluxoV2(rascunho);
    expect(v2.statusCaixa.status).toBe("disponivel");

    const divergencia = compararMetrica("status_caixa", "indisponivel", "disponivel", { tipo: "texto", motivoCoberturaV2: "Legado não captura premissas de split payment — V2 as informa explicitamente." });
    expect(divergencia.classificacao).toBe("esperada_por_maior_cobertura_v2");
  });
});

describe("63 — Lucro Real: ganho de cobertura do V2", () => {
  it("legado sem ajustesFiscais/saldosPrejuizoAnteriores; V2 com esses dados melhora a qualidade da base", () => {
    const entradaReal: EntradaEquivalente = { ...ENTRADA_SIMPLES, regimeAtual: "lucro_real" };
    const legado = executarFluxoLegado(entradaReal);
    expect(legado.cenario.tributario.ajustesFiscais).toBeUndefined();
    expect(legado.cenario.tributario.saldosPrejuizoAnteriores).toBeUndefined();

    const rascunho = rascunhoV2Equivalente(entradaReal, ["lucro_real"]);
    rascunho.tributario.ajustesFiscais = [{ tipo: "adicao", tributoAplicavel: "ambos", valor: 50_000, descricao: "Despesa não dedutível", origem: "informado_usuario", status: "confirmado" }];
    rascunho.tributario.saldosPrejuizoAnteriores = { irpj: campo(200_000, "informado_usuario", "confirmado"), csll: campo(200_000, "informado_usuario", "confirmado") };
    const v2 = executarFluxoV2(rascunho);
    expect(v2.cenario.tributario.ajustesFiscais).toHaveLength(1);
    expect(v2.cenario.tributario.saldosPrejuizoAnteriores?.irpj?.valor).toBe(200_000);

    const divergencia = compararMetrica("ajustes_fiscais_disponiveis", 0, 1, { tipo: "monetario", motivoCoberturaV2: "Legado não captura ajustes fiscais/saldos de prejuízo — Lucro Real fica com base fiscal parcial; V2 informa esses dados." });
    expect(divergencia.classificacao).toBe("esperada_por_maior_cobertura_v2");
  });
});
