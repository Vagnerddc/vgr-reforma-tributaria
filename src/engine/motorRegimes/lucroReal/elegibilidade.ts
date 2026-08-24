/**
 * Elegibilidade/obrigatoriedade do Lucro Real — único regime, entre os
 * três implementados, que pode ser `"obrigatorio"` (Lei 9.718/1998, art.
 * 14). Qualquer empresa PODE optar por Real (não existe hipótese legal
 * de "inelegível ao Real") — por isso o status default, sem
 * obrigatoriedade identificada, é `"opcional"`, nunca `"elegivel"`
 * (`AvaliacaoElegibilidade.status` comporta os dois; `"opcional"` é o
 * semanticamente correto aqui — Real está sempre disponível como opção).
 */

import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { AvaliacaoElegibilidade, CriterioElegibilidade } from "../tipos";
import { LIMITE_RECEITA_OBRIGATORIEDADE_REAL } from "./normativa";
import { buscarPerfil } from "../../setores/catalogo";

const ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO = new Set(["financeiro"]);

function avaliarObrigatoriedadePorReceita(cenario: CenarioEmpresa): CriterioElegibilidade {
  const faturamento = cenario.receita.faturamentoAnual;
  if (faturamento === undefined) {
    return {
      id: "obrigatoriedade_por_receita",
      descricao: `Receita total do ano anterior acima de R$ ${LIMITE_RECEITA_OBRIGATORIEDADE_REAL.valor.toLocaleString("pt-BR")} obriga ao Lucro Real (${LIMITE_RECEITA_OBRIGATORIEDADE_REAL.fundamento})`,
      atendido: "indeterminado",
      fonte: { valor: "receita anual não informada", origem: "informado_usuario", status: "importado" },
    };
  }
  return {
    id: "obrigatoriedade_por_receita",
    descricao: `Receita total do ano anterior acima de R$ ${LIMITE_RECEITA_OBRIGATORIEDADE_REAL.valor.toLocaleString("pt-BR")} obriga ao Lucro Real (${LIMITE_RECEITA_OBRIGATORIEDADE_REAL.fundamento})`,
    atendido: faturamento.valor > LIMITE_RECEITA_OBRIGATORIEDADE_REAL.valor,
    fonte: { valor: `receita anual informada: R$ ${faturamento.valor.toLocaleString("pt-BR")}`, origem: faturamento.origem, status: faturamento.status },
  };
}

/**
 * Atividade financeira (Lei 9.718/1998, art. 14, II) obrigaria ao Real —
 * mas o catálogo setorial não distingue com segurança quais perfis
 * "financeiro" são efetivamente uma das instituições listadas na lei
 * (bancos, financeiras reguladas etc.) de outras atividades adjacentes
 * (ex.: meios de pagamento/adquirência, que podem não se enquadrar).
 * Nunca assumimos a obrigatoriedade por aproximação de arquétipo —
 * fica indeterminado, exigindo confirmação.
 */
function avaliarObrigatoriedadePorAtividade(cenario: CenarioEmpresa): CriterioElegibilidade {
  const flagExplicita = cenario.tributario.tratamentosEspeciais?.includes("atividade_obrigatoria_lucro_real");
  if (flagExplicita) {
    return {
      id: "obrigatoriedade_por_atividade",
      descricao: "Atividade financeira/outras hipóteses do art. 14 da Lei 9.718/1998",
      atendido: true,
      fonte: { valor: "cenário sinaliza explicitamente hipótese de obrigatoriedade por atividade", origem: "informado_usuario", status: "confirmado" },
    };
  }
  const perfil = cenario.identificacao.atividadePrincipal?.perfilId ? buscarPerfil(cenario.identificacao.atividadePrincipal.perfilId) : undefined;
  const exigeConfirmacao = perfil?.arquetipos.some((a) => ARQUETIPOS_QUE_EXIGEM_CONFIRMACAO.has(a)) ?? false;
  if (exigeConfirmacao) {
    return {
      id: "obrigatoriedade_por_atividade",
      descricao: "Atividade financeira/outras hipóteses do art. 14 da Lei 9.718/1998",
      atendido: "indeterminado",
      fonte: { valor: `perfil "${perfil?.segmento}" tem arquétipo financeiro — obrigatoriedade por atividade não pode ser descartada nem confirmada sem revisão específica`, origem: "classificacao_vgr", status: "estimado" },
    };
  }
  return {
    id: "obrigatoriedade_por_atividade",
    descricao: "Atividade financeira/outras hipóteses do art. 14 da Lei 9.718/1998",
    atendido: false,
    fonte: { valor: "nenhuma hipótese de obrigatoriedade por atividade identificada no cenário", origem: "classificacao_vgr", status: "estimado" },
  };
}

export function avaliarElegibilidadeReal(cenario: CenarioEmpresa): AvaliacaoElegibilidade {
  const criterios = [avaliarObrigatoriedadePorReceita(cenario), avaliarObrigatoriedadePorAtividade(cenario)];

  if (criterios.some((c) => c.atendido === true)) {
    return { regime: "lucro_real", status: "obrigatorio", motivo: "Hipótese de obrigatoriedade identificada (Lei 9.718/1998, art. 14) — ver critérios.", criterios };
  }
  if (criterios.some((c) => c.atendido === "indeterminado")) {
    return { regime: "lucro_real", status: "indeterminado", motivo: "Informação necessária para confirmar se há obrigatoriedade não está disponível — ver critérios.", criterios };
  }
  return { regime: "lucro_real", status: "opcional", motivo: "Nenhuma hipótese de obrigatoriedade identificada — o Lucro Real continua disponível como opção (é sempre uma opção, para qualquer empresa).", criterios };
}
