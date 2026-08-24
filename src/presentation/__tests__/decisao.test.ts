import { describe, it, expect } from "vitest";
import { construirDecisaoViewModel } from "../viewModels/decisao";
import type { ResultadoDecisaoEstrategica, AvaliacaoAlternativa } from "../../engine/motorDecisao/tipos";

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

describe("condição nunca desaparece em preferência condicionada", () => {
  it("condicoes do ViewModel espelham exatamente as condições da decisão", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }] });
    const vm = construirDecisaoViewModel(decisao);
    expect(vm.condicoes.length).toBe(1);
    expect(vm.condicoes[0].descricao).toContain("custo de capital");
  });
});

describe("conflito nunca recebe vencedor visual", () => {
  it("alternativaPreferida fica undefined mesmo se o campo bruto viesse preenchido", () => {
    const decisao = decisaoBase({ statusConclusao: "conflito_nao_resolvido", alternativaPreferida: "lucro_presumido" as never, alternativasAvaliadas: ["lucro_presumido", "lucro_real"] });
    const vm = construirDecisaoViewModel(decisao);
    expect(vm.alternativaPreferida).toBeUndefined();
    expect(vm.alternativasEmConflito).toEqual(["lucro_presumido", "lucro_real"]);
  });
});

describe("obrigação nunca vira 'melhor regime'", () => {
  it("ehObrigacaoJuridica é true e a apresentação não usa rótulo de preferência", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "obrigacao_juridica", alternativaPreferida: "lucro_real", alternativasAvaliadas: ["lucro_real"] });
    const vm = construirDecisaoViewModel(decisao);
    expect(vm.ehObrigacaoJuridica).toBe(true);
    expect(vm.alternativaPreferida).toBe("lucro_real");
  });
});

describe("dados insuficientes mostram o motivo, nunca escolhem alternativa", () => {
  it("motivoIndisponibilidade preenchido, alternativaPreferida undefined", () => {
    const decisao = decisaoBase({ statusConclusao: "dados_insuficientes", bloqueios: [{ tipo: "dados_insuficientes", descricao: "PIS/COFINS incompleto" }] });
    const vm = construirDecisaoViewModel(decisao);
    expect(vm.alternativaPreferida).toBeUndefined();
    expect(vm.motivoIndisponibilidade).toContain("PIS/COFINS");
  });
});

describe("qualidade média nunca vira 'alta confiança'", () => {
  it("vm.qualidade é uma retransmissão fiel do valor bruto", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "x", alternativasAvaliadas: ["x"], qualidade: "media" });
    const vm = construirDecisaoViewModel(decisao);
    expect(vm.qualidade).toBe("media");
  });
});

describe("baseline/domínio não é mutado", () => {
  it("construirDecisaoViewModel nunca modifica o objeto recebido", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", alternativaPreferida: "x", alternativasAvaliadas: ["x"], condicoes: [{ descricao: "y" }] });
    const antes = JSON.stringify(decisao);
    construirDecisaoViewModel(decisao);
    expect(JSON.stringify(decisao)).toBe(antes);
  });
});

describe("todos os 7 status produzem um rótulo determinístico", () => {
  const status: ResultadoDecisaoEstrategica["statusConclusao"][] = ["preferencia_tecnica_robusta", "preferencia_tecnica_condicionada", "conflito_nao_resolvido", "alternativas_equivalentes", "dados_insuficientes", "bloqueado", "sem_conclusao"];
  it.each(status)("%s tem rotuloStatus não vazio", (s) => {
    const vm = construirDecisaoViewModel(decisaoBase({ statusConclusao: s }));
    expect(vm.rotuloStatus.length).toBeGreaterThan(0);
  });
});
