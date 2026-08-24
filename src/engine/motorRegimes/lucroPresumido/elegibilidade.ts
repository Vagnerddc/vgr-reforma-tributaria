/**
 * Elegibilidade do Lucro Presumido — determinística, nunca assume
 * elegibilidade só porque o dado falta (seção 4 do pedido: "ausência de
 * evidência não equivale a elegibilidade"). Presumido só pode ser
 * elegivel/inelegivel/indeterminado — nunca obrigatorio/opcional (isso é
 * exclusivo do Lucro Real).
 */

import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { AvaliacaoElegibilidade, CriterioElegibilidade } from "../tipos";
import { LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO } from "./normativa";
import { buscarPerfil } from "../../setores/catalogo";

/**
 * Arquétipos para os quais um impedimento (instituição financeira,
 * factoring etc. — Lei 9.718/1998, art. 14) é uma possibilidade real que
 * não pode ser descartada sem confirmação explícita. Fora desses casos, a
 * ausência de sinalização de impedimento é lida como "nenhum impedimento
 * identificado" (exatamente o exemplo dado no pedido: "dados suficientes
 * e ausência de impedimento identificado" = elegível) — não seria correto
 * exigir confirmação positiva de não-impedimento para TODA empresa, isso
 * tornaria qualquer cenário sem essa flag automaticamente "indeterminado".
 */
const ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO_DE_IMPEDIMENTO = new Set(["financeiro"]);

function avaliarLimiteReceita(cenario: CenarioEmpresa): CriterioElegibilidade {
  const faturamento = cenario.receita.faturamentoAnual;
  if (faturamento === undefined) {
    return {
      id: "limite_receita_bruta_anual",
      descricao: `Receita bruta anual até R$ ${LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO.valor.toLocaleString("pt-BR")} (${LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO.fundamento})`,
      atendido: "indeterminado",
      fonte: { valor: "faturamento anual não informado no cenário", origem: "informado_usuario", status: "importado" },
    };
  }
  return {
    id: "limite_receita_bruta_anual",
    descricao: `Receita bruta anual até R$ ${LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO.valor.toLocaleString("pt-BR")} (${LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO.fundamento})`,
    atendido: faturamento.valor <= LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO.valor,
    fonte: { valor: `faturamento informado: R$ ${faturamento.valor.toLocaleString("pt-BR")}`, origem: faturamento.origem, status: faturamento.status },
  };
}

function avaliarImpedimentoAtividade(cenario: CenarioEmpresa): CriterioElegibilidade {
  const flagExplicita = cenario.tributario.tratamentosEspeciais?.includes("atividade_impeditiva_presumido");
  if (flagExplicita) {
    return {
      id: "atividade_impeditiva",
      descricao: "Ausência de atividade impeditiva ao Lucro Presumido (Lei 9.718/1998, art. 14)",
      atendido: false,
      fonte: { valor: "cenário sinaliza explicitamente atividade impeditiva", origem: "informado_usuario", status: "confirmado" },
    };
  }

  const perfil = cenario.identificacao.atividadePrincipal?.perfilId ? buscarPerfil(cenario.identificacao.atividadePrincipal.perfilId) : undefined;
  const exigeConfirmacao = perfil?.arquetipos.some((a) => ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO_DE_IMPEDIMENTO.has(a)) ?? false;

  if (exigeConfirmacao) {
    return {
      id: "atividade_impeditiva",
      descricao: "Ausência de atividade impeditiva ao Lucro Presumido (Lei 9.718/1998, art. 14)",
      atendido: "indeterminado",
      fonte: { valor: `perfil "${perfil?.segmento}" tem arquétipo financeiro — impedimento não pode ser descartado sem confirmação explícita`, origem: "classificacao_vgr", status: "estimado" },
    };
  }

  return {
    id: "atividade_impeditiva",
    descricao: "Ausência de atividade impeditiva ao Lucro Presumido (Lei 9.718/1998, art. 14)",
    atendido: true,
    fonte: { valor: "nenhum impedimento identificado no cenário", origem: "classificacao_vgr", status: "estimado" },
  };
}

export function avaliarElegibilidadePresumido(cenario: CenarioEmpresa): AvaliacaoElegibilidade {
  const criterios = [avaliarLimiteReceita(cenario), avaliarImpedimentoAtividade(cenario)];

  if (criterios.some((c) => c.atendido === false)) {
    return { regime: "lucro_presumido", status: "inelegivel", motivo: "Condição impeditiva identificada — ver critérios.", criterios };
  }
  if (criterios.some((c) => c.atendido === "indeterminado")) {
    return { regime: "lucro_presumido", status: "indeterminado", motivo: "Informação necessária para confirmar elegibilidade não está disponível no cenário — ver critérios.", criterios };
  }
  return { regime: "lucro_presumido", status: "elegivel", motivo: "Dados suficientes e ausência de impedimento identificado.", criterios };
}
