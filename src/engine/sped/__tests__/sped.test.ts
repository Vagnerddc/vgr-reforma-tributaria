import { describe, it, expect } from "vitest";
import { tokenizarSped, numeroSped, identificarTipoArquivo } from "../parser";
import { processarEfdIcmsIpi } from "../efdIcmsIpi";
import { processarEfdContribuicoes } from "../efdContribuicoes";
import { processarEcd } from "../ecd";
import { processarEcf } from "../ecf";
import { agregarDadosCliente, aplicarEnriquecimentoParticipantes } from "../agregador";

const EFD_ICMS_IPI = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0150|PART002|JOAO DA SILVA|1058||11122233344||||||
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|1700,00|1700,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|DESCRICAO PRODUTO|1|UN|10000,00|0,00|0|000|5101|
|C100|0|0|PART002|55|00|456|CHAVE_YYY|10012026|10012026|2000,00|0|0,00|0,00|2000,00|0|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|SERV001|MATERIAL DIVERSO|1|UN|2000,00|0,00|0|000|1556|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|850,00|0,00|
`.trim();

const EFD_CONTRIBUICOES = `
|0000|005|0|||01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0150|PART003|CONSULTORIA XYZ LTDA|1058|98765432000155||||||||
|A100|0|0|PART003|00|1|1|789|CHAVE_NFSE|20012026|20012026|1500,00|0|0,00|
|M200|0,00|0,00|0,00|0,00|0,00|320,00|0,00|0,00|0,00|0,00|0,00|0,00|320,00|
|M600|0,00|0,00|0,00|0,00|0,00|620,00|0,00|0,00|0,00|0,00|0,00|0,00|620,00|
`.trim();

const ECD = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|03|A|4|41101001|41101|4.1.1.01.001|DESPESAS ADMINISTRATIVAS - MATERIAL DE ESCRITORIO|
|I050|01012026|03|A|4|31101001|31101|3.1.1.01.001|CUSTO DAS MERCADORIAS VENDIDAS|
|I155|41101001||0,00|D|3000,00|0,00|3000,00|D|
|I155|31101001||0,00|D|5000,00|0,00|5000,00|D|
`.trim();

describe("tokenizarSped / numeroSped", () => {
  it("tokeniza linhas removendo os pipes de borda e separando reg dos campos", () => {
    const registros = tokenizarSped("|C170|1|PROD001|10000,00|");
    expect(registros).toHaveLength(1);
    expect(registros[0].reg).toBe("C170");
    expect(registros[0].campos).toEqual(["1", "PROD001", "10000,00"]);
  });

  it("converte número no formato SPED (vírgula decimal, ponto de milhar)", () => {
    expect(numeroSped("1.234,56")).toBeCloseTo(1234.56);
    expect(numeroSped("")).toBe(0);
    expect(numeroSped(undefined)).toBe(0);
  });
});

describe("identificarTipoArquivo", () => {
  it("identifica cada tipo de arquivo pelo conjunto de registros presentes", () => {
    expect(identificarTipoArquivo(tokenizarSped(EFD_ICMS_IPI))).toBe("efd_icms_ipi");
    expect(identificarTipoArquivo(tokenizarSped(EFD_CONTRIBUICOES))).toBe("efd_contribuicoes");
    expect(identificarTipoArquivo(tokenizarSped(ECD))).toBe("ecd");
  });
});

describe("processarEfdIcmsIpi", () => {
  const resultado = processarEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);

  it("extrai participantes com CNPJ e CPF", () => {
    expect(resultado.participantes).toHaveLength(2);
    expect(resultado.participantes.find((p) => p.codPart === "PART001")?.cnpj).toBe("12345678000100");
    expect(resultado.participantes.find((p) => p.codPart === "PART002")?.cpf).toBe("11122233344");
  });

  it("classifica saída CFOP 5101 como faturamento e entrada CFOP 1556 como uso e consumo", () => {
    const faturamento = resultado.movimentos.find((m) => m.cfop === "5101");
    const usoConsumo = resultado.movimentos.find((m) => m.cfop === "1556");
    expect(faturamento?.natureza).toBe("faturamento");
    expect(faturamento?.valorItem).toBeCloseTo(10000);
    expect(usoConsumo?.natureza).toBe("usoConsumo");
    expect(usoConsumo?.valorItem).toBeCloseTo(2000);
  });

  it("extrai o valor de ICMS a recolher do registro E110", () => {
    expect(resultado.apuracoes).toEqual([{ tributo: "icms", periodo: "31012026", valorRecolher: 850 }]);
  });
});

describe("processarEfdIcmsIpi — classificação estrutural por TIPO_ITEM (registro 0200)", () => {
  const EFD_COM_0200 = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0200|MAT001|CIMENTO CP-II|||SC|01|2523.29.10|||18|
|0200|ATIVO001|EMPILHADEIRA|||UN|08|8427.20.90|||18|
|C100|0|0|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|MAT001|CIMENTO|1|UN|10000,00|0,00|0|000|9999|
|C170|2|ATIVO001|EMPILHADEIRA|1|UN|5000,00|0,00|0|000|9999|
`.trim();

  it("usa TIPO_ITEM (não o CFOP) para classificar quando o item está cadastrado no 0200, mesmo com CFOP fora da tabela conhecida", () => {
    const resultado = processarEfdIcmsIpi("icms_0200.txt", EFD_COM_0200);
    const cimento = resultado.movimentos.find((m) => m.cfop === "9999" && m.valorItem === 10000);
    const empilhadeira = resultado.movimentos.find((m) => m.cfop === "9999" && m.valorItem === 5000);
    expect(cimento?.natureza).toBe("custoMercadoriaInsumo");
    expect(empilhadeira?.natureza).toBe("imobilizado");
  });

  it("carrega o NCM do registro 0200 no movimento", () => {
    const resultado = processarEfdIcmsIpi("icms_0200.txt", EFD_COM_0200);
    const cimento = resultado.movimentos.find((m) => m.valorItem === 10000);
    expect(cimento?.ncm).toBe("2523.29.10");
  });

  it("sem item cadastrado no 0200, cai de volta no CFOP (comportamento original preservado)", () => {
    const resultado = processarEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    const faturamento = resultado.movimentos.find((m) => m.cfop === "5101");
    expect(faturamento?.natureza).toBe("faturamento");
    expect(faturamento?.ncm).toBeUndefined();
  });
});

describe("processarEfdContribuicoes", () => {
  const resultado = processarEfdContribuicoes("contribuicoes.txt", EFD_CONTRIBUICOES);

  it("extrai serviço tomado (A100 entrada) como despesa operacional", () => {
    const servico = resultado.movimentos.find((m) => m.codPart === "PART003");
    expect(servico?.natureza).toBe("despesaOperacional");
    expect(servico?.valorItem).toBeCloseTo(1500);
  });

  it("extrai PIS (M200) e Cofins (M600) a recolher, mesmo com o layout oficial de 12 campos (sem campo extra) — achado em EFD real de produção", () => {
    const efdReal = `
|0000|006|0|||01012026|31012026|EMPRESA TESTE|12345678000199|MS|123456|0||00|1|
|M200|0,00|0,00|0,00|0,00|0,00|0,00|0,00|11522,86|0,00|0,00|11522,86|11522,86|
|M600|0,00|0,00|0,00|0,00|0,00|0,00|0,00|53182,43|0,00|0,00|53182,43|53182,43|
|F550|1772747,80|01|0,00|1772747,80|0,6500|11522,86|01|0,00|1772747,80|3,0000|53182,43|98||405||
`.trim();
    const res = processarEfdContribuicoes("efd_real.txt", efdReal);
    expect(res.apuracoes).toEqual(
      expect.arrayContaining([
        { tributo: "pis", periodo: "31012026", valorRecolher: 11522.86 },
        { tributo: "cofins", periodo: "31012026", valorRecolher: 53182.43 },
      ])
    );
    expect(res.receitaConsolidada).toBeCloseTo(1772747.8);
  });

  it("extrai PIS (M200) e Cofins (M600) a recolher", () => {
    expect(resultado.apuracoes).toEqual(
      expect.arrayContaining([
        { tributo: "pis", periodo: "31012026", valorRecolher: 320 },
        { tributo: "cofins", periodo: "31012026", valorRecolher: 620 },
      ])
    );
  });
});

describe("processarEcd", () => {
  const resultado = processarEcd("ecd.txt", ECD);

  it("classifica contas analíticas por palavra-chave na descrição", () => {
    const administrativa = resultado.saldosContabeis.find((s) => s.codCta === "41101001");
    const custo = resultado.saldosContabeis.find((s) => s.codCta === "31101001");
    expect(administrativa?.natureza).toBe("despesaAdministrativa");
    expect(administrativa?.valorPeriodo).toBeCloseTo(3000);
    expect(custo?.natureza).toBe("custoMercadoriaInsumo");
    expect(custo?.valorPeriodo).toBeCloseTo(5000);
  });

  it("lê a descrição da conta mesmo quando o campo opcional CTA vem omitido (visto em ECD real do Domínio Sistemas, I050 com 7 campos em vez de 8)", () => {
    const ecdSemCampoCta = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012005|04|A|5|5027877|CUSTO DE MATERIAL DE CONSTRUCAO|
|I155|5027877||0,00|D|7000,00|0,00|7000,00|D|
    `.trim();
    const res = processarEcd("ecd_real.txt", ecdSemCampoCta);
    const conta = res.saldosContabeis.find((s) => s.codCta === "5027877");
    expect(conta?.descricao).toBe("CUSTO DE MATERIAL DE CONSTRUCAO");
    expect(conta?.natureza).toBe("custoMercadoriaInsumo");
    expect(conta?.valorPeriodo).toBeCloseTo(7000);
  });

  it('classifica "RECEITA DE VENDAS" como faturamento, não despesa operacional (a palavra "VENDAS" não deve vencer "RECEITA")', () => {
    const ecdReceitaDeVendas = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|A|4|1|RECEITA DE VENDAS|
|I155|1||0,00|C|0,00|10000,00|10000,00|C|
    `.trim();
    const res = processarEcd("ecd_receita_vendas.txt", ecdReceitaDeVendas);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("faturamento");
  });

  it('classifica "Despesas Bancárias Diversas" como despesa operacional creditável (serviço de terceiro sujeito a CBS/IBS) — achado em auditoria de ECD real', () => {
    const ecdDespesaBancaria = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|A|4|1|Despesas Bancárias Diversas|
|I155|1||0,00|D|500,00|0,00|500,00|D|
    `.trim();
    const res = processarEcd("ecd_despesa_bancaria.txt", ecdDespesaBancaria);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("despesaOperacional");
  });

  it('NÃO trata "Salários e Ordenados" (folha de pagamento) como despesa creditável — mão de obra própria não é compra de terceiro sujeita a CBS/IBS (regressão: um catch-all genérico de "despesa" pegaria isso errado)', () => {
    const ecdFolha = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|A|4|1|Salários e Ordenados|
|I155|1||0,00|D|8000,00|0,00|8000,00|D|
    `.trim();
    const res = processarEcd("ecd_folha.txt", ecdFolha);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("outros");
  });

  it('classifica "SERVIÇO PRESTADO" (receita própria) como faturamento, sem colidir com "SERVIÇOS PRESTADOS POR TERCEIROS" (despesa)', () => {
    const ecdServicos = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|03|A|4|1|RECEITA - SERVIÇO PRESTADO|
|I050|01012026|03|A|4|2|SERVIÇOS PRESTADOS POR TERCEIROS - MAO DE OBRA|
|I155|1||0,00|C|0,00|500000,00|500000,00|C|
|I155|2||0,00|D|80000,00|0,00|80000,00|D|
    `.trim();
    const res = processarEcd("ecd_servicos.txt", ecdServicos);
    const receita = res.saldosContabeis.find((s) => s.codCta === "1");
    const terceiros = res.saldosContabeis.find((s) => s.codCta === "2");
    expect(receita?.natureza).toBe("faturamento");
    expect(terceiros?.natureza).not.toBe("faturamento");
  });

  it('classifica "material(is) para construção" como custo, mesmo sem a palavra "custo" na descrição (achado em ECD real)', () => {
    const ecdMaterial = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|03|A|4|1|DESPESA MATERIAIS PARA CONSTRUÇÃO|
|I155|1||0,00|D|10000,00|0,00|10000,00|D|
    `.trim();
    const res = processarEcd("ecd_material.txt", ecdMaterial);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("custoMercadoriaInsumo");
  });

  it('COD_NAT de ativo (01) nunca é classificado como despesa, mesmo contendo a palavra "despesa" no texto (ex.: "despesas pagas antecipadamente" é ativo, achado em ECD real)', () => {
    const ecdAtivo = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|01|A|4|1|DESPESAS PAGAS ANTECIPADAMENTE|
|I155|1||0,00|D|9000,00|0,00|9000,00|D|
    `.trim();
    const res = processarEcd("ecd_ativo.txt", ecdAtivo);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("outros");
  });

  it('COD_NAT de passivo (02), incluindo Patrimônio Líquido, nunca é classificado como resultado', () => {
    const ecdPassivo = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|02|A|4|1|PATRIMONIO LIQUIDO - CAPITAL SOCIAL|
|I155|1||0,00|C|0,00|100000,00|100000,00|C|
    `.trim();
    const res = processarEcd("ecd_passivo.txt", ecdPassivo);
    const conta = res.saldosContabeis.find((s) => s.codCta === "1");
    expect(conta?.natureza).toBe("outros");
  });

  it("sobe a hierarquia do plano de contas (COD_CTA_SUP) quando a conta-folha não tem palavra-chave própria, herdando a classificação do grupo-pai (ex.: receita agrupada sob 'CONTAS DE RESULTADO - RECEITAS')", () => {
    const ecdHierarquia = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|S|1|1||CONTAS DE RESULTADO - RECEITAS|
|I050|01012026|04|S|2|2|1|RECEITA DE OBRAS|
|I050|01012026|04|A|3|3|2|CONTRATO 001 - CLIENTE X|
|I155|3||0,00|C|0,00|250000,00|250000,00|C|
    `.trim();
    const res = processarEcd("ecd_hierarquia.txt", ecdHierarquia);
    const conta = res.saldosContabeis.find((s) => s.codCta === "3");
    expect(conta?.natureza).toBe("faturamento");
  });

  it("sem sinal em nenhum nível (COD_NAT de resultado, mas nenhuma palavra-chave na conta nem em nenhum ancestral), cai em 'outros' — precisa de estudo manual", () => {
    const ecdSemSinal = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|S|1|1||GRUPO XYZ|
|I050|01012026|04|A|2|2|1|CONTA ABC 123|
|I155|2||0,00|D|500,00|0,00|500,00|D|
    `.trim();
    const res = processarEcd("ecd_sem_sinal.txt", ecdSemSinal);
    const conta = res.saldosContabeis.find((s) => s.codCta === "2");
    expect(conta?.natureza).toBe("outros");
  });
});

describe("processarEcf", () => {
  it("não inventa valores — sinaliza extração não implementada", () => {
    const resultado = processarEcf("ecf.txt", "|0000|X|\n|X280|Y|");
    expect(resultado.movimentos).toHaveLength(0);
    expect(resultado.avisos[0]).toContain("não implementada");
  });
});

describe("agregarDadosCliente", () => {
  const dados = agregarDadosCliente([
    { nomeArquivo: "icms.txt", conteudo: EFD_ICMS_IPI },
    { nomeArquivo: "contribuicoes.txt", conteudo: EFD_CONTRIBUICOES },
    { nomeArquivo: "ecd.txt", conteudo: ECD },
  ]);

  it("consolida faturamento a partir das EFDs", () => {
    expect(dados.faturamento).toBeCloseTo(10000);
  });

  it("usa a ECD (não a EFD) para despesas quando a ECD está presente", () => {
    expect(dados.fonteDespesas).toBe("ecd");
    expect(dados.custoMercadoriaInsumo).toBeCloseTo(5000);
    expect(dados.despesaAdministrativa).toBeCloseTo(3000);
    // despesaOperacional viria do A100 na EFD, mas como há ECD, essa fonte é descartada em favor da ECD
    expect(dados.despesaOperacional).toBe(0);
  });

  it("consolida os tributos recolhidos das duas EFDs", () => {
    expect(dados.tributosRecolhidos).toEqual({ icms: 850, pis: 320, cofins: 620 });
  });

  it("avisa explicitamente que a despesa administrativa entra por premissa herdada, não confirmação tributária (item 10 da modelagem de crédito aprovada)", () => {
    expect(dados.despesaAdministrativa).toBeGreaterThan(0);
    expect(dados.avisos.some((a) => a.includes("Despesa administrativa") && a.includes("premissa herdada"))).toBe(true);
  });

  it("dedupe participantes repetidos entre arquivos pelo CNPJ/CPF, e marca PF como pessoa física", () => {
    expect(dados.participantes).toHaveLength(3); // PART001 (repetido nas duas EFDs), PART002 (PF), PART003
    const pf = dados.participantes.find((p) => p.cpf === "11122233344");
    expect(pf?.regime).toBe("pessoa_fisica");
    expect(pf?.restringeCreditoDoCliente).toBe(true);
  });

  it("classifica o papel comercial de cada parceiro pela direção dos lançamentos", () => {
    const cliente = dados.parceirosComExposicao.find((p) => p.participante.codPart === "PART001");
    const fornecedorPF = dados.parceirosComExposicao.find((p) => p.participante.codPart === "PART002");
    const fornecedorServico = dados.parceirosComExposicao.find((p) => p.participante.codPart === "PART003");
    expect(cliente?.papel).toBe("cliente");
    expect(cliente?.valorTotal).toBeCloseTo(10000);
    expect(fornecedorPF?.papel).toBe("fornecedor");
    expect(fornecedorPF?.valorTotal).toBeCloseTo(2000);
    expect(fornecedorServico?.papel).toBe("fornecedor");
    expect(fornecedorServico?.valorTotal).toBeCloseTo(1500);
  });

  it("sem nota a nota de faturamento (só EFD ICMS/IPI de compras + EFD Contribuições consolidada via F550), usa a receita consolidada como fallback estrutural", () => {
    const efdIcmsSoCompra = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|C100|0|0|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|1700,00|1700,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|MATERIAL|1|UN|10000,00|0,00|0|000|1101|
`.trim();
    const efdContribConsolidada = `
|0000|006|0|||01012026|31012026|EMPRESA TESTE|12345678000199|MS|123456|0||00|1|
|F550|1772747,80|01|0,00|1772747,80|0,6500|11522,86|01|0,00|1772747,80|3,0000|53182,43|98||405||
|M200|0,00|0,00|0,00|0,00|0,00|0,00|0,00|11522,86|0,00|0,00|11522,86|11522,86|
|M600|0,00|0,00|0,00|0,00|0,00|0,00|0,00|53182,43|0,00|0,00|53182,43|53182,43|
`.trim();
    const dadosSemNotaVenda = agregarDadosCliente([
      { nomeArquivo: "icms_compras.txt", conteudo: efdIcmsSoCompra },
      { nomeArquivo: "contribuicoes_consolidada.txt", conteudo: efdContribConsolidada },
    ]);
    expect(dadosSemNotaVenda.faturamento).toBeCloseTo(1772747.8);
    expect(dadosSemNotaVenda.avisos.some((a) => a.includes("F500/F550"))).toBe(true);
  });

  it("segmenta o faturamento por regime especial de produto (NCM do registro 0200) — arroz (Anexo I, zero) separado do resto (alíquota cheia)", () => {
    const efdComVendaMista = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0200|ARROZ001|ARROZ TIPO 1|||SC|00|1006.20.00|||18|
|0200|OUTRO001|PRODUTO SEM NCM ESPECIAL|||UN|00|8471.30.00|||18|
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|18000,00|0|0,00|0,00|18000,00|0|0,00|0,00|0,00|1700,00|1700,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|ARROZ001|ARROZ|1|SC|10000,00|0,00|0|000|5101|
|C170|2|OUTRO001|OUTRO PRODUTO|1|UN|8000,00|0,00|0|000|5101|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
`.trim();
    const dados = agregarDadosCliente([{ nomeArquivo: "icms_misto.txt", conteudo: efdComVendaMista }]);
    expect(dados.faturamentoPorRegimeProduto.faturamentoZero).toBeCloseTo(10000);
    expect(dados.faturamentoPorRegimeProduto.faturamentoAliquotaCheia).toBeCloseTo(8000);
    expect(dados.faturamentoPorRegimeProduto.itensIdentificados).toHaveLength(1);
    expect(dados.faturamentoPorRegimeProduto.itensIdentificados[0].anexo).toBe("I");
  });

  it("conferência EFD x ECD: avisa quando o faturamento das EFDs difere significativamente do que a ECD registrou como receita (ex.: mês de EFD faltando)", () => {
    const efdComVenda = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|PRODUTO|1|UN|10000,00|0,00|0|000|5101|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
`.trim();
    const ecdComReceitaMaior = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|A|4|1|RECEITA DE VENDAS - JANEIRO|
|I050|01012026|04|A|4|2|RECEITA DE VENDAS - FEVEREIRO|
|I155|1||0,00|C|0,00|10000,00|10000,00|C|
|I155|2||0,00|C|0,00|12000,00|12000,00|C|
`.trim();
    const dados = agregarDadosCliente([
      { nomeArquivo: "icms.txt", conteudo: efdComVenda },
      { nomeArquivo: "ecd.txt", conteudo: ecdComReceitaMaior },
    ]);
    // EFD só tem janeiro (R$ 10.000), ECD já registra o ano com R$ 22.000 (jan + fev) — diferença grande, sinal de mês faltando
    expect(dados.conferenciaEfdEcd?.faturamentoEfd).toBeCloseTo(10000);
    expect(dados.conferenciaEfdEcd?.faturamentoEcd).toBeCloseTo(22000);
    expect(dados.avisos.some((a) => a.includes("Conferência EFD x ECD"))).toBe(true);
  });

  it("conferência EFD x ECD: sem diferença relevante (dentro de 5%), não gera aviso", () => {
    const efdComVenda = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|PRODUTO|1|UN|10000,00|0,00|0|000|5101|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
`.trim();
    const ecdComReceitaParecida = `
|0000|LECD|0|01012026|31122026|EMPRESA TESTE|12345678000199|
|I050|01012026|04|A|4|1|RECEITA DE VENDAS|
|I155|1||0,00|C|0,00|10200,00|10200,00|C|
`.trim();
    const dados = agregarDadosCliente([
      { nomeArquivo: "icms.txt", conteudo: efdComVenda },
      { nomeArquivo: "ecd.txt", conteudo: ecdComReceitaParecida },
    ]);
    expect(dados.avisos.some((a) => a.includes("Conferência EFD x ECD"))).toBe(false);
  });

  it("aplicarEnriquecimentoParticipantes atualiza participantes E parceirosComExposicao (a referência que o painel de fornecedores realmente lê)", () => {
    const dados = agregarDadosCliente([{ nomeArquivo: "icms.txt", conteudo: EFD_ICMS_IPI }]);
    const parceiroAntes = dados.parceirosComExposicao.find((p) => p.participante.codPart === "PART001");
    expect(parceiroAntes?.participante.regime).toBe("desconhecido");

    const enriquecido = { ...parceiroAntes!.participante, regime: "normal" as const, cnaePrincipal: "4634601" };
    const enriquecidosPorChave = new Map([[enriquecido.cnpj!, enriquecido]]);
    const resultado = aplicarEnriquecimentoParticipantes(dados, enriquecidosPorChave);

    const parceiroDepois = resultado.parceirosComExposicao.find((p) => p.participante.codPart === "PART001");
    expect(parceiroDepois?.participante.regime).toBe("normal");
    expect(parceiroDepois?.participante.cnaePrincipal).toBe("4634601");
    expect(resultado.participantes.find((p) => p.codPart === "PART001")?.regime).toBe("normal");
  });
});
