/**
 * Classificação tributária da receita — camada intermediária OBRIGATÓRIA
 * entre PerfilSetorial e a regra de presunção (seção 6 do pedido).
 * `PerfilSetorial` nunca contém percentual de presunção (isso violaria a
 * decisão já registrada em docs/cenario-empresa-setores.md); este módulo
 * é quem faz essa ponte, e só ele.
 *
 * Fluxo: Perfil/atividade → NaturezaTributariaReceita → PERCENTUAIS_PRESUNCAO
 * (normativa.ts) → base de IRPJ/CSLL.
 */

import type { PerfilSetorial } from "../../setores/tipos";

export type NaturezaTributariaReceita = "comercio_industria_transporte_cargas" | "transporte_passageiros" | "prestacao_servicos_geral" | "indeterminada";

/**
 * Infere a natureza tributária a partir do perfil — nunca do nome do
 * segmento diretamente (ex.: não é "clinica_medica → 32%", é
 * "clinica_medica tem arquétipo 'servico' → prestacao_servicos_geral →
 * 32%", com a tabela de percentuais vivendo só em normativa.ts).
 *
 * Retorna "indeterminada" (nunca um palpite) quando o perfil não permite
 * concluir com segurança — arquétipos como "agro", "construcao",
 * "locacao", "financeiro" e "misto" ainda não têm regra de presunção
 * modelada nesta fase (seções 24/25 do pedido: regimes especiais ficam de
 * fora deliberadamente).
 */
export function inferirNaturezaTributaria(perfil: PerfilSetorial): NaturezaTributariaReceita {
  // Casos que exigem distinguir dentro do próprio arquétipo "transporte" (cargas × passageiros
  // têm percentuais de IRPJ diferentes — 8% × 16%) — resolvidos pelo id específico do perfil,
  // não pelo arquétipo genérico.
  if (perfil.id === "transporte_rodoviario_cargas") return "comercio_industria_transporte_cargas";
  if (perfil.id === "transporte_passageiros") return "transporte_passageiros";

  // "financeiro" tem precedência sobre qualquer outro arquétipo coexistente (ex.: meios de
  // pagamento é "financeiro" + "digital") — instituições/atividades financeiras têm regras de
  // presunção e alíquota de CSLL PRÓPRIAS (não modeladas nesta fase), nunca aproximadas pela
  // presunção genérica de serviço só porque o outro arquétipo bateria nesse bucket.
  if (perfil.arquetipos.includes("financeiro")) return "indeterminada";

  if (perfil.arquetipos.includes("comercio") || perfil.arquetipos.includes("industria")) {
    return "comercio_industria_transporte_cargas";
  }
  if (perfil.arquetipos.includes("servico") || perfil.arquetipos.includes("digital")) {
    return "prestacao_servicos_geral";
  }
  // agro, construcao, locacao, transporte (sem id específico), misto: sem regra de presunção
  // segura modelada nesta fase — nunca aproximado por um dos buckets acima.
  return "indeterminada";
}
