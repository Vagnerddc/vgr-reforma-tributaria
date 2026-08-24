/**
 * Checklist objetivo de prontidão — nunca um score percentual
 * arbitrário (seção 29). Cada item é atendido/não atendido/não
 * avaliado; o status final deriva de regras explícitas, não de
 * julgamento.
 */

export type StatusItemChecklist = "atendido" | "nao_atendido" | "nao_avaliado";

export interface ChecklistProntidaoMigracao {
  equivalenciaCasosBasicos: StatusItemChecklist;
  multiatividadeValidada: StatusItemChecklist;
  zeroVsIndisponivelValidado: StatusItemChecklist;
  fs12Validada: StatusItemChecklist;
  creditosValidados: StatusItemChecklist;
  splitValidado: StatusItemChecklist;
  lucroRealValidado: StatusItemChecklist;
  persistenciaAnaliseResolvida: StatusItemChecklist;
  reloadValidado: StatusItemChecklist;
  legadoSemRegressao: StatusItemChecklist;
}

export type StatusProntidaoMigracao = "nao_pronto" | "pronto_para_piloto" | "pronto_para_migracao_controlada";

/**
 * Regras explícitas (seção 32/33/94/96/97):
 * - Qualquer divergência material não explicada → nao_pronto, sempre.
 * - Qualquer item do checklist não atendido → nao_pronto.
 * - Todos atendidos e zero divergência material → pronto_para_piloto.
 * - "pronto_para_migracao_controlada" exige, além disso, evidência de
 *   piloto real (fora do escopo de fixtures sintéticas desta fase) —
 *   por isso esta função nunca retorna esse status sozinha; ele é uma
 *   decisão humana posterior, documentada explicitamente no relatório.
 */
export function calcularStatusProntidao(checklist: ChecklistProntidaoMigracao, existeDivergenciaMaterialNaoExplicada: boolean): StatusProntidaoMigracao {
  if (existeDivergenciaMaterialNaoExplicada) return "nao_pronto";
  const itens = Object.values(checklist);
  if (itens.some((status) => status !== "atendido")) return "nao_pronto";
  return "pronto_para_piloto";
}
