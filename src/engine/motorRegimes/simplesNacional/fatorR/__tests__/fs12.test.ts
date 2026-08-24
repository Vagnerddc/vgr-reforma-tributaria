import { describe, it, expect } from "vitest";
import { calcularFs12Anual } from "../fs12";
import { campoComProveniencia as campo } from "../../../../operacaoTributaria";
import type { PessoasEmpresa } from "../../../../cenarioEmpresa";

describe("calcularFs12Anual — só componentes legalmente computáveis, nunca PJ/terceiros", () => {
  it("soma folha + encargos + pró-labore quando os três estão presentes", () => {
    const pessoas: PessoasEmpresa = {
      folhaAnual: campo(200_000, "informado_usuario", "confirmado"),
      encargosAnual: campo(60_000, "informado_usuario", "confirmado"),
      proLaboreAnual: campo(40_000, "informado_usuario", "confirmado"),
    };
    const r = calcularFs12Anual(pessoas);
    expect(r.valor).toBe(300_000);
    expect(r.componentesAusentes).toEqual([]);
  });

  it("terceirosAutonomosAnual NUNCA entra na FS12, mesmo quando informado", () => {
    const pessoas: PessoasEmpresa = {
      folhaAnual: campo(200_000, "informado_usuario", "confirmado"),
      terceirosAutonomosAnual: campo(500_000, "informado_usuario", "confirmado"), // não deve ser somado
    };
    const r = calcularFs12Anual(pessoas);
    expect(r.valor).toBe(200_000);
  });

  it("indeterminada (undefined) quando nenhum componente computável foi informado", () => {
    const r = calcularFs12Anual({});
    expect(r.valor).toBeUndefined();
  });

  it("parcialmente determinada: soma só o que está presente, e sinaliza o que falta", () => {
    const pessoas: PessoasEmpresa = { proLaboreAnual: campo(50_000, "informado_usuario", "confirmado") };
    const r = calcularFs12Anual(pessoas);
    expect(r.valor).toBe(50_000);
    expect(r.componentesAusentes).toContain("folhaAnual");
    expect(r.componentesAusentes).toContain("encargosAnual");
  });

  it("status é 'estimado' quando qualquer componente usado tiver essa proveniência", () => {
    const pessoas: PessoasEmpresa = {
      folhaAnual: campo(200_000, "informado_usuario", "confirmado"),
      proLaboreAnual: campo(40_000, "classificacao_vgr", "estimado"),
    };
    expect(calcularFs12Anual(pessoas).status).toBe("estimado");
  });
});
