import type { MotorRegime } from "../tipos";
import { avaliarElegibilidadeSimples } from "./elegibilidade";
import { calcularNucleoSimples } from "./nucleo";

/** Simples com DAS unificado (comportamento hoje) — CBS/IBS refletidos via calculo.ts, ramo "simples_unificado". */
export const motorSimplesUnificado: MotorRegime = {
  regime: "simples_unificado",
  avaliarElegibilidade: (cenario) => avaliarElegibilidadeSimples(cenario, "simples_unificado"),
  calcular: (cenario, elegibilidade) => calcularNucleoSimples(cenario, elegibilidade, "simples_unificado"),
};

/** Simples híbrido (DAS residual + apuração própria de CBS/IBS durante a transição) — ramo "simples_hibrido" de calculo.ts. */
export const motorSimplesHibrido: MotorRegime = {
  regime: "simples_hibrido",
  avaliarElegibilidade: (cenario) => avaliarElegibilidadeSimples(cenario, "simples_hibrido"),
  calcular: (cenario, elegibilidade) => calcularNucleoSimples(cenario, elegibilidade, "simples_hibrido"),
};
