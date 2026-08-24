import { describe, it, expect } from "vitest";
import { ingerirContratoSocial } from "../adapters/contratoSocial";

const TEXTO_CONTRATO = `
CLÁUSULA PRIMEIRA - OBJETO SOCIAL
A sociedade tem por objeto social a prestação de serviços de consultoria em gestão empresarial e tecnologia da informação.

CLÁUSULA SEGUNDA - CAPITAL SOCIAL
O capital social é de R$ 100.000,00, dividido em quotas iguais.

CLÁUSULA TERCEIRA - ADMINISTRAÇÃO
A administração da sociedade caberá a João Pereira, CPF 123.456.789-00, portador da carteira de identidade RG 12.345.678-9, casado, residente e domiciliado na Rua das Flores, 123.
`.trim();

describe("ingerirContratoSocial", () => {
  it("extrai objeto social e capital social por rótulo", () => {
    const resultado = ingerirContratoSocial(TEXTO_CONTRATO, "doc-cs-1");
    const porObservacao = new Map(resultado.camposExtraidos.map((c) => [c.observacao, c.valor]));
    expect(String(porObservacao.get("objetoSocial"))).toContain("consultoria em gestão empresarial");
    expect(porObservacao.get("capitalSocial")).toBe(100000);
  });

  it("NUNCA propaga CPF, RG, estado civil ou endereço pessoal para o resultado", () => {
    const resultado = ingerirContratoSocial(TEXTO_CONTRATO, "doc-cs-2");
    const textoCompleto = JSON.stringify(resultado.camposExtraidos);
    expect(textoCompleto).not.toContain("123.456.789-00");
    expect(textoCompleto).not.toContain("12.345.678-9");
    expect(textoCompleto).not.toMatch(/\bcasado\b/i);
    expect(textoCompleto).not.toContain("Rua das Flores");
  });

  it("gera alerta e status 'falhou' quando nenhuma seção é reconhecida", () => {
    const resultado = ingerirContratoSocial("texto sem nenhuma cláusula reconhecível", "doc-cs-3");
    expect(resultado.status).toBe("falhou");
    expect(resultado.alertas.some((a) => a.codigo === "nenhuma_secao_localizada")).toBe(true);
  });
});
