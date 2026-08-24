import type { MemoriaTecnicaAnalise, ItemMemoriaTecnica } from "../../application/memoriaTecnica/tipos";
import { formatarPercentualPt } from "../../design-system";
import { formatarReaisCompacto, formatarPontosPercentuais } from "../formatters";

export interface DetalheItemMemoriaTecnicaViewModel {
  origemInformacao: string;
  origemCalculo: string;
  motor: string;
  metodologia?: string;
  premissas: string[];
  evidencias: string[];
  fundamentos: string[];
  limitacoes: string[];
  dependencias: string[];
}

export interface ItemMemoriaTecnicaViewModel {
  id: string;
  categoria: string;
  titulo: string;
  resumo: string;
  valorFormatado?: string;
  qualidade: string;
  status: string;
  detalhe: DetalheItemMemoriaTecnicaViewModel;
}

export interface LinkRapidoMemoriaTecnica {
  rotulo: string;
  itemId: string;
}

export interface MemoriaTecnicaViewModel {
  totalItens: number;
  totalPremissas: number;
  totalMetodologias: number;
  totalLimitacoes: number;
  resumoCobertura: Record<string, string>;
  categorias: string[];
  itens: ItemMemoriaTecnicaViewModel[];
  limitacoes: string[];
  linksRapidos: LinkRapidoMemoriaTecnica[];
}

function formatarValor(item: ItemMemoriaTecnica): string | undefined {
  if (item.valor === undefined) return undefined;
  switch (item.unidade) {
    case "reais":
      return formatarReaisCompacto(item.valor);
    case "percentual":
      return formatarPercentualPt(item.valor * 100);
    case "pontos_percentuais":
      return formatarPontosPercentuais(item.valor);
    default:
      return String(item.valor);
  }
}

function encontrarLinkRapido(rotulo: string, itens: ItemMemoriaTecnica[], corresponde: (item: ItemMemoriaTecnica) => boolean): LinkRapidoMemoriaTecnica | undefined {
  const item = itens.find(corresponde);
  return item ? { rotulo, itemId: item.id } : undefined;
}

function construirLinksRapidos(itens: ItemMemoriaTecnica[]): LinkRapidoMemoriaTecnica[] {
  const links = [
    encontrarLinkRapido("Carga", itens, (i) => i.id.startsWith("fiscal:") && i.id.endsWith(":carga_total")),
    encontrarLinkRapido("Margem", itens, (i) => i.id.startsWith("financeiro:") && i.id.endsWith(":margem")),
    encontrarLinkRapido("Caixa", itens, (i) => i.id.startsWith("caixa:") && i.id.endsWith(":reducao_disponibilidade")),
    encontrarLinkRapido("Decisão", itens, (i) => i.id.startsWith("decisao:")),
    encontrarLinkRapido("Score", itens, (i) => /^score:[^:]+:\d+$/.test(i.id)),
  ];
  return links.filter((l): l is LinkRapidoMemoriaTecnica => Boolean(l));
}

export function construirMemoriaTecnicaViewModel(memoria: MemoriaTecnicaAnalise): MemoriaTecnicaViewModel {
  const itens: ItemMemoriaTecnicaViewModel[] = memoria.itens.map((item) => ({
    id: item.id,
    categoria: item.categoria,
    titulo: item.titulo,
    resumo: item.descricao,
    valorFormatado: formatarValor(item),
    qualidade: item.qualidade,
    status: item.status,
    detalhe: {
      origemInformacao: item.origemInformacao,
      origemCalculo: item.origemCalculo,
      motor: item.motor,
      metodologia: item.metodologia ? `${item.metodologia} ${item.metodologiaVersao ?? ""}`.trim() : undefined,
      premissas: item.premissas,
      evidencias: item.evidencias,
      fundamentos: item.fundamentos,
      limitacoes: item.limitacoes,
      dependencias: item.dependencias,
    },
  }));

  return {
    totalItens: memoria.itens.length,
    totalPremissas: memoria.premissas.length,
    totalMetodologias: memoria.metodologias.length,
    totalLimitacoes: memoria.limitacoes.length,
    resumoCobertura: memoria.resumoCobertura,
    categorias: Array.from(new Set(itens.map((i) => i.categoria))),
    itens,
    limitacoes: memoria.limitacoes,
    linksRapidos: construirLinksRapidos(memoria.itens),
  };
}

export function buscarItemPorId(memoria: MemoriaTecnicaAnalise, id: string): ItemMemoriaTecnica | undefined {
  return memoria.itens.find((item) => item.id === id);
}
