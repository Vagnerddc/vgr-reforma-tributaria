/**
 * Elegibilidade do Simples Nacional — determinística, nunca assume
 * elegibilidade por `regimeAtual === "simples_*"` (seção 4 do pedido).
 * Só elegivel/inelegivel/indeterminado nesta fase (o núcleo geral não
 * lida com nenhuma condição que produza "obrigatorio"/"opcional" para o
 * Simples — diferente do Lucro Real).
 */

import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { AvaliacaoElegibilidade, CriterioElegibilidade } from "../tipos";
import type { Regime } from "../../types";
import { LIMITE_RBT12_SIMPLES } from "./normativa";
import { buscarPerfil } from "../../setores/catalogo";

/** Mesmo racional já usado no Presumido: arquétipo financeiro exige confirmação explícita de ausência de impedimento, nunca presumida pela omissão. */
const ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO_DE_IMPEDIMENTO = new Set(["financeiro"]);

function avaliarLimiteRbt12(cenario: CenarioEmpresa): CriterioElegibilidade {
  const faturamento = cenario.receita.faturamentoAnual;
  if (faturamento === undefined) {
    return {
      id: "limite_rbt12",
      descricao: `RBT12 até R$ ${LIMITE_RBT12_SIMPLES.valor.toLocaleString("pt-BR")} (${LIMITE_RBT12_SIMPLES.fundamento})`,
      atendido: "indeterminado",
      fonte: { valor: "receita anual não informada — RBT12 não pode ser estimada", origem: "informado_usuario", status: "importado" },
    };
  }
  // Aproximação de RBT12 pela receita anual informada apenas para fins de ELEGIBILIDADE
  // (um corte grosseiro "está claramente dentro/fora do limite") — o cálculo real e rolante
  // de RBT12 mês a mês vive em rbt12.ts, usado no cálculo do DAS, não aqui.
  return {
    id: "limite_rbt12",
    descricao: `RBT12 até R$ ${LIMITE_RBT12_SIMPLES.valor.toLocaleString("pt-BR")} (${LIMITE_RBT12_SIMPLES.fundamento})`,
    atendido: faturamento.valor <= LIMITE_RBT12_SIMPLES.valor,
    fonte: { valor: `receita anual informada como aproximação de RBT12: R$ ${faturamento.valor.toLocaleString("pt-BR")}`, origem: faturamento.origem, status: faturamento.status },
  };
}

function avaliarImpedimentoAtividade(cenario: CenarioEmpresa): CriterioElegibilidade {
  const flagExplicita = cenario.tributario.tratamentosEspeciais?.includes("atividade_impeditiva_simples");
  if (flagExplicita) {
    return {
      id: "atividade_impeditiva",
      descricao: "Ausência de atividade impeditiva ao Simples Nacional (LC 123/2006, art. 17)",
      atendido: false,
      fonte: { valor: "cenário sinaliza explicitamente atividade impeditiva", origem: "informado_usuario", status: "confirmado" },
    };
  }

  const perfil = cenario.identificacao.atividadePrincipal?.perfilId ? buscarPerfil(cenario.identificacao.atividadePrincipal.perfilId) : undefined;
  const exigeConfirmacao = perfil?.arquetipos.some((a) => ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO_DE_IMPEDIMENTO.has(a)) ?? false;

  if (exigeConfirmacao) {
    return {
      id: "atividade_impeditiva",
      descricao: "Ausência de atividade impeditiva ao Simples Nacional (LC 123/2006, art. 17)",
      atendido: "indeterminado",
      fonte: { valor: `perfil "${perfil?.segmento}" tem arquétipo financeiro — impedimento não pode ser descartado sem confirmação explícita`, origem: "classificacao_vgr", status: "estimado" },
    };
  }

  return {
    id: "atividade_impeditiva",
    descricao: "Ausência de atividade impeditiva ao Simples Nacional (LC 123/2006, art. 17)",
    atendido: true,
    fonte: { valor: "nenhum impedimento identificado no cenário", origem: "classificacao_vgr", status: "estimado" },
  };
}

/**
 * `regime` é parametrizado porque o núcleo de elegibilidade é IDÊNTICO
 * para "simples_unificado" e "simples_hibrido" — só o carimbo do resultado
 * muda, conforme qual dos dois MotorRegime chamou (ver motor.ts).
 */
export function avaliarElegibilidadeSimples(cenario: CenarioEmpresa, regime: Regime): AvaliacaoElegibilidade {
  const criterios = [avaliarLimiteRbt12(cenario), avaliarImpedimentoAtividade(cenario)];

  if (criterios.some((c) => c.atendido === false)) {
    return { regime, status: "inelegivel", motivo: "Condição impeditiva identificada — ver critérios.", criterios };
  }
  if (criterios.some((c) => c.atendido === "indeterminado")) {
    return { regime, status: "indeterminado", motivo: "Informação necessária para confirmar elegibilidade não está disponível no cenário — ver critérios.", criterios };
  }
  return { regime, status: "elegivel", motivo: "Dados suficientes e ausência de impedimento identificado.", criterios };
}
