import { describe, it, expect } from "vitest";
import {
  identificarPerfilPorCnae,
  categoriasDespesaDoPerfil,
  categoriasGenericasDaNatureza,
  percentualCustosCreditaveisDeDespesas,
} from "../atividades";

describe("identificarPerfilPorCnae", () => {
  it("identifica aviação agrícola pelo CNAE exato 0161-0/03", () => {
    expect(identificarPerfilPorCnae("0161-0/03")).toBe("aviacao_agricola");
    expect(identificarPerfilPorCnae("0161003")).toBe("aviacao_agricola");
  });

  it("identifica produtor rural por qualquer CNAE da divisão 01", () => {
    expect(identificarPerfilPorCnae("0111-3/01")).toBe("produtor_rural");
    expect(identificarPerfilPorCnae("0151-2/01")).toBe("produtor_rural");
  });

  it("identifica transporte rodoviário de cargas pelo grupo 4930", () => {
    expect(identificarPerfilPorCnae("4930-2/02")).toBe("transporte_rodoviario_cargas");
    expect(identificarPerfilPorCnae("4930-2/01")).toBe("transporte_rodoviario_cargas");
    expect(identificarPerfilPorCnae("4930-2/03")).toBe("transporte_rodoviario_cargas");
  });

  it("aceita CNAE como número (formato retornado pela BrasilAPI, ex.: cnae_fiscal)", () => {
    expect(identificarPerfilPorCnae(4930201)).toBe("transporte_rodoviario_cargas");
    expect(identificarPerfilPorCnae(161003)).toBe("aviacao_agricola");
  });

  it("identifica construção civil pelas divisões 41, 42 e 43", () => {
    expect(identificarPerfilPorCnae("4110-7/00")).toBe("construcao_civil");
    expect(identificarPerfilPorCnae("4211-1/01")).toBe("construcao_civil");
    expect(identificarPerfilPorCnae("4399-1/03")).toBe("construcao_civil");
  });

  it("retorna null para CNAE fora do escopo do simulador", () => {
    expect(identificarPerfilPorCnae("6201-5/01")).toBeNull();
  });
});

describe("categoriasDespesaDoPerfil", () => {
  it("retorna categorias específicas de aviação agrícola", () => {
    const categorias = categoriasDespesaDoPerfil("aviacao_agricola");
    expect(categorias.some((c) => c.chave === "combustivelAviacao")).toBe(true);
  });

  it("retorna categorias específicas de produtor rural, incluindo redução de alíquota em insumos", () => {
    const categorias = categoriasDespesaDoPerfil("produtor_rural");
    const insumos = categorias.find((c) => c.chave === "insumosAgropecuarios");
    expect(insumos?.reducaoAliquota).toBe(true);
  });

  it("retorna as 6 categorias de despesa de transporte rodoviário de cargas", () => {
    const categorias = categoriasDespesaDoPerfil("transporte_rodoviario_cargas");
    const chaves = categorias.map((c) => c.chave);
    expect(chaves).toEqual(["combustivel", "manutencao", "pneus", "pedagio", "estadias", "outras"]);
  });

  it("retorna categorias específicas de construção civil", () => {
    const categorias = categoriasDespesaDoPerfil("construcao_civil");
    const chaves = categorias.map((c) => c.chave);
    expect(chaves).toContain("materiaisConstrucao");
    expect(chaves).toContain("servicosEspecializados");
  });
});

describe("percentualCustosCreditaveisDeDespesas", () => {
  it("soma despesas e calcula % do faturamento", () => {
    const pct = percentualCustosCreditaveisDeDespesas(
      { combustivelAviacao: 100_000, manutencaoAeronaveDrone: 50_000 },
      1_000_000
    );
    expect(pct).toBeCloseTo(0.15);
  });

  it("nunca ultrapassa 100% mesmo com despesas maiores que o faturamento", () => {
    const pct = percentualCustosCreditaveisDeDespesas({ x: 2_000_000 }, 1_000_000);
    expect(pct).toBe(1);
  });

  it("retorna 0 quando faturamento é zero", () => {
    expect(percentualCustosCreditaveisDeDespesas({ x: 100 }, 0)).toBe(0);
  });
});

describe("categoriasDespesaDoPerfil — migração para CategoriaGasto (Etapa B) preserva o comportamento numérico antigo", () => {
  it("toda categoria dos 4 setores específicos continua 'creditavel' nos 3 sistemas, status 'herdado' (nenhuma simulação antiga muda até revisão individual)", () => {
    for (const perfil of ["aviacao_agricola", "produtor_rural", "transporte_rodoviario_cargas", "construcao_civil"] as const) {
      for (const cat of categoriasDespesaDoPerfil(perfil)) {
        expect(cat.creditoPisCofins.tratamento).toBe("creditavel");
        expect(cat.creditoIcmsIpi.tratamento).toBe("creditavel");
        expect(cat.creditoIbsCbs.tratamento).toBe("creditavel");
        expect(cat.creditoPisCofins.status).toBe("herdado");
        expect(cat.creditoIcmsIpi.status).toBe("herdado");
        expect(cat.creditoIbsCbs.status).toBe("herdado");
      }
    }
  });

  it("mão de obra própria (folha) de construção civil é sinalizada com naturezaEconomica correta, mesmo mantendo o tratamento herdado", () => {
    const categorias = categoriasDespesaDoPerfil("construcao_civil");
    const folha = categorias.find((c) => c.chave === "maoDeObraPropria");
    expect(folha?.naturezaEconomica).toBe("folha_e_encargos");
    // preserva o número (não muda o resultado de simulações antigas), mas a observação sinaliza a pendência de revisão
    expect(folha?.creditoIbsCbs.tratamento).toBe("creditavel");
    expect(folha?.creditoIbsCbs.observacao).toMatch(/revis/i);
  });
});

describe("categoriasGenericasDaNatureza — defaults corretos por natureza econômica (categorias novas, sem número legado a preservar)", () => {
  it("folha e encargos nunca é creditável, com status confirmado (fato estrutural da LC 214/2025, não estimativa)", () => {
    for (const natureza of ["servico", "industria", "comercio", "outras"] as const) {
      const folha = categoriasGenericasDaNatureza(natureza).find((c) => c.naturezaEconomica === "folha_e_encargos");
      expect(folha?.creditoIbsCbs.tratamento).toBe("nao_creditavel");
      expect(folha?.creditoPisCofins.tratamento).toBe("nao_creditavel");
      expect(folha?.creditoIcmsIpi.tratamento).toBe("nao_creditavel");
      expect(folha?.creditoIbsCbs.status).toBe("confirmado");
    }
  });

  it("despesa administrativa genérica é indeterminada, sem premissa (credita 0% até ser detalhada — nunca otimista por omissão)", () => {
    const admin = categoriasGenericasDaNatureza("servico").find((c) => c.naturezaEconomica === "despesa_administrativa");
    expect(admin?.creditoIbsCbs.tratamento).toBe("indeterminado");
    expect(admin?.creditoIbsCbs.percentualPremissaCalculo).toBeUndefined();
    expect(admin?.creditoIbsCbs.status).toBe("estimado");
  });

  it("custo direto/operacional genérico é creditável, mas status 'estimado' (categoria nova, ainda não é um setor revisado)", () => {
    const direto = categoriasGenericasDaNatureza("comercio").find((c) => c.chave === "cmvComercio");
    expect(direto?.creditoIbsCbs.tratamento).toBe("creditavel");
    expect(direto?.creditoIbsCbs.status).toBe("estimado");
  });

  it("benefícios relacionados a empregados NÃO herdam o tratamento da folha — ficam indeterminados, não automaticamente não-creditáveis", () => {
    for (const natureza of ["servico", "industria", "comercio", "outras"] as const) {
      const categorias = categoriasGenericasDaNatureza(natureza);
      const folha = categorias.find((c) => c.naturezaEconomica === "folha_e_encargos");
      const beneficios = categorias.find((c) => c.naturezaEconomica === "beneficios_pessoal");
      expect(folha?.creditoIbsCbs.tratamento).toBe("nao_creditavel");
      // são dimensões separadas: benefícios não é "nao_creditavel" só porque a folha é
      expect(beneficios?.creditoIbsCbs.tratamento).toBe("indeterminado");
      expect(beneficios?.creditoIbsCbs.percentualPremissaCalculo).toBeUndefined();
      expect(beneficios?.creditoIbsCbs.status).toBe("estimado");
    }
  });

  it("cobre as 4 naturezas de operação genérica (serviço, indústria, comércio, outras)", () => {
    for (const natureza of ["servico", "industria", "comercio", "outras"] as const) {
      expect(categoriasGenericasDaNatureza(natureza).length).toBeGreaterThan(0);
    }
  });
});
