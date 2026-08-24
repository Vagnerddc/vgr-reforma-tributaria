import { describe, it, expect } from "vitest";
import { gerarIdConflito, paraCampoComProveniencia, origemDominioParaTipoDocumento, criarConflitoFonte } from "../proveniencia";
import { campoExtraido } from "../tipos";

describe("gerarIdConflito", () => {
  it("é determinístico para o mesmo campo+período+fontes, em qualquer ordem de fontes", () => {
    const fontesA = [{ tipoDocumento: "pgdas" as const, documentoId: "doc1" }, { tipoDocumento: "ecd" as const, documentoId: "doc2" }];
    const fontesB = [{ tipoDocumento: "ecd" as const, documentoId: "doc2" }, { tipoDocumento: "pgdas" as const, documentoId: "doc1" }];
    expect(gerarIdConflito("receita.faturamentoAnual", "2026", fontesA)).toBe(gerarIdConflito("receita.faturamentoAnual", "2026", fontesB));
  });

  it("muda quando o período muda", () => {
    const fontes = [{ tipoDocumento: "pgdas" as const, documentoId: "doc1" }];
    expect(gerarIdConflito("x", "2026", fontes)).not.toBe(gerarIdConflito("x", "2027", fontes));
  });

  it("muda quando o conjunto de fontes muda", () => {
    const a = [{ tipoDocumento: "pgdas" as const, documentoId: "doc1" }];
    const b = [{ tipoDocumento: "pgdas" as const, documentoId: "doc2" }];
    expect(gerarIdConflito("x", undefined, a)).not.toBe(gerarIdConflito("x", undefined, b));
  });
});

describe("origemDominioParaTipoDocumento — tradução na borda", () => {
  it("mapeia cada TipoDocumento para um dos 4 valores de OrigemInformacao já existentes no domínio", () => {
    const valoresValidos = new Set(["xml", "sped", "informado_usuario", "classificacao_vgr"]);
    for (const tipo of ["cnpj", "contrato_social", "pgdas", "defis", "xml_nfe", "nfse", "efd_icms_ipi", "efd_contribuicoes", "ecd", "ecf", "folha_fs12"] as const) {
      expect(valoresValidos.has(origemDominioParaTipoDocumento(tipo))).toBe(true);
    }
  });

  it("nunca usa informado_usuario para uma origem documental", () => {
    for (const tipo of ["cnpj", "contrato_social", "pgdas", "defis", "xml_nfe", "nfse", "efd_icms_ipi", "efd_contribuicoes", "ecd", "ecf", "folha_fs12"] as const) {
      expect(origemDominioParaTipoDocumento(tipo)).not.toBe("informado_usuario");
    }
  });
});

describe("paraCampoComProveniencia — preserva a origem granular na observação", () => {
  it("converte um CampoExtraido em CampoComProveniencia mantendo status e citando o tipoDocumento/período na observação", () => {
    const extraido = campoExtraido(4850000, "confirmado", { documentoId: "doc1", tipoDocumento: "pgdas", periodo: "2026-01" });
    const convertido = paraCampoComProveniencia(extraido);
    expect(convertido.valor).toBe(4850000);
    expect(convertido.status).toBe("confirmado");
    expect(convertido.origem).toBe("sped");
    expect(convertido.observacao).toContain("pgdas");
    expect(convertido.observacao).toContain("2026-01");
  });
});

describe("criarConflitoFonte", () => {
  it("gera um id consistente com gerarIdConflito a partir das fontes dos valores", () => {
    const valores = [campoExtraido(100, "confirmado", { documentoId: "d1", tipoDocumento: "pgdas" }), campoExtraido(200, "confirmado", { documentoId: "d2", tipoDocumento: "ecd" })];
    const conflito = criarConflitoFonte({ campo: "receita.faturamentoAnual", valores, gravidade: "atencao", status: "pendente" });
    expect(conflito.id).toBe(gerarIdConflito("receita.faturamentoAnual", undefined, conflito.fontes));
    expect(conflito.fontes).toHaveLength(2);
  });
});
