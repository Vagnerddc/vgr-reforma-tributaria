import { describe, it, expect, beforeEach } from "vitest";
import { carregarSnapshotAnalise, salvarSnapshotAnalise, limparSnapshotAnalise, statusSnapshotAnalise, CHAVE_LOCALSTORAGE_ANALISE_V2 } from "../persistenciaAnalise";
import { criarRascunhoVazio } from "../tipos";
import { converterRascunhoParaCenario } from "../validacao";
import { construirOpcoesExecucao } from "../execucao";
import { executarAnaliseEstrategica } from "../../../application/analiseEstrategica/motor";
import { construirMemoriaTecnicaAnalise } from "../../../application/memoriaTecnica/motor";
import { construirPaginaAnaliseEstrategicaViewModel } from "../../../presentation/viewModels/analiseEstrategica";
import { construirApresentacaoExecutivaViewModel } from "../../../presentation/viewModels/apresentacao";
import { adaptarClienteLegadoParaCenarioEmpresa } from "../../../application/analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";
import type { ClienteData } from "../../../context/ClienteDataContext";
import type { SimulacaoInput } from "../../../engine/types";

class LocalStorageEmMemoria {
  private armazenamento = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.armazenamento.has(chave) ? this.armazenamento.get(chave)! : null;
  }
  setItem(chave: string, valor: string): void {
    this.armazenamento.set(chave, valor);
  }
  removeItem(chave: string): void {
    this.armazenamento.delete(chave);
  }
  clear(): void {
    this.armazenamento.clear();
  }
}

(globalThis as unknown as { localStorage: LocalStorageEmMemoria }).localStorage = new LocalStorageEmMemoria();

beforeEach(() => {
  localStorage.clear();
});

function rascunhoExecutavel() {
  const rascunho = criarRascunhoVazio("teste-persistencia");
  rascunho.identificacao.nomeEmpresa = campo("Empresa Persistência", "informado_usuario", "confirmado");
  rascunho.receita.faturamentoAnual = campo(1_500_000, "informado_usuario", "confirmado");
  rascunho.regimesSelecionados = ["lucro_presumido"];
  return rascunho;
}

describe("68 — snapshot válido é salvo e restaurado corretamente", () => {
  it("salvarSnapshotAnalise + carregarSnapshotAnalise preserva a entrada", () => {
    const rascunho = rascunhoExecutavel();
    salvarSnapshotAnalise(rascunho);
    const snapshot = carregarSnapshotAnalise();
    expect(snapshot?.origemCenario).toBe("wizard_v2");
    expect(snapshot?.entrada.receita.faturamentoAnual?.valor).toBe(1_500_000);
    expect(statusSnapshotAnalise()).toBe("valido");
  });
});

describe("69 — snapshot corrompido não quebra o carregamento", () => {
  it("JSON inválido retorna undefined e status 'invalido'", () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_ANALISE_V2, "{ isto não é json");
    expect(carregarSnapshotAnalise()).toBeUndefined();
    expect(statusSnapshotAnalise()).toBe("invalido");
  });
});

describe("70 — versão/origem desconhecida não é carregada silenciosamente", () => {
  it("um objeto sem origemCenario === 'wizard_v2' é rejeitado", () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_ANALISE_V2, JSON.stringify({ origemCenario: "outra_origem", entrada: {} }));
    expect(carregarSnapshotAnalise()).toBeUndefined();
    expect(statusSnapshotAnalise()).toBe("invalido");
  });

  it("um objeto estruturalmente incompleto (sem regimesSelecionados) é rejeitado", () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_ANALISE_V2, JSON.stringify({ origemCenario: "wizard_v2", entrada: { id: "x" }, criadoEm: "2026-01-01" }));
    expect(carregarSnapshotAnalise()).toBeUndefined();
  });
});

describe("71 — reload: mesma decisão antes e depois", () => {
  it("reexecutar a partir do snapshot produz a mesma decisão da execução original", () => {
    const rascunho = rascunhoExecutavel();
    const { cenario } = converterRascunhoParaCenario(rascunho);
    const opcoes = construirOpcoesExecucao(rascunho);
    const analiseOriginal = executarAnaliseEstrategica(cenario, opcoes);

    salvarSnapshotAnalise(rascunho);

    // Simula reload: nova leitura do localStorage, reconversão, reexecução — nunca reaproveita o objeto de análise anterior.
    const snapshotRestaurado = carregarSnapshotAnalise()!;
    const { cenario: cenarioRestaurado } = converterRascunhoParaCenario(snapshotRestaurado.entrada);
    const opcoesRestauradas = construirOpcoesExecucao(snapshotRestaurado.entrada);
    const analiseRestaurada = executarAnaliseEstrategica(cenarioRestaurado, opcoesRestauradas);

    expect(analiseRestaurada.decisao?.statusConclusao).toBe(analiseOriginal.decisao?.statusConclusao);
    expect(analiseRestaurada.decisao?.alternativaPreferida).toBe(analiseOriginal.decisao?.alternativaPreferida);
  });
});

describe("72 — contextHash permanece coerente após reload", () => {
  it("a Memória Técnica da análise restaurada tem o mesmo contextHash da análise original", () => {
    const rascunho = rascunhoExecutavel();
    const { cenario } = converterRascunhoParaCenario(rascunho);
    const opcoes = construirOpcoesExecucao(rascunho);
    const analiseOriginal = executarAnaliseEstrategica(cenario, opcoes);
    const memoriaOriginal = construirMemoriaTecnicaAnalise(analiseOriginal);

    salvarSnapshotAnalise(rascunho);
    const snapshotRestaurado = carregarSnapshotAnalise()!;
    const { cenario: cenarioRestaurado } = converterRascunhoParaCenario(snapshotRestaurado.entrada);
    const analiseRestaurada = executarAnaliseEstrategica(cenarioRestaurado, construirOpcoesExecucao(snapshotRestaurado.entrada));
    const memoriaRestaurada = construirMemoriaTecnicaAnalise(analiseRestaurada);

    expect(memoriaRestaurada.contextHash).toBe(memoriaOriginal.contextHash);
  });
});

describe("73 — 'Nova análise' não reutiliza snapshot anterior", () => {
  it("após limparSnapshotAnalise, carregarSnapshotAnalise retorna undefined", () => {
    salvarSnapshotAnalise(rascunhoExecutavel());
    expect(carregarSnapshotAnalise()).toBeDefined();
    limparSnapshotAnalise();
    expect(carregarSnapshotAnalise()).toBeUndefined();
    expect(statusSnapshotAnalise()).toBe("ausente");
  });
});

describe("74/75 — fluxo legado e adapter permanecem intactos", () => {
  it("adaptarClienteLegadoParaCenarioEmpresa continua funcionando normalmente", () => {
    const simulacaoInput: SimulacaoInput = {
      nomeEmpresa: "Legado Intacto",
      regimeAtual: "lucro_presumido",
      faturamentoAnual: 1_000_000,
      pisCofinsPercentualAtual: 0.0365,
      icmsIpiPercentualAtual: 0.05,
      percentualCustosCreditaveis: 0.3,
      perfilClientes: { percentualClienteContribuinte: 0.7, percentualClienteNaoContribuinte: 0.3 },
      meioPagamentoPredominante: "pix",
    };
    const cliente: ClienteData = { nomeEmpresa: "Legado Intacto", dados: {} as never, resultadoSimulacao: { input: simulacaoInput, anos: [], recomendacao: "", avisos: [] }, panorama: null };
    const resultado = adaptarClienteLegadoParaCenarioEmpresa(cliente);
    expect(resultado?.cenario.receita.faturamentoAnual?.valor).toBe(1_000_000);
    expect(resultado?.perdas.length).toBeGreaterThan(0);
  });
});

describe("77 — Memória Técnica funciona normalmente após reload", () => {
  it("a análise restaurada produz itens de memória técnica normalmente", () => {
    const rascunho = rascunhoExecutavel();
    salvarSnapshotAnalise(rascunho);
    const snapshot = carregarSnapshotAnalise()!;
    const { cenario } = converterRascunhoParaCenario(snapshot.entrada);
    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(snapshot.entrada));
    const memoria = construirMemoriaTecnicaAnalise(analise);
    expect(memoria.itens.length).toBeGreaterThan(0);
  });
});

describe("78 — Modo Apresentação funciona normalmente após reload", () => {
  it("a análise restaurada produz um ViewModel de apresentação com capítulos", () => {
    const rascunho = rascunhoExecutavel();
    salvarSnapshotAnalise(rascunho);
    const snapshot = carregarSnapshotAnalise()!;
    const { cenario } = converterRascunhoParaCenario(snapshot.entrada);
    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(snapshot.entrada));
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, snapshot.entrada.identificacao.nomeEmpresa?.valor);
    const apresentacaoVm = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacaoVm.capitulos.length).toBeGreaterThan(0);
  });
});
