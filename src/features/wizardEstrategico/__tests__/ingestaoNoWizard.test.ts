import { describe, it, expect, beforeEach } from "vitest";
import { reducerWizard, carregarRascunhoSalvo, salvarRascunho, CHAVE_LOCALSTORAGE_WIZARD_V2, ehRascunhoValidoEstruturalmente } from "../estado";
import { criarRascunhoVazio } from "../tipos";
import { agregarDocumentosParaRascunho } from "../../../application/ingestaoDocumental/agregador";
import { campoExtraido } from "../../../application/ingestaoDocumental/tipos";
import type { ResultadoIngestaoDocumento } from "../../../application/ingestaoDocumental/tipos";

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

function docCnpj(): ResultadoIngestaoDocumento {
  const campo = campoExtraido("EMPRESA TESTE", "confirmado", { documentoId: "d1", tipoDocumento: "cnpj", observacao: "razaoSocial" });
  return { documentoId: "d1", tipoDocumento: "cnpj", status: "processado", camposExtraidos: [campo], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "cnpj", processadoEm: new Date().toISOString() } };
}

describe("aplicarResultadoIngestao — preserva id/etapasVisitadas da sessão", () => {
  it("aplica o rascunho agregado sem resetar a navegação do usuário", () => {
    let rascunho = criarRascunhoVazio("sessao-1");
    rascunho = reducerWizard(rascunho, { tipo: "marcarEtapaVisitada", etapa: "empresa" });

    const resultado = agregarDocumentosParaRascunho(rascunho, [docCnpj()]);
    rascunho = reducerWizard(rascunho, { tipo: "aplicarResultadoIngestao", resultado });

    expect(rascunho.id).toBe("sessao-1");
    expect(rascunho.etapasVisitadas.empresa).toBe(true);
    expect(rascunho.identificacao.nomeEmpresa?.valor).toBe("EMPRESA TESTE");
  });
});

describe("resolverConflitoIngestao", () => {
  it("aplica o valor escolhido, marca o conflito como resolvido_usuario e preserva rastreabilidade", () => {
    let rascunho = criarRascunhoVazio("sessao-2");
    const v1 = campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2026" });
    const v2 = campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "2026" });
    const doc1: ResultadoIngestaoDocumento = { documentoId: "d1", tipoDocumento: "defis", periodo: "2026", status: "processado", camposExtraidos: [v1], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "defis", processadoEm: new Date().toISOString() } };
    const doc2: ResultadoIngestaoDocumento = { documentoId: "d2", tipoDocumento: "efd_contribuicoes", periodo: "2026", status: "processado", camposExtraidos: [v2], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "efd", processadoEm: new Date().toISOString() } };

    const agregado = agregarDocumentosParaRascunho(rascunho, [doc1, doc2]);
    rascunho = reducerWizard(rascunho, { tipo: "aplicarResultadoIngestao", resultado: agregado });
    const conflito = rascunho.ingestao!.conflitos[0];
    expect(conflito.status).toBe("pendente");

    rascunho = reducerWizard(rascunho, { tipo: "resolverConflitoIngestao", conflitoId: conflito.id, valorEscolhido: v1, motivo: "contador confirmou o DEFIS" });

    const conflitoResolvido = rascunho.ingestao!.conflitos.find((c) => c.id === conflito.id)!;
    expect(conflitoResolvido.status).toBe("resolvido_usuario");
    expect(conflitoResolvido.resolucao?.motivo).toBe("contador confirmou o DEFIS");
    expect(rascunho.receita.faturamentoAnual?.valor).toBe(100);
  });

  it("aceita valor digitado manualmente, registrando origem informado_usuario", () => {
    let rascunho = criarRascunhoVazio("sessao-3");
    const v1 = campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2026" });
    const v2 = campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "2026" });
    const doc1: ResultadoIngestaoDocumento = { documentoId: "d1", tipoDocumento: "defis", periodo: "2026", status: "processado", camposExtraidos: [v1], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "defis", processadoEm: new Date().toISOString() } };
    const doc2: ResultadoIngestaoDocumento = { documentoId: "d2", tipoDocumento: "efd_contribuicoes", periodo: "2026", status: "processado", camposExtraidos: [v2], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "efd", processadoEm: new Date().toISOString() } };
    const agregado = agregarDocumentosParaRascunho(rascunho, [doc1, doc2]);
    rascunho = reducerWizard(rascunho, { tipo: "aplicarResultadoIngestao", resultado: agregado });
    const conflito = rascunho.ingestao!.conflitos[0];

    rascunho = reducerWizard(rascunho, { tipo: "resolverConflitoIngestao", conflitoId: conflito.id, valorEscolhido: { digitado: 999 }, motivo: "valor correto informado pelo contador" });

    expect(rascunho.receita.faturamentoAnual?.valor).toBe(999);
    expect(rascunho.receita.faturamentoAnual?.origem).toBe("informado_usuario");
    expect(rascunho.receita.faturamentoAnual?.status).toBe("confirmado");
  });
});

describe("retrocompatibilidade — rascunho salvo antes desta fase", () => {
  it("ehRascunhoValidoEstruturalmente aceita rascunho sem o campo ingestao", () => {
    const semIngestao = criarRascunhoVazio("r-antigo");
    delete (semIngestao as { ingestao?: unknown }).ingestao;
    expect(ehRascunhoValidoEstruturalmente(semIngestao)).toBe(true);
  });

  it("carregarRascunhoSalvo migra implicitamente para estadoIngestaoVazio quando ausente", () => {
    const semIngestao = criarRascunhoVazio("r-antigo-2");
    delete (semIngestao as { ingestao?: unknown }).ingestao;
    localStorage.setItem(CHAVE_LOCALSTORAGE_WIZARD_V2, JSON.stringify(semIngestao));

    const carregado = carregarRascunhoSalvo("outro-id");
    expect(carregado.ingestao).toEqual({ documentosProcessados: [], conflitos: [] });
  });
});

describe("persistência round-trip via localStorage", () => {
  it("preserva ingestao.conflitos após salvar e recarregar (simulando reload de aba)", () => {
    let rascunho = criarRascunhoVazio("r-persist");
    const v1 = campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2026" });
    const v2 = campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "2026" });
    const doc1: ResultadoIngestaoDocumento = { documentoId: "d1", tipoDocumento: "defis", periodo: "2026", status: "processado", camposExtraidos: [v1], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "defis", processadoEm: new Date().toISOString() } };
    const doc2: ResultadoIngestaoDocumento = { documentoId: "d2", tipoDocumento: "efd_contribuicoes", periodo: "2026", status: "processado", camposExtraidos: [v2], alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: "efd", processadoEm: new Date().toISOString() } };
    const agregado = agregarDocumentosParaRascunho(rascunho, [doc1, doc2]);
    rascunho = reducerWizard(rascunho, { tipo: "aplicarResultadoIngestao", resultado: agregado });

    salvarRascunho(rascunho);
    const recarregado = carregarRascunhoSalvo("r-persist");

    expect(recarregado.ingestao?.conflitos).toHaveLength(1);
    expect(recarregado.ingestao?.conflitos[0].status).toBe("pendente");
    // Nunca persiste o conteúdo bruto do documento — só metadados leves.
    expect(recarregado.ingestao?.documentosProcessados[0]).not.toHaveProperty("conteudo");
  });
});
