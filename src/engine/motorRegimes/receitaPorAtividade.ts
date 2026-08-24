/**
 * Resolução de receita por atividade — compartilhada entre motores de
 * regime (Presumido, Simples, e futuros) porque a regra é a mesma em
 * todos: nunca inventar segregação de receita entre atividades quando o
 * cenário não a informa explicitamente (seção 7/21 dos pedidos de
 * Presumido e Simples). Extraído do MotorLucroPresumido nesta fase para
 * não duplicar a mesma lógica no MotorSimplesNacional.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";

export interface AtividadeComReceita {
  perfilId: string;
  receitaAnualBase: number;
}

export function resolverAtividadesComReceita(cenario: CenarioEmpresa): { atividades: AtividadeComReceita[]; alertas: string[] } {
  const alertas: string[] = [];
  const principal = cenario.identificacao.atividadePrincipal;
  const secundarias = cenario.identificacao.atividadesSecundarias ?? [];

  if (!principal) return { atividades: [], alertas: ["Nenhuma atividade principal informada — impossível classificar a receita."] };

  if (secundarias.length === 0) {
    const receita = cenario.receita.faturamentoAnual?.valor;
    if (receita === undefined) return { atividades: [], alertas: ["Receita anual não informada."] };
    return { atividades: [{ perfilId: principal.perfilId, receitaAnualBase: receita }], alertas: [] };
  }

  const todasAtividades = [principal, ...secundarias];
  const atividades: AtividadeComReceita[] = [];
  for (const atividade of todasAtividades) {
    const receita = cenario.receita.receitaPorAtividade?.[atividade.perfilId]?.valor;
    if (receita === undefined) {
      alertas.push(`Receita da atividade "${atividade.perfilId}" não segregada — essa atividade não entra no cálculo (nenhuma distribuição proporcional foi assumida).`);
      continue;
    }
    atividades.push({ perfilId: atividade.perfilId, receitaAnualBase: receita });
  }
  return { atividades, alertas };
}
