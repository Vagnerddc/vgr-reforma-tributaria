import type { MotorRegime } from "../../engine/motorRegimes/tipos";
import type { Regime } from "../../engine/types";
import { motorLucroPresumido } from "../../engine/motorRegimes/lucroPresumido/motor";
import { motorLucroReal } from "../../engine/motorRegimes/lucroReal/motor";
import { motorSimplesUnificado, motorSimplesHibrido } from "../../engine/motorRegimes/simplesNacional/motor";

const MOTOR_POR_REGIME: Record<Regime, MotorRegime> = {
  simples_unificado: motorSimplesUnificado,
  simples_hibrido: motorSimplesHibrido,
  lucro_presumido: motorLucroPresumido,
  lucro_real: motorLucroReal,
};

export function motoresParaRegimes(regimes: Regime[]): MotorRegime[] {
  return regimes.map((r) => MOTOR_POR_REGIME[r]);
}
