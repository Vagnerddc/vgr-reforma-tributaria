/**
 * Consolidação determinística (seção 73) — sem IA, sem percentual
 * arbitrário de "prontidão" (seção 41). Mesma entrada sempre produz o
 * mesmo relatório (seção 84).
 */
import type { AreaValidacaoPiloto, AvaliacaoCasoPiloto, CasoPiloto, RelatorioPilotoControlado, StatusProntidaoPiloto } from "./tipos";

export const AREAS_ESSENCIAIS_PADRAO: AreaValidacaoPiloto[] = ["multiatividade", "fs12", "creditos", "split", "lucro_real"];

export interface OpcoesConsolidacao {
  areasEssenciais?: AreaValidacaoPiloto[];
}

function areaValidadaComSucesso(area: AreaValidacaoPiloto, casos: CasoPiloto[], avaliacoes: AvaliacaoCasoPiloto[]): boolean {
  const casosDaArea = casos.filter((c) => c.areasValidadas.includes(area));
  if (casosDaArea.length === 0) return false;
  return casosDaArea.some((caso) => {
    const avaliacao = avaliacoes.find((a) => a.casoId === caso.id);
    return avaliacao && (avaliacao.statusFinal === "aprovado" || avaliacao.statusFinal === "aprovado_com_ressalvas");
  });
}

export function consolidarPiloto(casos: CasoPiloto[], avaliacoes: AvaliacaoCasoPiloto[], opcoes: OpcoesConsolidacao = {}): RelatorioPilotoControlado {
  const areasEssenciais = opcoes.areasEssenciais ?? AREAS_ESSENCIAIS_PADRAO;

  const casosAprovados = avaliacoes.filter((a) => a.statusFinal === "aprovado").length;
  const casosComRessalvas = avaliacoes.filter((a) => a.statusFinal === "aprovado_com_ressalvas").length;
  const casosRequerAjuste = avaliacoes.filter((a) => a.statusFinal === "requer_ajuste").length;
  const casosBloqueados = avaliacoes.filter((a) => a.statusFinal === "bloqueado").length;

  const divergenciasMateriais = avaliacoes.flatMap((a) => a.divergencias.filter((d) => d.classificacao === "divergencia_material"));
  const ganhosCoberturaV2 = Array.from(new Set(avaliacoes.flatMap((a) => a.ganhosV2)));

  const contagemProblemas = new Map<string, number>();
  const contagemLimitacoes = new Map<string, number>();
  for (const avaliacao of avaliacoes) {
    for (const problema of avaliacao.problemas) {
      contagemProblemas.set(problema.descricao, (contagemProblemas.get(problema.descricao) ?? 0) + 1);
    }
  }
  for (const caso of casos) {
    for (const pendencia of caso.pendencias) {
      contagemLimitacoes.set(pendencia, (contagemLimitacoes.get(pendencia) ?? 0) + 1);
    }
  }
  const problemasRecorrentes = Array.from(contagemProblemas.entries())
    .filter(([, contagem]) => contagem > 1)
    .map(([descricao]) => descricao);
  const limitacoesRecorrentes = Array.from(contagemLimitacoes.entries())
    .filter(([, contagem]) => contagem > 1)
    .map(([descricao]) => descricao);

  const areasValidadasComSucesso = areasEssenciais.filter((area) => areaValidadaComSucesso(area, casos, avaliacoes));
  const areasFaltantes = areasEssenciais.filter((area) => !areasValidadasComSucesso.includes(area));

  const { status, justificativa } = calcularStatusProntidaoPiloto({
    totalCasos: casos.length,
    casosBloqueados,
    casosRequerAjuste,
    divergenciasMateriaisCount: divergenciasMateriais.length,
    areasFaltantes,
  });

  return {
    casos,
    totalCasos: casos.length,
    casosAprovados,
    casosComRessalvas,
    casosBloqueados,
    casosRequerAjuste,
    divergenciasMateriais,
    ganhosCoberturaV2,
    problemasRecorrentes,
    limitacoesRecorrentes,
    areasValidadas: areasValidadasComSucesso,
    areasFaltantes,
    statusProntidao: status,
    justificativaStatus: justificativa,
  };
}

function calcularStatusProntidaoPiloto(entrada: {
  totalCasos: number;
  casosBloqueados: number;
  casosRequerAjuste: number;
  divergenciasMateriaisCount: number;
  areasFaltantes: AreaValidacaoPiloto[];
}): { status: StatusProntidaoPiloto; justificativa: string } {
  if (entrada.totalCasos === 0) {
    return { status: "piloto_em_andamento", justificativa: "Nenhum caso registrado ainda." };
  }
  if (entrada.casosBloqueados > 0) {
    return { status: "piloto_com_pendencias", justificativa: `${entrada.casosBloqueados} caso(s) bloqueado(s) por problema crítico.` };
  }
  if (entrada.divergenciasMateriaisCount > 0) {
    return { status: "piloto_com_pendencias", justificativa: `${entrada.divergenciasMateriaisCount} divergência(s) material(is) não explicada(s) por cobertura.` };
  }
  if (entrada.casosRequerAjuste > 0) {
    return { status: "piloto_com_pendencias", justificativa: `${entrada.casosRequerAjuste} caso(s) requerem ajuste antes de prosseguir.` };
  }
  if (entrada.areasFaltantes.length > 0) {
    return { status: "piloto_com_pendencias", justificativa: `Área(s) essencial(is) ainda não validada(s) com sucesso: ${entrada.areasFaltantes.join(", ")}.` };
  }
  return { status: "pronto_para_avaliar_migracao_controlada", justificativa: "Todos os casos executados sem divergência material, todas as áreas essenciais validadas, nenhum caso bloqueado ou pendente de ajuste." };
}
