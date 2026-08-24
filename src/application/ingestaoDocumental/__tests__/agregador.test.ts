import { describe, it, expect } from "vitest";
import { criarRascunhoVazio } from "../../../features/wizardEstrategico/tipos";
import { agregarDocumentosParaRascunho } from "../agregador";
import { campoManual } from "../../../features/wizardEstrategico/components/campoManual";
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento } from "../tipos";
import type { TipoDocumento } from "../tipos";

function docComCampo(tipoDocumento: TipoDocumento, documentoId: string, campos: ResultadoIngestaoDocumento["camposExtraidos"], periodo?: string): ResultadoIngestaoDocumento {
  return { documentoId, tipoDocumento, periodo, status: "processado", camposExtraidos: campos, alertas: [], inconsistencias: [], limitacoes: [], metadados: { nomeArquivo: `${documentoId}.txt`, processadoEm: new Date().toISOString() } };
}

describe("agregarDocumentosParaRascunho — caso simples, sem disputa", () => {
  it("aplica direto o único valor de uma única fonte", () => {
    const rascunho = criarRascunhoVazio("r1");
    const campo = campoExtraido("EMPRESA TESTE LTDA", "confirmado", { documentoId: "d1", tipoDocumento: "cnpj", observacao: "razaoSocial" });
    const { rascunho: resultado, conflitosNovos } = agregarDocumentosParaRascunho(rascunho, [docComCampo("cnpj", "d1", [campo])]);
    expect(resultado.identificacao.nomeEmpresa?.valor).toBe("EMPRESA TESTE LTDA");
    expect(conflitosNovos).toHaveLength(0);
  });
});

describe("agregarDocumentosParaRascunho — conflito entre fontes", () => {
  it("gera ConflitoFonte pendente quando duas fontes divergem sem preferência configurada e aplica o de melhor status provisoriamente", () => {
    const rascunho = criarRascunhoVazio("r2");
    const candidatoDefis = campoExtraido(3900000, "confirmado", { documentoId: "d-defis", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2026" });
    const candidatoEfd = campoExtraido(3950000, "estimado", { documentoId: "d-efd", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "2026" });

    const { rascunho: r, conflitosNovos } = agregarDocumentosParaRascunho(rascunho, [docComCampo("defis", "d-defis", [candidatoDefis], "2026"), docComCampo("efd_contribuicoes", "d-efd", [candidatoEfd], "2026")]);

    expect(conflitosNovos).toHaveLength(1);
    expect(conflitosNovos[0].status).toBe("pendente");
    expect(conflitosNovos[0].valores).toHaveLength(2);
    expect(r.ingestao?.conflitos).toHaveLength(1);
  });

  it("resolve automaticamente (resolvido_regra) quando há preferência configurada para o campo", () => {
    const rascunho = criarRascunhoVazio("r3");
    const candidatoDefis = campoExtraido(4800000, "confirmado", { documentoId: "d-defis", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2025" });
    const candidatoEcd = campoExtraido(4850000, "confirmado", { documentoId: "d-ecd", tipoDocumento: "ecd", observacao: "receitaConsolidada", periodo: "2025" });

    const { rascunho: r, conflitosNovos } = agregarDocumentosParaRascunho(rascunho, [docComCampo("defis", "d-defis", [candidatoDefis], "2025"), docComCampo("ecd", "d-ecd", [candidatoEcd], "2025")]);

    expect(conflitosNovos[0].status).toBe("resolvido_regra");
    expect(r.receita.faturamentoAnual?.valor).toBe(4850000); // preferência de receita.faturamentoAnual é "ecd"
  });
});

describe("agregarDocumentosParaRascunho — nunca sobrescreve valor já confirmado manualmente", () => {
  it("gera conflito pendente e preserva o valor manual quando um documento importado diverge", () => {
    let rascunho = criarRascunhoVazio("r4");
    rascunho.identificacao.nomeEmpresa = campoManual("NOME DIGITADO PELO CONTADOR");

    const candidato = campoExtraido("NOME DA RECEITA FEDERAL", "confirmado", { documentoId: "d-cnpj", tipoDocumento: "cnpj", observacao: "razaoSocial" });
    const { rascunho: r, conflitosNovos } = agregarDocumentosParaRascunho(rascunho, [docComCampo("cnpj", "d-cnpj", [candidato])]);

    expect(r.identificacao.nomeEmpresa?.valor).toBe("NOME DIGITADO PELO CONTADOR"); // nunca sobrescrito
    expect(conflitosNovos).toHaveLength(1);
    expect(conflitosNovos[0].resolucao?.valorEscolhido).toBe("informado_usuario");
    expect(conflitosNovos[0].status).toBe("pendente");
  });
});

describe("agregarDocumentosParaRascunho — resolução do usuário nunca é apagada silenciosamente", () => {
  it("marca o conflito como 'desatualizado' preservando o histórico quando chega fonte nova concorrente", () => {
    const rascunho = criarRascunhoVazio("r5");
    const v1 = campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "01" });
    const v2 = campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "01" });

    const primeiraRodada = agregarDocumentosParaRascunho(rascunho, [docComCampo("defis", "d1", [v1], "01"), docComCampo("efd_contribuicoes", "d2", [v2], "01")]);
    const conflitoId = primeiraRodada.conflitosNovos[0].id;

    // Usuário resolve manualmente escolhendo o valor do DEFIS (v1).
    const rascunhoResolvido = structuredClone(primeiraRodada.rascunho);
    rascunhoResolvido.ingestao!.conflitos = rascunhoResolvido.ingestao!.conflitos.map((c) => (c.id === conflitoId ? { ...c, status: "resolvido_usuario" as const, resolucao: { valorEscolhido: v1, motivo: "usuário escolheu o DEFIS" } } : c));
    rascunhoResolvido.receita.faturamentoAnual = { valor: 100, origem: "sped", status: "confirmado" };

    // Chega uma TERCEIRA fonte concorrente para o mesmo campo/período.
    const v3 = campoExtraido(300, "confirmado", { documentoId: "d3", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "01" });
    const segundaRodada = agregarDocumentosParaRascunho(rascunhoResolvido, [docComCampo("defis", "d1", [v1], "01"), docComCampo("efd_contribuicoes", "d3", [v3], "01")]);

    const conflitoFinal = segundaRodada.rascunho.ingestao!.conflitos.find((c) => c.campo === "receita.faturamentoAnual");
    expect(conflitoFinal?.status).toBe("desatualizado");
    expect(conflitoFinal?.historico?.[0].status).toBe("resolvido_usuario");
    expect(conflitoFinal?.historico?.[0].resolucao?.motivo).toBe("usuário escolheu o DEFIS");
  });
});

describe("agregarDocumentosParaRascunho — período divergente gera alerta, nunca funde exercícios diferentes", () => {
  it("processa os dois períodos separadamente e emite AlertaIngestao de período divergente", () => {
    const rascunho = criarRascunhoVazio("r6");
    const v2025 = campoExtraido(1000, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2025" });
    const v2026 = campoExtraido(2000, "confirmado", { documentoId: "d2", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "2026" });

    const { alertasPeriodo, conflitosNovos } = agregarDocumentosParaRascunho(rascunho, [docComCampo("defis", "d1", [v2025], "2025"), docComCampo("defis", "d2", [v2026], "2026")]);

    expect(alertasPeriodo.some((a) => a.codigo === "periodo_divergente")).toBe(true);
    expect(conflitosNovos).toHaveLength(0); // cada período é resolvido isoladamente, sem disputa dentro do mesmo período
  });
});

describe("agregarDocumentosParaRascunho — reavaliação incremental", () => {
  it("não recalcula conflitos de campos não afetados pela rodada atual", () => {
    const rascunho = criarRascunhoVazio("r7");
    const v1 = campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "defis", observacao: "receitaBrutaAnual", periodo: "01" });
    const v2 = campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "efd_contribuicoes", observacao: "receitaConsolidada", periodo: "01" });
    const primeiraRodada = agregarDocumentosParaRascunho(rascunho, [docComCampo("defis", "d1", [v1], "01"), docComCampo("efd_contribuicoes", "d2", [v2], "01")]);
    expect(primeiraRodada.rascunho.ingestao?.conflitos).toHaveLength(1);

    const campoNaoRelacionado = campoExtraido("SAO PAULO", "confirmado", { documentoId: "d3", tipoDocumento: "cnpj", observacao: "municipio" });
    const segundaRodada = agregarDocumentosParaRascunho(primeiraRodada.rascunho, [docComCampo("cnpj", "d3", [campoNaoRelacionado])]);

    expect(segundaRodada.rascunho.ingestao?.conflitos).toHaveLength(1); // conflito de dasApurado preservado, intocado
    expect(segundaRodada.conflitosNovos).toHaveLength(0); // nenhum conflito novo nesta rodada
    expect(segundaRodada.rascunho.identificacao.municipio?.valor).toBe("SAO PAULO");
  });
});

describe("agregarDocumentosParaRascunho — operações de XML deduplicadas entre rodadas", () => {
  it("não duplica a mesma operação ao agregar duas vezes", () => {
    const op = {
      id: "op-1",
      identificacao: {},
      produtoServico: {},
      classificacaoTributaria: {},
      valores: {},
      localidade: {},
      granularidade: "item" as const,
    };
    const rascunho = criarRascunhoVazio("r8");
    const primeira = agregarDocumentosParaRascunho(rascunho, [], [op]);
    const segunda = agregarDocumentosParaRascunho(primeira.rascunho, [], [op]);
    expect(segunda.rascunho.tributario.operacoes).toHaveLength(1);
  });
});
