/**
 * Conflitos adicionais que não nascem só da alternativa de regime —
 * MARGEM_VS_CAIXA (seção 60/61), a partir do achado cruzado já
 * produzido pelo Motor de Achados (`divergencias.ts`).
 */

import { achadosPorCodigo, type ContextoEstrategico } from "./contexto";
import type { ConflitoEstrategico } from "./tipos";

export function gerarConflitosAdicionais(ctx: ContextoEstrategico, idsAlternativasRelacionadas: string[]): ConflitoEstrategico[] {
  const margemVsCaixa = achadosPorCodigo(ctx, "MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA")[0];
  if (!margemVsCaixa) return [];
  return [{ codigo: "MARGEM_VS_CAIXA", descricao: margemVsCaixa.descricaoTecnica, alternativasEnvolvidas: idsAlternativasRelacionadas, evidencias: margemVsCaixa.evidencias }];
}
