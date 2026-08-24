import { describe, it, expect } from "vitest";
import { ingerirEfdIcmsIpi } from "../adapters/efdIcmsIpi";
import { ingerirEfdContribuicoes } from "../adapters/efdContribuicoes";
import { ingerirEcd } from "../adapters/ecd";
import { ingerirEcf } from "../adapters/ecf";

const EFD_ICMS_IPI = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|1700,00|1700,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|DESCRICAO PRODUTO|1|UN|10000,00|0,00|0|000|5101|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|850,00|0,00|
`.trim();

const EFD_CONTRIBUICOES = `
|0000|005|0|||01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|M200|0,00|0,00|0,00|0,00|0,00|320,00|0,00|0,00|0,00|0,00|0,00|0,00|320,00|
|M600|0,00|0,00|0,00|0,00|0,00|620,00|0,00|0,00|0,00|0,00|0,00|0,00|620,00|
`.trim();

const ECD = `
|0000|LECD|0|01012026|31012026|EMPRESA TESTE|12345678000199|SP|||||G|0|N|
|I050|01012026|N|1|1|CAIXA GERAL||
|I155|110000000001|N|0,00|50000,00|0,00|
`.trim();

const ECF_SEM_BLOCOS = `
|0000|017|EMPRESA TESTE|12345678000199|
|Y540|dado qualquer|
`.trim();

describe("ingerirEfdIcmsIpi / ingerirEfdContribuicoes / ingerirEcd — wrappers finos dos parsers existentes", () => {
  it("empacota o ArquivoSpedProcessado em ResultadoIngestaoDocumento preservando o período e a apuração", () => {
    const resultado = ingerirEfdIcmsIpi("icms.txt", EFD_ICMS_IPI, "doc-icms-1");
    expect(resultado.tipoDocumento).toBe("efd_icms_ipi");
    expect(resultado.periodo).toBe("01012026_31012026");
    expect(resultado.metadados.arquivoSpedProcessado).toBeDefined();
    expect(resultado.camposExtraidos.some((c) => c.observacao === "apuracao.icms")).toBe(true);
  });

  it("EFD-Contribuições preserva as apurações de PIS e COFINS", () => {
    const resultado = ingerirEfdContribuicoes("contrib.txt", EFD_CONTRIBUICOES, "doc-contrib-1");
    const observacoes = resultado.camposExtraidos.map((c) => c.observacao);
    expect(observacoes).toContain("apuracao.pis");
    expect(observacoes).toContain("apuracao.cofins");
  });

  it("ECD empacota sem erro (saldos contábeis ficam em metadados.arquivoSpedProcessado, não em camposExtraidos escalares)", () => {
    const resultado = ingerirEcd("ecd.txt", ECD, "doc-ecd-1");
    expect(resultado.tipoDocumento).toBe("ecd");
    expect(["processado", "processado_com_ressalvas"]).toContain(resultado.status);
  });
});

describe("ingerirEcf — extração mínima, nunca fabrica valor", () => {
  it("detecta a presença de registros de apuração sem extrair valor (indeterminado) quando não há fixture validada", () => {
    const resultado = ingerirEcf("ecf.txt", ECF_SEM_BLOCOS, "doc-ecf-1");
    expect(resultado.tipoDocumento).toBe("ecf");
    // Nenhum valor de receita/resultado/IRPJ/CSLL é fabricado — apenas o que resumoEcf populou (nada, nesta fase).
    expect(resultado.camposExtraidos).toHaveLength(0);
    expect(resultado.limitacoes.some((l) => l.descricao.includes("Y540"))).toBe(true);
  });
});
