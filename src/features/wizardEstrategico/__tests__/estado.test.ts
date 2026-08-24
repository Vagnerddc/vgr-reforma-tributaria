import { describe, it, expect, beforeEach } from "vitest";
import { reducerWizard, carregarRascunhoSalvo, salvarRascunho, CHAVE_LOCALSTORAGE_WIZARD_V2 } from "../estado";
import { criarRascunhoVazio } from "../tipos";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";

// O projeto não tem jsdom — este ambiente de teste roda em Node puro, sem `localStorage` global.
// Polyfill mínimo em memória, só para este arquivo, espelhando a API usada por estado.ts.
class LocalStorageEmMemoria {
  private armazenamento = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.armazenamento.has(chave) ? this.armazenamento.get(chave)! : null;
  }
  setItem(chave: string, valor: string): void {
    this.armazenamento.set(chave, valor);
  }
  clear(): void {
    this.armazenamento.clear();
  }
}

(globalThis as unknown as { localStorage: LocalStorageEmMemoria }).localStorage = new LocalStorageEmMemoria();

beforeEach(() => {
  localStorage.clear();
});

describe("reducerWizard — atualizações imutáveis por slice", () => {
  it("atualizarIdentificacao mescla sem apagar campos não citados", () => {
    let rascunho = criarRascunhoVazio("r1");
    rascunho = reducerWizard(rascunho, { tipo: "atualizarIdentificacao", valores: { nomeEmpresa: campo("A", "informado_usuario", "confirmado") } });
    rascunho = reducerWizard(rascunho, { tipo: "atualizarIdentificacao", valores: { uf: campo("SP", "informado_usuario", "confirmado") } });
    expect(rascunho.identificacao.nomeEmpresa?.valor).toBe("A");
    expect(rascunho.identificacao.uf?.valor).toBe("SP");
  });

  it("definirAnalisarCaixa=false limpa premissasSplit para não sugerir configuração fantasma", () => {
    let rascunho = criarRascunhoVazio("r1");
    rascunho = reducerWizard(rascunho, { tipo: "definirAnalisarCaixa", valor: true });
    rascunho = reducerWizard(rascunho, { tipo: "definirPremissasSplit", premissas: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado") } });
    rascunho = reducerWizard(rascunho, { tipo: "definirAnalisarCaixa", valor: false });
    expect(rascunho.premissasSplit).toBeUndefined();
  });

  it("reiniciar produz um rascunho vazio novo", () => {
    let rascunho = criarRascunhoVazio("r1");
    rascunho = reducerWizard(rascunho, { tipo: "atualizarReceita", valores: { faturamentoAnual: campo(1000, "informado_usuario", "confirmado") } });
    rascunho = reducerWizard(rascunho, { tipo: "reiniciar", id: "r2" });
    expect(rascunho.id).toBe("r2");
    expect(rascunho.receita.faturamentoAnual).toBeUndefined();
  });
});

describe("113 — persistência versionada em localStorage rejeita dados inválidos", () => {
  it("carrega rascunho vazio quando não há nada salvo", () => {
    const rascunho = carregarRascunhoSalvo("padrao");
    expect(rascunho.id).toBe("padrao");
  });

  it("carrega rascunho salvo válido corretamente", () => {
    const original = criarRascunhoVazio("r1");
    original.receita.faturamentoAnual = campo(500_000, "informado_usuario", "confirmado");
    salvarRascunho(original);
    const carregado = carregarRascunhoSalvo("padrao");
    expect(carregado.receita.faturamentoAnual?.valor).toBe(500_000);
  });

  it("dados estruturalmente inválidos no localStorage são rejeitados, não carregados cegamente", () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_WIZARD_V2, JSON.stringify({ versaoAntiga: true, algumCampo: 123 }));
    const carregado = carregarRascunhoSalvo("padrao-seguro");
    expect(carregado.id).toBe("padrao-seguro");
    expect(carregado.custos.itens).toEqual([]);
  });

  it("JSON corrompido no localStorage não quebra o carregamento", () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_WIZARD_V2, "{ isto não é json válido");
    const carregado = carregarRascunhoSalvo("padrao-seguro-2");
    expect(carregado.id).toBe("padrao-seguro-2");
  });
});

describe("114 — origem do campo é rastreada ao editar", () => {
  it("um campo editado pelo usuário recebe origem informado_usuario, não a origem anterior herdada silenciosamente", () => {
    let rascunho = criarRascunhoVazio("r1");
    rascunho = reducerWizard(rascunho, { tipo: "atualizarReceita", valores: { faturamentoAnual: campo(100, "xml", "importado") } });
    expect(rascunho.receita.faturamentoAnual?.origem).toBe("xml");

    rascunho = reducerWizard(rascunho, { tipo: "atualizarReceita", valores: { faturamentoAnual: campo(200, "informado_usuario", "confirmado") } });
    expect(rascunho.receita.faturamentoAnual?.origem).toBe("informado_usuario");
    expect(rascunho.receita.faturamentoAnual?.status).toBe("confirmado");
  });
});
