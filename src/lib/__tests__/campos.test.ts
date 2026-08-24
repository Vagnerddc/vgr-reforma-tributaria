import { describe, it, expect } from "vitest";
import { formatarPercentual, paraNumeroDigitadoPercentual } from "../campos";

describe("formatarPercentual — padrão único de percentual do sistema", () => {
  it("sempre mostra 2 casas decimais, mesmo quando o valor é inteiro ou tem 1 casa", () => {
    expect(formatarPercentual(2)).toBe("2,00");
    expect(formatarPercentual(7.5)).toBe("7,50");
    expect(formatarPercentual(18.75)).toBe("18,75");
    expect(formatarPercentual(70.25)).toBe("70,25");
    expect(formatarPercentual(2.01)).toBe("2,01");
  });

  it("nunca arredonda para número inteiro só porque o valor não tem parte decimal relevante", () => {
    expect(formatarPercentual(100)).toBe("100,00");
    expect(formatarPercentual(0)).toBe("0,00");
  });
});

describe("paraNumeroDigitadoPercentual — leitura do texto digitado com vírgula", () => {
  it("interpreta vírgula como separador decimal (padrão brasileiro)", () => {
    expect(paraNumeroDigitadoPercentual("2,01")).toBeCloseTo(2.01, 5);
    expect(paraNumeroDigitadoPercentual("7,50")).toBeCloseTo(7.5, 5);
    expect(paraNumeroDigitadoPercentual("18,75")).toBeCloseTo(18.75, 5);
  });

  it("não trava num número inteiro quando o usuário ainda está digitando a vírgula (ex.: '7,')", () => {
    // regressão: o valor numérico intermediário precisa continuar válido (7)
    // para o campo não travar, mesmo com a vírgula sozinha ainda sem dígitos depois
    expect(paraNumeroDigitadoPercentual("7,")).toBeCloseTo(7, 5);
  });

  it("aceita ponto também, para não quebrar em teclados/locales diferentes", () => {
    expect(paraNumeroDigitadoPercentual("7.5")).toBeCloseTo(7.5, 5);
  });
});
