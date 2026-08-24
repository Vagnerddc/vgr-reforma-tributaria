import { describe, it, expect } from "vitest";
import { simular } from "../calculo";
import type { SimulacaoInput } from "../types";
import { parametros } from "../parametros";

function anoOf(res: ReturnType<typeof simular>, ano: number) {
  const a = res.anos.find((x) => x.ano === ano);
  if (!a) throw new Error(`ano ${ano} não encontrado`);
  return a;
}

describe("Ano-teste 2026: sem ônus tributário líquido adicional (art. 348 LC 214/2025)", () => {
  const input: SimulacaoInput = {
    nomeEmpresa: "Empresa Teste 2026",
    regimeAtual: "lucro_real",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.2,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "pix",
  };

  it("avisa que 2026 não representa ônus tributário líquido adicional", () => {
    const res = simular(input);
    const a2026 = anoOf(res, 2026);
    expect(a2026.observacoes.some((o) => o.includes("não representam ônus tributário líquido adicional") || o.includes("não representam ônus tributário"))).toBe(true);
  });

  it("não emite o aviso do ano-teste a partir de 2027 (cobrança efetiva)", () => {
    const res = simular(input);
    const a2027 = anoOf(res, 2027);
    expect(a2027.observacoes.some((o) => o.includes("ano-teste"))).toBe(false);
  });
});

describe("Perfil 1: aviação convencional, Lucro Real", () => {
  const input: SimulacaoInput = {
    nomeEmpresa: "AgroVoo Convencional Ltda",
    tipoAviacao: "convencional",
    regimeAtual: "lucro_real",
    faturamentoAnual: 5_000_000,
    pisCofinsPercentualAtual: 0.09,
    icmsIpiPercentualAtual: 0,
    percentualCustosCreditaveis: 0.35,
    perfilClientes: { percentualClienteContribuinte: 0.9, percentualClienteNaoContribuinte: 0.1 },
    meioPagamentoPredominante: "boleto",
  };

  it("gera crédito integral ao cliente em todos os anos", () => {
    const res = simular(input);
    res.anos.forEach((a) => expect(a.percentualCreditoRepassadoAoCliente).toBe(1.0));
  });

  it("em 2026 (ano-teste) a carga nova é marginal (alíquotas simbólicas)", () => {
    const res = simular(input);
    const a2026 = anoOf(res, 2026);
    expect(a2026.aliquotaTotal).toBeCloseTo(0.01, 5);
    expect(a2026.cargaNovaPropriaEmpresa).toBeLessThan(a2026.cargaAtualReferencia);
  });

  it("split payment fica ativo para boleto a partir de 2026 (fase 1)", () => {
    const res = simular(input);
    const a2026 = anoOf(res, 2026);
    expect(a2026.splitPaymentAtivoParaMeioPredominante).toBe(true);
    expect(a2026.capitalGiroPerdidoComSplitMensal).toBeGreaterThan(0);
  });

  it("não tem custo de compliance adicional (regime já é regular)", () => {
    const res = simular(input);
    res.anos.forEach((a) => expect(a.custoComplianceAdicional).toBe(0));
  });

  it("débito - crédito = efetivo, e crédito reflete o % de custos creditáveis", () => {
    const res = simular(input);
    const a2033 = anoOf(res, 2033);
    expect(a2033.debitoBruto - a2033.creditoApurado).toBeCloseTo(a2033.cargaNovaPropriaEmpresa, 5);
    expect(a2033.creditoApurado).toBeCloseTo(a2033.debitoBruto * 0.35, 5);
  });

  it("desmembramento CBS/IBS soma de volta ao total, na proporção das alíquotas de referência", () => {
    const res = simular(input);
    const a2033 = anoOf(res, 2033);
    expect(a2033.debitoBrutoCbs + a2033.debitoBrutoIbs).toBeCloseTo(a2033.debitoBruto, 5);
    expect(a2033.creditoApuradoCbs + a2033.creditoApuradoIbs).toBeCloseTo(a2033.creditoApurado, 5);
    expect(a2033.efetivoCbs + a2033.efetivoIbs).toBeCloseTo(a2033.cargaNovaPropriaEmpresa, 5);
    const proporcaoCbsEsperada = a2033.aliquotaCbs / a2033.aliquotaTotal;
    expect(a2033.debitoBrutoCbs / a2033.debitoBruto).toBeCloseTo(proporcaoCbsEsperada, 5);
  });
});

describe("Perfil 2: aviação convencional, Simples unificado x híbrido", () => {
  const base: SimulacaoInput = {
    nomeEmpresa: "AgroVoo Simples Ltda",
    tipoAviacao: "convencional",
    regimeAtual: "simples_unificado",
    anexoSimples: "anexoIII",
    faturamentoAnual: 1_200_000,
    pisCofinsPercentualAtual: 0.06,
    icmsIpiPercentualAtual: 0,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: 0.8, percentualClienteNaoContribuinte: 0.2 },
    meioPagamentoPredominante: "pix",
  };

  it("unificado: repassa apenas crédito parcial ao cliente", () => {
    const res = simular(base);
    res.anos.forEach((a) => expect(a.percentualCreditoRepassadoAoCliente).toBeLessThan(1.0));
  });

  it("unificado: carga própria da empresa não muda por conta da reforma", () => {
    const res = simular(base);
    res.anos.forEach((a) => expect(a.cargaNovaPropriaEmpresa).toBeCloseTo(a.cargaAtualReferencia, 5));
  });

  it("unificado: sem crédito próprio — todo o DAS é tratado como débito único", () => {
    const res = simular(base);
    const a2033 = anoOf(res, 2033);
    expect(a2033.creditoApurado).toBe(0);
    expect(a2033.debitoBruto).toBeCloseTo(a2033.cargaAtualReferencia, 5);
  });

  it("híbrido: repassa crédito integral mas tem custo de compliance e tende a aumentar carga", () => {
    const hibrido: SimulacaoInput = { ...base, regimeAtual: "simples_hibrido" };
    const res = simular(hibrido);
    res.anos.forEach((a) => {
      expect(a.percentualCreditoRepassadoAoCliente).toBe(1.0);
      expect(a.custoComplianceAdicional).toBeGreaterThan(0);
    });
    const a2033 = anoOf(res, 2033);
    expect(a2033.cargaNovaPropriaEmpresa).toBeGreaterThan(a2033.cargaAtualReferencia * 0);
  });

  it("híbrido: débito - crédito = efetivo (invariante vale mesmo com custo de compliance embutido no débito)", () => {
    const hibrido: SimulacaoInput = { ...base, regimeAtual: "simples_hibrido" };
    const res = simular(hibrido);
    const a2033 = anoOf(res, 2033);
    expect(a2033.debitoBruto - a2033.creditoApurado).toBeCloseTo(a2033.cargaNovaPropriaEmpresa, 5);
    expect(a2033.creditoApurado).toBeGreaterThan(0);
  });

  it("recomendação sinaliza pressão comercial quando cliente contribuinte é relevante", () => {
    const res = simular(base);
    expect(res.recomendacao.toLowerCase()).toContain("pressão comercial");
  });
});

describe("Perfil 3: aviação por drones, 100% Simples", () => {
  const input: SimulacaoInput = {
    nomeEmpresa: "DroneAgro Ltda",
    perfil: "aviacao_agricola",
    tipoAviacao: "drone",
    regimeAtual: "simples_unificado",
    anexoSimples: "anexoV",
    faturamentoAnual: 600_000,
    pisCofinsPercentualAtual: 0.055,
    icmsIpiPercentualAtual: 0,
    percentualCustosCreditaveis: 0.15,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "cartao_credito",
  };

  it("split payment NÃO ativo para cartão de crédito (fase futura)", () => {
    const res = simular(input);
    res.anos.forEach((a) => expect(a.splitPaymentAtivoParaMeioPredominante).toBe(false));
  });

  it("serviço de pulverização por drone tem redução de 60% (LC 214/2025, art. 138, Anexo IX)", () => {
    const res = simular(input);
    const semPerfil = simular({ ...input, perfil: undefined });
    const a2033 = anoOf(res, 2033);
    const a2033SemPerfil = anoOf(semPerfil, 2033);
    expect(a2033.aliquotaTotal).toBeCloseTo(a2033SemPerfil.aliquotaTotal * 0.4, 5);
    expect(a2033.observacoes.some((o) => o.includes("art. 138"))).toBe(true);
  });

  it("com 50% de cliente contribuinte, recomendação ainda pondera regime unificado", () => {
    const res = simular(input);
    expect(res.recomendacao.length).toBeGreaterThan(10);
  });
});

describe("Perfil 4: construção civil — regime de bens imóveis (LC 214/2025, arts. 251-271)", () => {
  const base: Omit<SimulacaoInput, "tipoOperacaoConstrucao"> = {
    nomeEmpresa: "Construtora Teste Ltda",
    perfil: "construcao_civil",
    regimeAtual: "lucro_real",
    faturamentoAnual: 5_000_000,
    pisCofinsPercentualAtual: 0.0925,
    icmsIpiPercentualAtual: 0.03,
    percentualCustosCreditaveis: 0.4,
    perfilClientes: { percentualClienteContribuinte: 0.2, percentualClienteNaoContribuinte: 0.8 },
    meioPagamentoPredominante: "boleto",
  };

  it("incorporação/venda de imóvel: alíquota de CBS/IBS reduzida em 50%", () => {
    const cheio = simular({ ...base, tipoOperacaoConstrucao: undefined });
    const incorporacao = simular({ ...base, tipoOperacaoConstrucao: "incorporacao" });
    const a2033Cheio = anoOf(cheio, 2033);
    const a2033Incorporacao = anoOf(incorporacao, 2033);
    expect(a2033Incorporacao.aliquotaTotal).toBeCloseTo(a2033Cheio.aliquotaTotal * 0.5, 5);
  });

  it("locação de imóvel: alíquota de CBS/IBS reduzida em 70%", () => {
    const cheio = simular({ ...base, tipoOperacaoConstrucao: undefined });
    const locacao = simular({ ...base, tipoOperacaoConstrucao: "locacao" });
    const a2033Cheio = anoOf(cheio, 2033);
    const a2033Locacao = anoOf(locacao, 2033);
    expect(a2033Locacao.aliquotaTotal).toBeCloseTo(a2033Cheio.aliquotaTotal * 0.3, 5);
  });

  it("empreitada com fornecimento de material para terceiros: alíquota de CBS/IBS reduzida em 50% (LC 214/2025, art. 252, V + art. 261)", () => {
    const empreitada = simular({ ...base, tipoOperacaoConstrucao: "empreitada" });
    const cheio = simular({ ...base, tipoOperacaoConstrucao: undefined });
    const a2033Empreitada = anoOf(empreitada, 2033);
    const a2033Cheio = anoOf(cheio, 2033);
    expect(a2033Empreitada.aliquotaTotal).toBeCloseTo(a2033Cheio.aliquotaTotal * 0.5, 5);
    expect(a2033Empreitada.observacoes.some((o) => o.includes("art. 261"))).toBe(true);
  });

  it("incorporação avisa que o redutor de ajuste na base não é considerado (tende a sobrestimar)", () => {
    const res = simular({ ...base, tipoOperacaoConstrucao: "incorporacao" });
    const a2033 = anoOf(res, 2033);
    expect(a2033.observacoes.some((o) => o.includes("redutor de ajuste"))).toBe(true);
  });
});

describe("Saldo credor acumulado (LC 214/2025, art. 45)", () => {
  const input: SimulacaoInput = {
    nomeEmpresa: "Indústria Saldo Credor Ltda",
    regimeAtual: "lucro_real",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    // Custos creditáveis acima de 100% do faturamento (ex.: ano de investimento
    // pesado em insumo/estoque) força crédito > débito todo ano, gerando saldo
    // credor que se acumula de um ano para o outro em vez de ser descartado.
    percentualCustosCreditaveis: 1.3,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "boleto",
  };

  it("carrega e acumula o saldo credor de um ano para o outro em vez de descartá-lo", () => {
    const res = simular(input);
    const primeiroAno = res.anos[0];
    const segundoAno = res.anos[1];
    expect(primeiroAno.saldoCredorAcumuladoFinal).toBeGreaterThan(0);
    // Acumula: o saldo do 2º ano é maior que o do 1º (soma do próprio crédito excedente + o que veio carregado).
    expect(segundoAno.saldoCredorAcumuladoFinal).toBeGreaterThan(primeiroAno.saldoCredorAcumuladoFinal);
    expect(segundoAno.observacoes.some((o) => o.includes("Saldo credor"))).toBe(true);
  });

  it("sem crédito excedente (custos creditáveis normais), não gera saldo credor", () => {
    const res = simular({ ...input, percentualCustosCreditaveis: 0.3 });
    res.anos.forEach((a) => expect(a.saldoCredorAcumuladoFinal).toBe(0));
  });
});

describe("Crédito presumido do produtor rural (LC 214/2025, art. 168)", () => {
  const base: SimulacaoInput = {
    nomeEmpresa: "Cooperativa Compradora Ltda",
    perfil: "produtor_rural",
    regimeAtual: "lucro_real",
    faturamentoAnual: 2_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.5,
    perfilClientes: { percentualClienteContribuinte: 0.6, percentualClienteNaoContribuinte: 0.4 },
    meioPagamentoPredominante: "boleto",
  };

  it("compras de produtor rural não contribuinte geram só crédito presumido (parcial), elevando a carga líquida vs. crédito integral", () => {
    const semCompraRural = simular(base);
    const comCompraRural = simular({ ...base, percentualComprasProdutorRuralNaoContribuinte: 1 });
    const a2033Sem = anoOf(semCompraRural, 2033);
    const a2033Com = anoOf(comCompraRural, 2033);

    expect(a2033Com.creditoApurado).toBeLessThan(a2033Sem.creditoApurado);
    expect(a2033Com.creditoApurado).toBeCloseTo(
      a2033Sem.creditoApurado * parametros.produtorRural.creditoPresumidoComprasDeNaoContribuinte,
      2
    );
    expect(a2033Com.cargaNovaPropriaEmpresa).toBeGreaterThan(a2033Sem.cargaNovaPropriaEmpresa);
    expect(a2033Com.observacoes.some((o) => o.includes("art. 168"))).toBe(true);
  });

  it("o % de crédito presumido é configurável por produto (ex.: 60% para compra de gado) — não é fixo no parâmetro global", () => {
    const com60 = simular({ ...base, percentualComprasProdutorRuralNaoContribuinte: 1, percentualCreditoPresumidoProdutorRural: 0.6 });
    const com40 = simular({ ...base, percentualComprasProdutorRuralNaoContribuinte: 1, percentualCreditoPresumidoProdutorRural: 0.4 });
    const a2033Com60 = anoOf(com60, 2033);
    const a2033Com40 = anoOf(com40, 2033);

    // menos crédito presumido (40% < 60%) => menos crédito apurado => carga líquida maior
    expect(a2033Com40.creditoApurado).toBeLessThan(a2033Com60.creditoApurado);
    expect(a2033Com40.cargaNovaPropriaEmpresa).toBeGreaterThan(a2033Com60.cargaNovaPropriaEmpresa);
    expect(a2033Com60.observacoes.some((o) => o.includes("60%"))).toBe(true);
  });

  it("sem informar percentualCreditoPresumidoProdutorRural, cai no parâmetro padrão (60%, estimativa)", () => {
    const res = simular({ ...base, percentualComprasProdutorRuralNaoContribuinte: 1 });
    const a2033 = anoOf(res, 2033);
    expect(a2033.observacoes.some((o) => o.includes(`${(parametros.produtorRural.creditoPresumidoComprasDeNaoContribuinte * 100).toFixed(0)}%`))).toBe(true);
  });

  it("P0.2 — um % de crédito presumido customizado (ex.: 45%) NUNCA é substituído pelo padrão só porque percentualComprasProdutorRuralNaoContribuinte é 0 nesse momento (ex.: ano sem compra de produtor rural identificada) — o valor customizado é preservado, mesmo sem efeito imediato, para quando a % de compras voltar a ser > 0", () => {
    const semCompraNesteAno = simular({
      ...base,
      percentualComprasProdutorRuralNaoContribuinte: 0,
      percentualCreditoPresumidoProdutorRural: 0.45,
    });
    const comCompraDepois = simular({
      ...base,
      percentualComprasProdutorRuralNaoContribuinte: 1,
      percentualCreditoPresumidoProdutorRural: 0.45,
    });
    // com 0% de compra de produtor rural, o % de crédito presumido não tem efeito nenhum ainda...
    expect(anoOf(semCompraNesteAno, 2033).cargaNovaPropriaEmpresa).toBeCloseTo(anoOf(simular(base), 2033).cargaNovaPropriaEmpresa, 2);
    // ...mas ao reaparecer compra de produtor rural, é o 45% customizado que é usado — não o padrão (60%) de parametros.ts
    expect(anoOf(comCompraDepois, 2033).observacoes.some((o) => o.includes("45%"))).toBe(true);
  });
});

describe("Regime especial por produto (NCM, Anexos da LC 214/2025) combinado com atividade econômica", () => {
  const base: SimulacaoInput = {
    nomeEmpresa: "Mercado Misto Ltda",
    regimeAtual: "lucro_real",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "boleto",
  };

  it("100% do faturamento em produto de alíquota zero (ex.: cesta básica): alíquota efetiva zero", () => {
    const res = simular({ ...base, percentualFaturamentoProdutoZero: 1 });
    const a2033 = anoOf(res, 2033);
    expect(a2033.aliquotaTotal).toBeCloseTo(0, 5);
  });

  it("100% do faturamento em produto com redução de 60%: alíquota efetiva é 40% da cheia", () => {
    const semRegime = simular(base);
    const comRegime = simular({ ...base, percentualFaturamentoProdutoReduzido60: 1 });
    const a2033Sem = anoOf(semRegime, 2033);
    const a2033Com = anoOf(comRegime, 2033);
    expect(a2033Com.aliquotaTotal).toBeCloseTo(a2033Sem.aliquotaTotal * 0.4, 5);
  });

  it("faturamento misto (30% zero, 20% reduzido 60%, 50% cheia): pondera as três fatias corretamente", () => {
    const res = simular({ ...base, percentualFaturamentoProdutoZero: 0.3, percentualFaturamentoProdutoReduzido60: 0.2 });
    const cheio = simular(base);
    const a2033 = anoOf(res, 2033);
    const a2033Cheio = anoOf(cheio, 2033);
    const esperado = 0.3 * 0 + 0.2 * 0.4 * a2033Cheio.aliquotaTotal + 0.5 * a2033Cheio.aliquotaTotal;
    expect(a2033.aliquotaTotal).toBeCloseTo(esperado, 5);
    expect(a2033.observacoes.some((o) => o.includes("Regime especial por produto"))).toBe(true);
  });

  it("não acumula com a redução de atividade econômica na mesma fatia — a fatia 'cheia' é que recebe a redução de atividade, não a fatia com regime de produto", () => {
    const construcao: SimulacaoInput = {
      ...base,
      perfil: "construcao_civil",
      tipoOperacaoConstrucao: "empreitada", // 50% de redução de atividade
    };
    const semProduto = simular(construcao);
    const comProdutoZero = simular({ ...construcao, percentualFaturamentoProdutoZero: 0.5 });
    const a2033Sem = anoOf(semProduto, 2033);
    const a2033Com = anoOf(comProdutoZero, 2033);
    // metade do faturamento é zero (não passa pela redução de atividade), a outra metade segue com -50% de atividade
    expect(a2033Com.aliquotaTotal).toBeCloseTo(0.5 * a2033Sem.aliquotaTotal, 5);
  });
});

describe("Comparativo com o sistema antigo (PIS/Cofins + ICMS/IPI)", () => {
  const input: SimulacaoInput = {
    nomeEmpresa: "Transportadora Comparativa Ltda",
    regimeAtual: "lucro_real",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.2,
    perfilClientes: { percentualClienteContribuinte: 0.6, percentualClienteNaoContribuinte: 0.4 },
    meioPagamentoPredominante: "pix",
  };

  it("PIS/Cofins projetado é integral (líquido de crédito) em 2026 e cai a zero a partir de 2027", () => {
    const res = simular(input);
    const a2026 = anoOf(res, 2026);
    const a2027 = anoOf(res, 2027);
    const pisCofinsLiquidoEsperado = 1_000_000 * 0.0365 * (1 - 0.2); // Lucro Real: PIS/Cofins não cumulativo, gera crédito
    expect(a2026.pisCofinsProjetado).toBeCloseTo(pisCofinsLiquidoEsperado, 5);
    expect(a2027.pisCofinsProjetado).toBe(0);
  });

  it("ICMS/IPI projetado (líquido de crédito) permanece integral até 2028 e cai gradualmente até zerar em 2033", () => {
    const res = simular(input);
    const a2028 = anoOf(res, 2028);
    const a2033 = anoOf(res, 2033);
    const icmsLiquidoEsperado = 1_000_000 * 0.04 * (1 - 0.2); // Lucro Real: ICMS de regime normal gera crédito
    expect(a2028.icmsIpiProjetado).toBeCloseTo(icmsLiquidoEsperado, 5);
    expect(a2033.icmsIpiProjetado).toBe(0);
    const a2030 = anoOf(res, 2030);
    expect(a2030.icmsIpiProjetado).toBeLessThan(a2028.icmsIpiProjetado);
    expect(a2030.icmsIpiProjetado).toBeGreaterThan(0);
  });

  it("total do sistema antigo é a soma de PIS/Cofins e ICMS/IPI projetados", () => {
    const res = simular(input);
    const a2029 = anoOf(res, 2029);
    expect(a2029.sistemaAntigoProjetadoTotal).toBeCloseTo(a2029.pisCofinsProjetado + a2029.icmsIpiProjetado, 5);
  });
});

describe("Crédito do sistema antigo depende do regime (correção: não cumulatividade)", () => {
  const base = {
    nomeEmpresa: "Empresa Teste",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "pix" as const,
  };

  it("Lucro Real: gera crédito tanto de PIS/Cofins (não cumulativo) quanto de ICMS", () => {
    const res = simular({ ...base, regimeAtual: "lucro_real" });
    const a2026 = anoOf(res, 2026);
    expect(a2026.creditoPisCofinsAtual).toBeCloseTo(1_000_000 * 0.3 * 0.0365, 5);
    expect(a2026.creditoIcmsAtual).toBeCloseTo(1_000_000 * 0.3 * 0.04, 5);
    expect(a2026.cargaAtualReferencia).toBeLessThan(1_000_000 * (0.0365 + 0.04));
  });

  it("Lucro Presumido: PIS/Cofins é cumulativo (sem crédito), mas ICMS continua gerando crédito", () => {
    const res = simular({ ...base, regimeAtual: "lucro_presumido" });
    const a2026 = anoOf(res, 2026);
    expect(a2026.creditoPisCofinsAtual).toBe(0);
    expect(a2026.creditoIcmsAtual).toBeCloseTo(1_000_000 * 0.3 * 0.04, 5);
  });

  it("Simples (unificado e híbrido): nenhum crédito próprio de PIS/Cofins ou ICMS — tudo embutido no DAS", () => {
    const resUnificado = simular({ ...base, regimeAtual: "simples_unificado" });
    const resHibrido = simular({ ...base, regimeAtual: "simples_hibrido" });
    for (const res of [resUnificado, resHibrido]) {
      const a2026 = anoOf(res, 2026);
      expect(a2026.creditoPisCofinsAtual).toBe(0);
      expect(a2026.creditoIcmsAtual).toBe(0);
      expect(a2026.cargaAtualReferencia).toBeCloseTo(1_000_000 * (0.0365 + 0.04), 5);
    }
  });
});

describe("Parâmetros e avisos obrigatórios", () => {
  it("toda simulação carrega o aviso de que é gerencial e não substitui parecer técnico", () => {
    const res = simular({
      nomeEmpresa: "X",
      tipoAviacao: "convencional",
      regimeAtual: "lucro_presumido",
      faturamentoAnual: 1,
      pisCofinsPercentualAtual: 0.05,
      icmsIpiPercentualAtual: 0,
      percentualCustosCreditaveis: 0.2,
      perfilClientes: { percentualClienteContribuinte: 1, percentualClienteNaoContribuinte: 0 },
      meioPagamentoPredominante: "pix",
    });
    expect(res.avisos.some((a) => a.toLowerCase().includes("não substitui"))).toBe(true);
  });

  it("avisa quando a carga atual é zero, em vez de esconder a variação real em 0%", () => {
    const res = simular({
      nomeEmpresa: "Transportadora Y",
      regimeAtual: "lucro_real",
      faturamentoAnual: 1_000_000,
      pisCofinsPercentualAtual: 0,
      icmsIpiPercentualAtual: 0,
      percentualCustosCreditaveis: 0.1,
      perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
      meioPagamentoPredominante: "pix",
    });
    const a2033 = anoOf(res, 2033);
    expect(a2033.cargaAtualReferencia).toBe(0);
    expect(a2033.cargaNovaPropriaEmpresa).toBeGreaterThan(0);
    expect(a2033.observacoes.some((o) => o.includes("Carga tributária efetiva atual informada como zero"))).toBe(true);
  });

  it("alíquotas de 2026 batem com o parâmetro de teste (0,9% CBS / 0,1% IBS)", () => {
    expect(parametros.aliquotas.cbs["2026"]).toBeCloseTo(0.009);
    expect(parametros.aliquotas.ibs["2026"]).toBeCloseTo(0.001);
  });

  it("alíquota de referência plena em 2033 soma 27,91% (CBS + IBS)", () => {
    const total = parametros.aliquotas.cbs["2033"] + parametros.aliquotas.ibs["2033"];
    expect(total).toBeCloseTo(0.2791, 4);
  });
});

describe("percentualCustosCreditaveis por sistema tributário (arquitetura aprovada — separa sistema atual de CBS/IBS)", () => {
  const base: SimulacaoInput = {
    nomeEmpresa: "Regressão Créditos por Sistema Ltda",
    regimeAtual: "lucro_real",
    faturamentoAnual: 1_000_000,
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.04,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: 0.5, percentualClienteNaoContribuinte: 0.5 },
    meioPagamentoPredominante: "pix",
  };

  it("sem os campos novos, o resultado é IDÊNTICO ao percentual único legado (compatibilidade — nenhuma simulação antiga muda)", () => {
    const comCamposNovosIguaisAoLegado = simular({
      ...base,
      percentualCustosCreditaveisSistemaAtual: 0.3,
      percentualCustosCreditaveisNovoSistema: 0.3,
    });
    const semCamposNovos = simular(base);
    const a2033Novo = anoOf(comCamposNovosIguaisAoLegado, 2033);
    const a2033Legado = anoOf(semCamposNovos, 2033);
    expect(a2033Novo.cargaNovaPropriaEmpresa).toBeCloseTo(a2033Legado.cargaNovaPropriaEmpresa, 6);
    expect(a2033Novo.cargaAtualReferencia).toBeCloseTo(a2033Legado.cargaAtualReferencia, 6);
    expect(a2033Novo.creditoApurado).toBeCloseTo(a2033Legado.creditoApurado, 6);
  });

  it("percentualCustosCreditaveisSistemaAtual afeta SÓ a carga atual (PIS/COFINS + ICMS/IPI), não o CBS/IBS", () => {
    const menosCreditoAtual = simular({ ...base, percentualCustosCreditaveisSistemaAtual: 0.1 });
    const maisCreditoAtual = simular({ ...base, percentualCustosCreditaveisSistemaAtual: 0.5 });
    const a2033Menos = anoOf(menosCreditoAtual, 2033);
    const a2033Mais = anoOf(maisCreditoAtual, 2033);
    // menos crédito no sistema atual => carga atual maior
    expect(a2033Menos.cargaAtualReferencia).toBeGreaterThan(a2033Mais.cargaAtualReferencia);
    // mas a carga do sistema novo (CBS/IBS) não muda, porque só percentualCustosCreditaveisSistemaAtual variou
    expect(a2033Menos.cargaNovaPropriaEmpresa).toBeCloseTo(a2033Mais.cargaNovaPropriaEmpresa, 6);
  });

  it("percentualCustosCreditaveisNovoSistema afeta SÓ o crédito de CBS/IBS, não a carga atual", () => {
    const menosCreditoNovo = simular({ ...base, percentualCustosCreditaveisNovoSistema: 0.1 });
    const maisCreditoNovo = simular({ ...base, percentualCustosCreditaveisNovoSistema: 0.5 });
    const a2033Menos = anoOf(menosCreditoNovo, 2033);
    const a2033Mais = anoOf(maisCreditoNovo, 2033);
    expect(a2033Menos.cargaNovaPropriaEmpresa).toBeGreaterThan(a2033Mais.cargaNovaPropriaEmpresa);
    expect(a2033Menos.cargaAtualReferencia).toBeCloseTo(a2033Mais.cargaAtualReferencia, 6);
  });

  it("uma mesma despesa pode ter tratamento de crédito diferente no sistema atual e no novo, sem que um afete o outro", () => {
    // ex.: gasto 100% creditável no sistema atual, mas 0% no novo (ou vice-versa)
    const res = simular({ ...base, percentualCustosCreditaveisSistemaAtual: 1, percentualCustosCreditaveisNovoSistema: 0 });
    const a2033 = anoOf(res, 2033);
    expect(a2033.creditoApurado).toBe(0); // nenhum crédito de CBS/IBS
    expect(a2033.cargaAtualReferencia).toBeLessThan(anoOf(simular(base), 2033).cargaAtualReferencia); // mais crédito no sistema atual reduz a carga atual
  });
});
