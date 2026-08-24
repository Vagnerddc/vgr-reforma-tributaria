import { describe, it, expect } from "vitest";
import {
  faturamentoParaMargemAlvo,
  projetarInputDoSped,
  sugerirPercentualComprasProdutorRuralNaoContribuinte,
  type CamposManuaisProjecao,
} from "../projecao";
import { simular } from "../calculo";
import type { DadosApuradosCliente } from "../sped/agregador";

function dadosBase(overrides: Partial<DadosApuradosCliente> = {}): DadosApuradosCliente {
  return {
    faturamento: 1_000_000,
    custoMercadoriaInsumo: 400_000,
    despesaOperacional: 300_000,
    despesaAdministrativa: 250_000,
    usoConsumo: 50_000,
    imobilizado: 0,
    outros: 0,
    tributosRecolhidos: { icms: 30_000, pis: 16_500, cofins: 76_000 },
    fonteDespesas: "ecd",
    avisos: [],
    arquivosProcessados: [],
    participantes: [],
    parceirosComExposicao: [],
    saldosContabeisDetalhados: [],
    faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: 0, itensIdentificados: [] },
    ...overrides,
  };
}

const camposManuais: CamposManuaisProjecao = {
  nomeEmpresa: "Empresa Teste",
  regimeAtual: "lucro_real",
  perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
  meioPagamentoPredominante: "pix",
};

describe("faturamentoParaMargemAlvo", () => {
  it("empresa sem resultado hoje (despesas ≈ faturamento): projeta faturamento maior para atingir 3% de margem", () => {
    // despesas = 1.000.000 (100% do faturamento atual) => hoje a empresa não tem resultado
    const dados = dadosBase({
      faturamento: 1_000_000,
      custoMercadoriaInsumo: 400_000,
      despesaOperacional: 300_000,
      despesaAdministrativa: 250_000,
      usoConsumo: 50_000,
    });
    const { faturamentoProjetado, atingivel } = faturamentoParaMargemAlvo(dados, 0.03, 2027);
    expect(atingivel).toBe(true);
    expect(faturamentoProjetado).toBeGreaterThan(dados.faturamento);

    // valida a fórmula fechada: lucro projetado deve ser ~3% do faturamento projetado
    const input = projetarInputDoSped(dados, camposManuais, faturamentoProjetado);
    const resultado = simular(input);
    const a2027 = resultado.anos.find((a) => a.ano === 2027)!;
    const despesasFixas = 400_000 + 300_000 + 250_000 + 50_000;
    const lucro = faturamentoProjetado - despesasFixas - a2027.cargaNovaPropriaEmpresa;
    expect(lucro / faturamentoProjetado).toBeCloseTo(0.03, 2);
  });

  it("não é atingível quando a margem alvo excede a margem bruta máxima possível", () => {
    const dados = dadosBase();
    const { atingivel } = faturamentoParaMargemAlvo(dados, 0.99, 2027);
    expect(atingivel).toBe(false);
  });

  it("despesas apuradas zeradas (ex.: só EFDs importadas, sem classificação de despesa) NÃO é tratado como impossível — a meta já é trivialmente alcançável", () => {
    const dados = dadosBase({
      custoMercadoriaInsumo: 0,
      despesaOperacional: 0,
      despesaAdministrativa: 0,
      usoConsumo: 0,
    });
    const { atingivel, faturamentoProjetado } = faturamentoParaMargemAlvo(dados, 0.03, 2027);
    expect(atingivel).toBe(true);
    expect(faturamentoProjetado).toBe(dados.faturamento);
  });
});

describe("projetarInputDoSped — despesas fixas em R$, não escaladas com o faturamento", () => {
  it("dobrar o faturamento projetado NÃO dobra o percentual de custos creditáveis — despesas ficam fixas em R$", () => {
    const dados = dadosBase(); // despesas fixas somam 1.000.000, faturamento base 1.000.000
    const inputBase = projetarInputDoSped(dados, camposManuais, dados.faturamento);
    const inputDobrado = projetarInputDoSped(dados, camposManuais, dados.faturamento * 2);

    // com o dobro do faturamento e despesas fixas, o percentual de custos creditáveis cai pela metade
    expect(inputDobrado.percentualCustosCreditaveis).toBeCloseTo(inputBase.percentualCustosCreditaveis / 2, 5);
  });

  it("a alíquota (débito) de PIS/Cofins e ICMS não muda com o faturamento projetado — é uma taxa, não um valor fixo", () => {
    const dados = dadosBase();
    const inputBase = projetarInputDoSped(dados, camposManuais, dados.faturamento);
    const inputCrescido = projetarInputDoSped(dados, camposManuais, dados.faturamento * 1.5);
    expect(inputCrescido.pisCofinsPercentualAtual).toBeCloseTo(inputBase.pisCofinsPercentualAtual, 5);
    expect(inputCrescido.icmsIpiPercentualAtual).toBeCloseTo(inputBase.icmsIpiPercentualAtual, 5);
  });

  it("deriva o % de faturamento com regime especial por produto direto de faturamentoPorRegimeProduto (não é campo manual)", () => {
    const dados = dadosBase({
      faturamento: 1_000_000,
      faturamentoPorRegimeProduto: {
        faturamentoZero: 200_000,
        faturamentoReduzido60: 100_000,
        faturamentoAliquotaCheia: 700_000,
        itensIdentificados: [],
      },
    });
    const input = projetarInputDoSped(dados, camposManuais, dados.faturamento);
    expect(input.percentualFaturamentoProdutoZero).toBeCloseTo(0.2);
    expect(input.percentualFaturamentoProdutoReduzido60).toBeCloseTo(0.1);
  });
});

describe("sugerirPercentualComprasProdutorRuralNaoContribuinte", () => {
  function parceiro(
    regime: string,
    valorTotal: number,
    papel: "fornecedor" | "cliente" | "ambos" = "fornecedor",
    cnaePrincipal?: string
  ) {
    return {
      participante: { codPart: Math.random().toString(), nome: "X", regime, restringeCreditoDoCliente: regime !== "normal", cnaePrincipal },
      papel,
      valorTotal,
    } as DadosApuradosCliente["parceirosComExposicao"][number];
  }

  it("frigorífico que compra de produtor rural (PF): sugere o % baseado na exposição real de fornecedores pessoa física", () => {
    const dados = dadosBase({
      parceirosComExposicao: [
        parceiro("pessoa_fisica", 700_000), // produtores rurais vendendo gado
        parceiro("normal", 300_000), // fornecedor de insumos/embalagem, regime regular
      ],
    });
    expect(sugerirPercentualComprasProdutorRuralNaoContribuinte(dados)).toBeCloseTo(0.7);
  });

  it("ignora clientes (só considera fornecedor/ambos) e não conta compras zero", () => {
    const dados = dadosBase({
      parceirosComExposicao: [parceiro("pessoa_fisica", 500_000, "cliente")],
    });
    expect(sugerirPercentualComprasProdutorRuralNaoContribuinte(dados)).toBe(0);
  });

  it("sem fornecedores, retorna 0 (não divide por zero)", () => {
    expect(sugerirPercentualComprasProdutorRuralNaoContribuinte(dadosBase({ parceirosComExposicao: [] }))).toBe(0);
  });

  it("frigorífico que compra de produtor rural PESSOA JURÍDICA (CNAE divisão 01, pecuária): identifica pelo CNAE, não só por PF", () => {
    const dados = dadosBase({
      parceirosComExposicao: [
        parceiro("normal", 600_000, "fornecedor", "0151201"), // pecuária de corte, PJ, regime "normal" (não Simples)
        parceiro("normal", 400_000, "fornecedor", "4634601"), // comércio de carnes — fornecedor normal, não é produtor rural
      ],
    });
    expect(sugerirPercentualComprasProdutorRuralNaoContribuinte(dados)).toBeCloseTo(0.6);
  });

  it("PJ 'normal' sem CNAE agropecuário não conta como produtor rural mesmo com regime restrito (regressão)", () => {
    const dados = dadosBase({
      parceirosComExposicao: [parceiro("simples_nacional", 500_000, "fornecedor", "4634601")],
    });
    expect(sugerirPercentualComprasProdutorRuralNaoContribuinte(dados)).toBe(0);
  });
});
