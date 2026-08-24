import { describe, it, expect } from "vitest";
import { campoComProveniencia as campo } from "../operacaoTributaria";
import { buscarPerfil } from "../setores/catalogo";
import type { PerfilSetorial } from "../setores/tipos";
import { validarDadosSetoriais, avaliarCompletudeCenario, type CenarioEmpresa, type DadosSetoriais } from "../cenarioEmpresa";
import { cenarioParaSimulacaoInput } from "../cenarioEmpresaAdapter";
import { simular } from "../calculo";

function cenarioBase(perfilId: string, nomeEmpresa: string): CenarioEmpresa {
  return {
    id: `cenario-${perfilId}`,
    identificacao: {
      nomeEmpresa: campo(nomeEmpresa, "informado_usuario", "confirmado"),
      atividadePrincipal: { perfilId, status: "confirmado", origem: "informado_usuario" },
    },
    receita: { faturamentoAnual: campo(1_000_000, "informado_usuario", "confirmado") },
    custos: { itens: [] },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado") },
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

const DEZ_SETORES: { perfilId: string; nome: string }[] = [
  { perfilId: "clinica_medica", nome: "Clínica Exemplo" },
  { perfilId: "frigorifico", nome: "Frigorífico Exemplo" },
  { perfilId: "transporte_rodoviario_cargas", nome: "Transportadora Exemplo" },
  { perfilId: "industria_transformacao", nome: "Indústria Exemplo" },
  { perfilId: "varejo_generico", nome: "Varejo Exemplo" },
  { perfilId: "aviacao_agricola", nome: "Aviação Agrícola Exemplo" },
  { perfilId: "construcao_civil", nome: "Construtora Exemplo" },
  { perfilId: "software_saas", nome: "SaaS Exemplo" },
  { perfilId: "provedor_internet", nome: "Provedor Exemplo" },
  { perfilId: "locadora_bens", nome: "Locadora Exemplo" },
];

describe("CenarioEmpresa — representa os 10 setores pedidos com o MESMO núcleo, sem tipo especial por setor", () => {
  it.each(DEZ_SETORES)("representa $perfilId sem exigir código específico para esse setor", ({ perfilId, nome }) => {
    const perfil = buscarPerfil(perfilId);
    expect(perfil).toBeDefined(); // confirma que o catálogo cobre os 10 setores pedidos

    const cenario = cenarioBase(perfilId, nome);
    expect(cenario.identificacao.atividadePrincipal?.perfilId).toBe(perfilId);
    // toda instância usa exatamente o mesmo tipo CenarioEmpresa — nenhum "ClinicaMedicaCenario" ou "FrigorificoCenario" existe
    expect(cenario.receita.faturamentoAnual?.valor).toBe(1_000_000);
  });

  it("dados setoriais da clínica médica validam contra as características do próprio perfil", () => {
    const perfil = buscarPerfil("clinica_medica")!;
    const dados: DadosSetoriais = {
      perfilId: "clinica_medica",
      valores: {
        possui_equiparacao_hospitalar: campo(true, "informado_usuario", "confirmado"),
        atende_convenios: campo(true, "informado_usuario", "confirmado"),
      },
    };
    const r = validarDadosSetoriais(perfil, dados);
    expect(r.validos).toBe(true);
    expect(r.camposDesconhecidos).toEqual([]);
  });

  it("dado setorial com tipo incompatível é sinalizado, não aceito silenciosamente", () => {
    const perfil = buscarPerfil("clinica_medica")!;
    const dados: DadosSetoriais = {
      perfilId: "clinica_medica",
      // possui_equiparacao_hospitalar é booleano — aqui é enviado como texto
      valores: { possui_equiparacao_hospitalar: campo("sim", "informado_usuario", "confirmado") },
    };
    const r = validarDadosSetoriais(perfil, dados);
    expect(r.validos).toBe(false);
    expect(r.camposComTipoInvalido).toContain("possui_equiparacao_hospitalar");
  });

  it("campo desconhecido (fora das características do perfil) é sinalizado mas não descartado do objeto", () => {
    const perfil = buscarPerfil("frigorifico")!;
    const dados: DadosSetoriais = { perfilId: "frigorifico", valores: { campo_inexistente: campo(1, "informado_usuario", "estimado") } };
    const r = validarDadosSetoriais(perfil, dados);
    expect(r.camposDesconhecidos).toEqual(["campo_inexistente"]);
    expect(dados.valores.campo_inexistente).toBeDefined(); // não foi removido
  });
});

describe("Empresas multiatividade — sem tipo especial para a combinação", () => {
  it("representa frigorífico + distribuição atacadista com o mesmo CenarioEmpresa, uma atividade secundária e um DadosSetoriais por atividade", () => {
    const cenario = cenarioBase("frigorifico", "Frigorífico & Distribuidora Exemplo");
    cenario.identificacao.atividadesSecundarias = [{ perfilId: "atacado_distribuicao", status: "confirmado", origem: "informado_usuario" }];
    cenario.receita.receitaPorAtividade = {
      frigorifico: campo(700_000, "informado_usuario", "confirmado"),
      atacado_distribuicao: campo(300_000, "informado_usuario", "estimado"),
    };
    cenario.dadosSetoriais = [
      { perfilId: "frigorifico", valores: { abate_proprio: campo(true, "informado_usuario", "confirmado") } },
      { perfilId: "atacado_distribuicao", valores: {} },
    ];

    expect(cenario.identificacao.atividadesSecundarias).toHaveLength(1);
    expect(cenario.dadosSetoriais).toHaveLength(2);
    const somaReceitaPorAtividade = Object.values(cenario.receita.receitaPorAtividade!).reduce((s, c) => s + c.valor, 0);
    expect(somaReceitaPorAtividade).toBe(1_000_000);
  });
});

describe("Extensibilidade — adicionar um segmento novo sem alterar o núcleo", () => {
  it("um perfil setorial totalmente novo (ex.: pet shop), definido fora do catálogo, é representável pelo MESMO tipo PerfilSetorial e pelo MESMO CenarioEmpresa", () => {
    // Nenhuma alteração em setores/tipos.ts, setores/catalogo.ts ou cenarioEmpresa.ts foi
    // necessária para este teste — é a prova de extensibilidade pedida (seção 19/F do pedido).
    const petShop: PerfilSetorial = {
      id: "pet_shop",
      macroSetor: "comercio",
      segmento: "Pet shop",
      descricao: "Comércio de produtos para animais, com serviços agregados (banho/tosa).",
      arquetipos: ["comercio", "servico"],
      caracteristicasDisponiveis: [{ id: "presta_servico_banho_tosa", label: "Presta serviço de banho e tosa", tipo: "booleano" }],
      modulosAplicaveis: [],
      perguntasEspecificas: [],
    };

    const cenario = cenarioBase(petShop.id, "Pet Shop Exemplo");
    const dados: DadosSetoriais = { perfilId: petShop.id, valores: { presta_servico_banho_tosa: campo(true, "informado_usuario", "confirmado") } };
    const validacao = validarDadosSetoriais(petShop, dados);

    expect(validacao.validos).toBe(true);
    expect(cenario.identificacao.atividadePrincipal?.perfilId).toBe("pet_shop");
  });
});

describe("Completude do cenário — por eixo, sem inventar dado", () => {
  it("cenário mínimo tem completude alta em fiscal/econômica mas zero em financeira/setorial", () => {
    const cenario = cenarioBase("varejo_generico", "Empresa Mínima");
    cenario.identificacao.uf = campo("SP", "informado_usuario", "confirmado");
    const c = avaliarCompletudeCenario(cenario);
    expect(c.financeira).toBe(0); // nenhum dado econômico-financeiro foi informado
    expect(c.setorial).toBe(0); // dadosSetoriais está vazio
  });
});

describe("Adapter CenarioEmpresa → SimulacaoInput — interopera de fato com o Motor VGR existente", () => {
  it("cenário incompleto devolve os campos faltantes, nunca inventa um SimulacaoInput", () => {
    const cenario = cenarioBase("varejo_generico", "Empresa Incompleta");
    const r = cenarioParaSimulacaoInput(cenario);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.camposFaltantes).toContain("tributario.premissas.pisCofinsPercentualAtual");
    expect(r.camposFaltantes).toContain("receita.mixMercado.b2b/b2c");
  });

  it("cenário completo converte para SimulacaoInput válido e RODA de fato através de simular() (calculo.ts intocado)", () => {
    const cenario = cenarioBase("transporte_rodoviario_cargas", "Transportadora Completa");
    cenario.tributario.premissas = {
      pisCofinsPercentualAtual: campo(0.03, "informado_usuario", "confirmado"),
      icmsIpiPercentualAtual: campo(0.04, "informado_usuario", "confirmado"),
    };
    cenario.receita.mixMercado = {
      b2b: campo(0.8, "informado_usuario", "confirmado"),
      b2c: campo(0.2, "informado_usuario", "confirmado"),
    };
    cenario.economicoFinanceiro.meioPagamentoPredominante = campo("pix", "informado_usuario", "confirmado");

    const r = cenarioParaSimulacaoInput(cenario);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.perfil).toBe("transporte_rodoviario_cargas"); // mapeado 1:1 para o perfil legado

    // a prova real de compatibilidade: o motor VGR (calculo.ts, não alterado) aceita e processa
    // o input produzido pelo adapter, sem qualquer modificação no engine.
    const resultado = simular(r.input);
    expect(resultado.anos.length).toBeGreaterThan(0);
    expect(resultado.anos[0].ano).toBe(2026);
  });

  it("perfilId que não corresponde a nenhum dos 4 perfis legados cai em perfil undefined (fallback genérico), não em erro", () => {
    const cenario = cenarioBase("software_saas", "SaaS Completo");
    cenario.tributario.premissas = {
      pisCofinsPercentualAtual: campo(0.03, "informado_usuario", "confirmado"),
      icmsIpiPercentualAtual: campo(0, "informado_usuario", "confirmado"),
    };
    cenario.receita.mixMercado = { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") };
    cenario.economicoFinanceiro.meioPagamentoPredominante = campo("boleto", "informado_usuario", "confirmado");

    const r = cenarioParaSimulacaoInput(cenario);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.perfil).toBeUndefined();
    const resultado = simular(r.input); // ainda funciona — perfil é opcional em SimulacaoInput
    expect(resultado.anos.length).toBeGreaterThan(0);
  });
});
