import { describe, it, expect } from "vitest";
import { recomendarDocumentosPorRegime } from "../roteadorDocumental";

function obrigatoriedade(itens: ReturnType<typeof recomendarDocumentosPorRegime>["itens"], tipo: string) {
  return itens.find((i) => i.tipoDocumento === tipo)?.obrigatoriedade;
}

describe("recomendarDocumentosPorRegime — Simples", () => {
  it("recomenda CNPJ e PGDAS-D, e não exige ECD/ECF/EFD-Contribuições", () => {
    const checklist = recomendarDocumentosPorRegime("simples_unificado");
    expect(obrigatoriedade(checklist.itens, "cnpj")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "pgdas")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "ecd")).toBe("nao_aplicavel");
    expect(obrigatoriedade(checklist.itens, "ecf")).toBe("nao_aplicavel");
    expect(obrigatoriedade(checklist.itens, "efd_contribuicoes")).toBe("nao_aplicavel");
  });

  it("recomenda Folha/FS12 quando o Fator R é relevante, mas não exige por padrão", () => {
    expect(obrigatoriedade(recomendarDocumentosPorRegime("simples_hibrido").itens, "folha_fs12")).toBe("opcional");
    expect(obrigatoriedade(recomendarDocumentosPorRegime("simples_hibrido", { fatorRRelevante: true }).itens, "folha_fs12")).toBe("recomendado");
  });

  it("nunca bloqueia — todo item tem obrigatoriedade recomendado/opcional/nao_aplicavel, nunca um valor que impeça seguir", () => {
    const checklist = recomendarDocumentosPorRegime("simples_unificado");
    for (const item of checklist.itens) expect(["recomendado", "opcional", "nao_aplicavel"]).toContain(item.obrigatoriedade);
  });
});

describe("recomendarDocumentosPorRegime — Lucro Presumido", () => {
  it("recomenda XML, EFD-Contribuições e ECF; PGDAS/DEFIS não aplicáveis", () => {
    const checklist = recomendarDocumentosPorRegime("lucro_presumido");
    expect(obrigatoriedade(checklist.itens, "xml_nfe")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "efd_contribuicoes")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "ecf")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "pgdas")).toBe("nao_aplicavel");
    expect(obrigatoriedade(checklist.itens, "defis")).toBe("nao_aplicavel");
  });
});

describe("recomendarDocumentosPorRegime — Lucro Real", () => {
  it("recomenda ECD, ECF, EFD-Contribuições e Folha/FS12 sempre", () => {
    const checklist = recomendarDocumentosPorRegime("lucro_real");
    expect(obrigatoriedade(checklist.itens, "ecd")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "ecf")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "efd_contribuicoes")).toBe("recomendado");
    expect(obrigatoriedade(checklist.itens, "folha_fs12")).toBe("recomendado");
  });

  it("EFD ICMS/IPI não aplicável quando a empresa não circula mercadoria", () => {
    expect(obrigatoriedade(recomendarDocumentosPorRegime("lucro_real", { icmsIpiAplicavel: false }).itens, "efd_icms_ipi")).toBe("nao_aplicavel");
    expect(obrigatoriedade(recomendarDocumentosPorRegime("lucro_real", { icmsIpiAplicavel: true }).itens, "efd_icms_ipi")).toBe("recomendado");
  });
});
