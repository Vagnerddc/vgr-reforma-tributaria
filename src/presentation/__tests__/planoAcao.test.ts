import { describe, it, expect } from "vitest";
import { construirPlanoAcaoViewModel } from "../viewModels/planoAcao";
import type { AcaoEstruturada, PlanoAcaoEstruturado } from "../../engine/planoAcao/tipos";

function acao(overrides: Partial<AcaoEstruturada>): AcaoEstruturada {
  return {
    id: "a1",
    codigo: "VALIDAR_PIS_COFINS",
    categoria: "fiscal",
    titulo: "t",
    descricaoTecnica: "d",
    origens: [],
    achadosOrigem: [],
    alternativasOrigem: [],
    decisoesOrigem: [],
    objetivo: "o",
    tipo: "validacao",
    status: "pendente",
    dependeDe: [],
    bloqueios: [],
    riscos: [],
    condicoes: [],
    validacoesNecessarias: [],
    evidencias: [],
    responsabilidadeSugerida: [],
    resultadoEsperado: "r",
    criterioConclusao: "c",
    qualidade: "media",
    premissas: {},
    ...overrides,
  };
}

describe("Plano respeita a ordem/dependências já calculadas pelo motor", () => {
  it("as etapas do ViewModel preservam exatamente a ordenação vinda de PlanoAcaoEstruturado.etapas", () => {
    const acoes = [acao({ id: "v1" }), acao({ id: "s1", codigo: "SIMULAR_CENARIO_FINAL", tipo: "simulacao", dependeDe: ["v1"] })];
    const plano: PlanoAcaoEstruturado = { cenarioId: "c1", decisaoId: "d1", statusDecisao: "x", acoes, etapas: [{ numero: 1, acoes: ["v1"] }, { numero: 2, acoes: ["s1"] }], bloqueiosGlobais: [], condicoesGlobais: [], gatilhosMonitoramento: [], cobertura: { fiscal: "analisado", preco: "nao_aplicavel", creditos: "nao_aplicavel", fatorR: "nao_aplicavel", caixa: "nao_aplicavel", regime: "analisado", monitoramento: "nao_aplicavel" }, qualidade: "media", status: "parcial" };

    const vm = construirPlanoAcaoViewModel(plano);
    expect(vm.etapas.map((e) => e.numero)).toEqual([1, 2]);
    expect(vm.etapas[0].acoes[0].id).toBe("v1");
    expect(vm.etapas[1].acoes[0].id).toBe("s1");
  });

  it("ação bloqueada mostra o motivo, nunca some silenciosamente", () => {
    const acoes = [acao({ id: "v1", bloqueios: [{ tipo: "dados_insuficientes", descricao: "Base do Lucro Real parcial" }] })];
    const plano: PlanoAcaoEstruturado = { cenarioId: "c1", decisaoId: "d1", statusDecisao: "x", acoes, etapas: [{ numero: 1, acoes: ["v1"] }], bloqueiosGlobais: [], condicoesGlobais: [], gatilhosMonitoramento: [], cobertura: { fiscal: "analisado", preco: "nao_aplicavel", creditos: "nao_aplicavel", fatorR: "nao_aplicavel", caixa: "nao_aplicavel", regime: "analisado", monitoramento: "nao_aplicavel" }, qualidade: "insuficiente", status: "bloqueado" };

    const vm = construirPlanoAcaoViewModel(plano);
    expect(vm.etapas[0].acoes[0].bloqueada).toBe(true);
    expect(vm.etapas[0].acoes[0].motivoBloqueio).toContain("Lucro Real");
  });
});
