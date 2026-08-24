import { describe, it, expect } from "vitest";
import { calcularStatusProntidao } from "../checklistProntidao";
import type { ChecklistProntidaoMigracao } from "../checklistProntidao";

function checklistTodoAtendido(): ChecklistProntidaoMigracao {
  return {
    equivalenciaCasosBasicos: "atendido",
    multiatividadeValidada: "atendido",
    zeroVsIndisponivelValidado: "atendido",
    fs12Validada: "atendido",
    creditosValidados: "atendido",
    splitValidado: "atendido",
    lucroRealValidado: "atendido",
    persistenciaAnaliseResolvida: "atendido",
    reloadValidado: "atendido",
    legadoSemRegressao: "atendido",
  };
}

describe("checklist de prontidão — regras explícitas, nunca um score arbitrário", () => {
  it("qualquer divergência material não explicada força nao_pronto, mesmo com checklist todo atendido", () => {
    expect(calcularStatusProntidao(checklistTodoAtendido(), true)).toBe("nao_pronto");
  });

  it("qualquer item não atendido força nao_pronto", () => {
    const checklist = { ...checklistTodoAtendido(), fs12Validada: "nao_atendido" as const };
    expect(calcularStatusProntidao(checklist, false)).toBe("nao_pronto");
  });

  it("todos atendidos e zero divergência material → pronto_para_piloto", () => {
    expect(calcularStatusProntidao(checklistTodoAtendido(), false)).toBe("pronto_para_piloto");
  });

  it("a função nunca retorna pronto_para_migracao_controlada sozinha — isso exige avaliação humana adicional (seção 94/98)", () => {
    const status = calcularStatusProntidao(checklistTodoAtendido(), false);
    expect(status).not.toBe("pronto_para_migracao_controlada");
  });
});
