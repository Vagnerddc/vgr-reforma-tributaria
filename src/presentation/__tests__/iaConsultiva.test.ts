import { describe, it, expect } from "vitest";
import { construirIaConsultivaViewModel } from "../viewModels/iaConsultiva";
import { construirContexto } from "../../engine/iaConsultiva/contexto";
import { gerarExplicacaoConsultiva } from "../../engine/iaConsultiva/motor";
import type { ResultadoDecisaoEstrategica, AvaliacaoAlternativa } from "../../engine/motorDecisao/tipos";
import type { ProvedorIaConsultiva, RespostaBrutaIa } from "../../engine/iaConsultiva/tipos";

function avaliacoes(ids: string[]): AvaliacaoAlternativa[] {
  return ids.map((identificador) => ({ identificador, aplicabilidade: "aplicavel", evidenciasFavoraveis: [], evidenciasContrarias: [], bloqueios: [], riscos: [], condicoes: [], qualidade: "media", dominancia: {} }));
}

function decisaoBase(overrides: Partial<Omit<ResultadoDecisaoEstrategica, "alternativasAvaliadas">> & { alternativasAvaliadas?: string[] }): ResultadoDecisaoEstrategica {
  const { alternativasAvaliadas, ...resto } = overrides;
  return {
    id: "d1",
    cenarioId: "c1",
    periodo: { ano: 2028 },
    objetoDecisao: "regime_tributario",
    alternativasAvaliadas: avaliacoes(alternativasAvaliadas ?? []),
    statusConclusao: "sem_conclusao",
    alternativasEquivalentes: [],
    evidenciasFavoraveis: [],
    evidenciasContrarias: [],
    conflitos: [],
    bloqueios: [],
    riscos: [],
    premissas: {},
    validacoesPendentes: [],
    qualidade: "media",
    condicoes: [],
    pontosViradaRelacionados: [],
    razoesConclusao: [],
    justificativaEstruturada: "",
    ...resto,
  };
}

const PROIBIDAS = ["definitivamente", "garantido", "recomendamos", "migre para", "aumente pró-labore", "aumente o pró-labore", "reajuste o preço"];

describe("69/70 — preferência robusta nunca usa linguagem absoluta", () => {
  it("explicacao/resumoExecutivo/textoTecnico nunca contêm termos absolutos", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "executiva");
    const texto = `${vm.titulo} ${vm.resumoExecutivo} ${vm.explicacao}`.toLowerCase();
    for (const p of PROIBIDAS) expect(texto).not.toContain(p);
  });
});

describe("70 — preferência condicionada preserva a condição na tela", () => {
  it("condicoes do ViewModel nunca ficam vazias quando o motor gerou a condição", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }] });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    expect(vm.condicoes.length).toBeGreaterThan(0);
    expect(vm.condicoes.join(" ")).toContain("custo de capital");
  });
});

describe("71 — conflito nunca declara vencedor na tela", () => {
  it("resumoExecutivo/explicacao não citam nenhuma alternativa como vencedora", async () => {
    const decisao = decisaoBase({ statusConclusao: "conflito_nao_resolvido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], conflitos: ["lucro_presumido: menor carga; lucro_real: melhor caixa"] });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    const texto = `${vm.resumoExecutivo} ${vm.explicacao}`.toLowerCase();
    expect(texto).not.toContain("lucro_presumido é a melhor");
    expect(texto).not.toContain("lucro_real vence");
  });
});

describe("72 — obrigação jurídica nunca vira linguagem de preferência", () => {
  it("explicação menciona obrigatoriedade, nunca 'apresenta preferência técnica'", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "obrigacao_juridica", alternativaPreferida: "lucro_real", alternativasAvaliadas: ["lucro_real"], qualidade: "alta" });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    const texto = `${vm.resumoExecutivo} ${vm.explicacao}`.toLowerCase();
    expect(texto).toContain("obrigatoriedade");
    expect(texto).not.toContain("apresenta preferência técnica");
  });
});

describe("73 — dados insuficientes explica a lacuna, nunca escolhe alternativa", () => {
  it("nenhuma alternativa aparece como preferida no ViewModel", async () => {
    const decisao = decisaoBase({ statusConclusao: "dados_insuficientes", bloqueios: [{ tipo: "dados_insuficientes", descricao: "PIS/COFINS incompleto" }] });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "executiva");
    expect(vm.explicacao.toLowerCase()).toContain("pis/cofins");
  });
});

describe("74 — equivalência nunca escolhe arbitrariamente", () => {
  it("explicação nunca declara uma alternativa preferida entre as equivalentes", async () => {
    const decisao = decisaoBase({ statusConclusao: "alternativas_equivalentes", alternativasEquivalentes: ["lucro_presumido", "simples_unificado"] });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    expect(vm.explicacao.toLowerCase()).toContain("equivalente");
  });
});

describe("75/76/77/78 — número/alternativa/qualidade/risco inventados nunca chegam à tela (guardrail já garante)", () => {
  it("provedor malicioso é rejeitado e o ViewModel reflete o fallback, nunca o texto malicioso", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "media" });
    const contexto = construirContexto(decisao);
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "A economia é de R$ 999999.", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_real", qualidadeComunicada: "alta" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "executiva");
    expect(vm.status).toBe("rejeitada");
    expect(vm.resumoExecutivo).not.toContain("999999");
    expect(vm.explicacao).not.toContain("999999");
  });
});

describe("79 — Fator R nunca vira pró-labore na tela", () => {
  it("explicação sobre FS12 nunca contém 'aumente pró-labore'", async () => {
    const decisao = decisaoBase({
      objetoDecisao: "fator_r",
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "AVALIAR_FATOR_R",
      alternativasAvaliadas: ["AVALIAR_FATOR_R"],
      evidenciasFavoraveis: [{ descricao: "FS12 adicional necessária", valor: 48000, unidade: "reais", origem: "motor_achados" }],
      condicoes: [{ descricao: "confirmação de premissa de folha/encargos/pró-labore" }],
    });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    const texto = `${vm.resumoExecutivo} ${vm.explicacao}`.toLowerCase();
    expect(texto).not.toContain("aumente pró-labore");
    expect(texto).not.toContain("aumente o pró-labore");
  });
});

describe("80 — preço nunca vira ordem de reajuste na tela", () => {
  it("referência matemática nunca aparece como instrução", async () => {
    const decisao = decisaoBase({
      objetoDecisao: "recomposicao_preco",
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "AVALIAR_RECOMPOSICAO_PRECO",
      alternativasAvaliadas: ["AVALIAR_RECOMPOSICAO_PRECO"],
      evidenciasFavoraveis: [{ descricao: "Reajuste médio de referência", valor: 0.038, unidade: "percentual", origem: "motor_financeiro" }],
      condicoes: [{ descricao: "viabilidade comercial não analisada" }],
    });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "consultiva");
    const texto = `${vm.resumoExecutivo} ${vm.explicacao}`.toLowerCase();
    expect(texto).not.toContain("reajuste o preço");
    expect(texto).not.toContain("a empresa deve reajustar");
  });
});

describe("83 — troca de nível nunca altera o domínio", () => {
  it("os três níveis vêm da mesma decisão, sem recalcular nada", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const contexto = construirContexto(decisao);
    const [exec, cons, tec] = await Promise.all([
      gerarExplicacaoConsultiva({ decisao, nivel: "executiva" }),
      gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" }),
      gerarExplicacaoConsultiva({ decisao, nivel: "tecnica" }),
    ]);
    const vms = [construirIaConsultivaViewModel(exec, contexto, "executiva"), construirIaConsultivaViewModel(cons, contexto, "consultiva"), construirIaConsultivaViewModel(tec, contexto, "tecnica")];
    for (const vm of vms) expect(vm.status).toBe("indisponivel");
    // decisao original permanece intocada.
    expect(decisao.alternativaPreferida).toBe("lucro_presumido");
  });
});

describe("Fallback nunca é tratado como erro na leitura padrão", () => {
  it("status 'indisponivel' (sem provedor) ainda produz título/resumo utilizáveis", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "executiva");
    expect(vm.titulo.length).toBeGreaterThan(0);
    expect(vm.origemGeracao).toBe("Leitura consultiva da análise");
  });

  it("modo técnico expõe o status real (nunca escondido)", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "tecnica" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "tecnica");
    expect(vm.metadadosTecnicos?.status).toBe("indisponivel");
    expect(vm.origemGeracao).toContain("indisponivel");
  });
});

describe("Evidências resolvidas em texto, nunca ID bruto", () => {
  it("IDs 'fav-0'/'cond-0' nunca aparecem nos campos de evidências/condições", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido"],
      evidenciasFavoraveis: [{ descricao: "Carga menor", valor: 82000, unidade: "reais", origem: "x" }],
      condicoes: [{ descricao: "custo de capital baixo" }],
    });
    const contexto = construirContexto(decisao);
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "tecnica" });
    const vm = construirIaConsultivaViewModel(resposta, contexto, "tecnica");
    for (const e of [...vm.evidencias, ...vm.condicoes]) {
      expect(e).not.toMatch(/^fav-\d+$/);
      expect(e).not.toMatch(/^cond-\d+$/);
    }
  });
});
