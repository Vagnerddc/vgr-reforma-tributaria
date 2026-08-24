import { describe, it, expect } from "vitest";
import { extrairOperacoesGranularesEfdIcmsIpi, extrairOperacoesGranularesEfdContribuicoes } from "../granular";
import { processarEfdIcmsIpi } from "../efdIcmsIpi";
import { processarEfdContribuicoes } from "../efdContribuicoes";
import { avaliarCompletudeOperacao } from "../../operacaoTributaria";

// Mesmo fixture de src/engine/sped/__tests__/sped.test.ts — repetido aqui de propósito
// (fixtures de teste isoladas por arquivo, mesmo padrão já usado no projeto).
const EFD_ICMS_IPI = `
|0000|017|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0150|PART002|JOAO DA SILVA|1058||11122233344||||||
|C100|1|1|PART001|55|00|123|CHAVE_XXX|15012026|15012026|10000,00|0|0,00|0,00|10000,00|0|0,00|0,00|0,00|1700,00|1700,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|PROD001|DESCRICAO PRODUTO|1|UN|10000,00|0,00|0|000|5101|
|C100|0|0|PART002|55|00|456|CHAVE_YYY|10012026|10012026|2000,00|0|0,00|0,00|2000,00|0|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|
|C170|1|SERV001|MATERIAL DIVERSO|1|UN|2000,00|0,00|0|000|1556|
|E110|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|850,00|0,00|
`.trim();

const EFD_CONTRIBUICOES = `
|0000|005|0|||01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|1234|||A|0|
|0150|PART001|CLIENTE ABC LTDA|1058|12345678000100||||||||
|0150|PART003|CONSULTORIA XYZ LTDA|1058|98765432000155||||||||
|A100|0|0|PART003|00|1|1|789|CHAVE_NFSE|20012026|20012026|1500,00|0|0,00|
|M200|0,00|0,00|0,00|0,00|0,00|320,00|0,00|0,00|0,00|0,00|0,00|0,00|320,00|
|M600|0,00|0,00|0,00|0,00|0,00|620,00|0,00|0,00|0,00|0,00|0,00|0,00|620,00|
`.trim();

describe("extrairOperacoesGranularesEfdIcmsIpi — pipeline paralelo, não altera o pipeline de agregação existente", () => {
  it("extrai uma OperacaoTributariaNormalizada por item C170, preservando valor, CFOP, CST_ICMS, quantidade e unidade", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    expect(operacoes).toHaveLength(2);

    const primeira = operacoes[0];
    expect(primeira.valores.valorOperacao?.valor).toBeCloseTo(10000);
    expect(primeira.classificacaoTributaria.cfop?.valor).toBe("5101");
    expect(primeira.classificacaoTributaria.cst?.valor).toBe("000");
    expect(primeira.produtoServico.quantidade?.valor).toBe(1);
    expect(primeira.produtoServico.unidade?.valor).toBe("UN");
    expect(primeira.identificacao.documentoId?.valor).toBe("123");
    expect(primeira.granularidade).toBe("item");
  });

  it("preserva a chave de NF-e (CHV_NFE) quando presente — usada na identidade estável", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    expect(operacoes[0].id).toBe("CHAVE_XXX-1");
    expect(operacoes[1].id).toBe("CHAVE_YYY-1");
  });

  it("não inventa cClassTrib nem NBS — campos ausentes no leiaute EFD ICMS/IPI permanecem undefined, nunca um valor fictício", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    for (const op of operacoes) {
      expect(op.classificacaoTributaria.cClassTrib).toBeUndefined();
      expect(op.produtoServico.nbs).toBeUndefined();
    }
  });

  it("não inventa NCM quando o item não está cadastrado no registro 0200 — o fixture não tem 0200, então NCM fica ausente", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    for (const op of operacoes) {
      expect(op.produtoServico.ncm).toBeUndefined();
    }
  });

  it("marca o município como estimado/empresa (não da operação), nunca como confirmado — proveniência honesta", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    expect(operacoes[0].localidade.municipio?.valor).toBe("1234");
    expect(operacoes[0].localidade.municipio?.status).toBe("estimado");
    expect(operacoes[0].localidade.municipio?.observacao).toMatch(/empresa/i);
  });

  it("não altera o resultado do pipeline de agregação existente (regressão)", () => {
    const antes = processarEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI); // roda o pipeline paralelo
    const depois = processarEfdIcmsIpi("icms.txt", EFD_ICMS_IPI); // pipeline original, de novo, isoladamente
    expect(depois).toEqual(antes);
  });

  it("nenhuma operação extraída hoje é elegível ao Motor Oficial (falta cClassTrib e município confiável) — mede o gap real do spike", () => {
    const operacoes = extrairOperacoesGranularesEfdIcmsIpi("icms.txt", EFD_ICMS_IPI);
    for (const op of operacoes) {
      const completude = avaliarCompletudeOperacao(op);
      expect(completude.completudeEntrada).not.toBe("completa");
      expect(completude.camposFaltantes).toContain("cClassTrib");
    }
  });
});

describe("extrairOperacoesGranularesEfdContribuicoes — pipeline paralelo", () => {
  it("extrai operações a partir de C170 (A100, sem granularidade de item, fica fora nesta fase)", () => {
    // O fixture só tem A100 (documento de serviço consolidado, sem C170) — resultado esperado é vazio,
    // confirmando que este pipeline não inventa granularidade onde a fonte não a fornece.
    const operacoes = extrairOperacoesGranularesEfdContribuicoes("contrib.txt", EFD_CONTRIBUICOES);
    expect(operacoes).toEqual([]);
  });

  it("não altera o resultado do pipeline de agregação existente (regressão)", () => {
    const antes = processarEfdContribuicoes("contrib.txt", EFD_CONTRIBUICOES);
    extrairOperacoesGranularesEfdContribuicoes("contrib.txt", EFD_CONTRIBUICOES);
    const depois = processarEfdContribuicoes("contrib.txt", EFD_CONTRIBUICOES);
    expect(depois).toEqual(antes);
  });
});
