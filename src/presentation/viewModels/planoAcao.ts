/**
 * ViewModel do Plano de Ação — "Próximas Providências" (seção 13 do
 * pedido). Preserva as `EtapaPlano` já ordenadas pelo motor
 * (validação → simulação → formalização), nunca reordena por conta
 * própria. Ação bloqueada mostra o motivo, nunca escondido.
 */

import type { PlanoAcaoEstruturado } from "../../engine/planoAcao/tipos";

export interface AcaoPlanoViewModel {
  id: string;
  titulo: string;
  objetivo: string;
  tipo: string;
  bloqueada: boolean;
  motivoBloqueio?: string;
  condicoes: string[];
}

export interface EtapaPlanoViewModel {
  numero: number;
  titulo: string;
  acoes: AcaoPlanoViewModel[];
}

const TITULO_POR_NUMERO_RELATIVO = ["Validações", "Consolidação", "Formalização"];

export function construirPlanoAcaoViewModel(plano: PlanoAcaoEstruturado): { etapas: EtapaPlanoViewModel[]; statusPlano: string } {
  const porId = new Map(plano.acoes.map((a) => [a.id, a]));

  const etapas: EtapaPlanoViewModel[] = plano.etapas.map((etapa, indice) => ({
    numero: etapa.numero,
    titulo: `Etapa ${etapa.numero}${TITULO_POR_NUMERO_RELATIVO[indice] ? ` — ${TITULO_POR_NUMERO_RELATIVO[indice]}` : ""}`,
    acoes: etapa.acoes.map((id) => {
      const acao = porId.get(id)!;
      return {
        id: acao.id,
        titulo: acao.titulo,
        objetivo: acao.objetivo,
        tipo: acao.tipo,
        bloqueada: acao.bloqueios.length > 0,
        motivoBloqueio: acao.bloqueios.length > 0 ? acao.bloqueios.map((b) => b.descricao).join(" ") : undefined,
        condicoes: acao.condicoes,
      };
    }),
  }));

  return { etapas, statusPlano: plano.status };
}
