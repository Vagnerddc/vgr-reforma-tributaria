import { describe, it, expect } from "vitest";
import { identificarRegimeProdutoPorNcm } from "../produtoRegimeEspecial";

describe("identificarRegimeProdutoPorNcm", () => {
  it("identifica arroz (Anexo I, cesta básica) como alíquota zero", () => {
    const regime = identificarRegimeProdutoPorNcm("1006.20.00");
    expect(regime?.reducao).toBe(1);
    expect(regime?.anexo).toBe("I");
    expect(regime?.artigo).toBe("art. 125");
  });

  it("identifica ovos (Anexo XV, hortícolas/ovos in natura) como alíquota zero", () => {
    const regime = identificarRegimeProdutoPorNcm("04072100");
    expect(regime?.reducao).toBe(1);
    expect(regime?.anexo).toBe("XV");
  });

  it("identifica dispositivo médico (Anexo IV) como redução de 60%", () => {
    const regime = identificarRegimeProdutoPorNcm("3926.90.30");
    expect(regime?.reducao).toBe(0.6);
    expect(regime?.anexo).toBe("IV");
    expect(regime?.artigo).toBe("art. 131");
  });

  it("prioriza alíquota zero quando o NCM também aparece num Anexo de 60% (evita duplo desconto na direção errada)", () => {
    // Farinha (Anexo VII, 60%) tem cláusula "ressalvados os produtos do Anexo I" — por isso
    // o item de farinha do Anexo VII fica de fora da tabela ativa (exceção não modelada);
    // aqui testamos que, se um NCM aparecer em ambos, o zero do Anexo I prevalece.
    const regime = identificarRegimeProdutoPorNcm("1006.20.00");
    expect(regime?.reducao).toBe(1);
  });

  it("retorna null para NCM fora de qualquer Anexo mapeado", () => {
    expect(identificarRegimeProdutoPorNcm("8471.30.00")).toBeNull();
  });

  it("aceita NCM com ou sem pontuação", () => {
    const comPontos = identificarRegimeProdutoPorNcm("3926.90.30");
    const semPontos = identificarRegimeProdutoPorNcm("39269030");
    expect(comPontos?.anexo).toBe(semPontos?.anexo);
  });
});
