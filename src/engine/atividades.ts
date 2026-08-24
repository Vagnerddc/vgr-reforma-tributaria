import atividadesJson from "../../config/atividades.json";
import type { CategoriaGasto, NaturezaEconomica, TratamentoTributarioCategoria } from "./creditoTributario";

export type PerfilAtividade =
  | "aviacao_agricola"
  | "produtor_rural"
  | "transporte_rodoviario_cargas"
  | "construcao_civil";

/** Fonte única dos rótulos exibidos na UI — evita duplicar essa lista em cada tela ao adicionar um novo setor. */
export const LABEL_PERFIL: Record<PerfilAtividade, string> = {
  aviacao_agricola: "Aviação agrícola",
  produtor_rural: "Produtor rural",
  transporte_rodoviario_cargas: "Transporte rodoviário de cargas",
  construcao_civil: "Construção civil",
};

/**
 * Quando a empresa não se encaixa em nenhum dos 4 setores específicos acima
 * (que já têm categoria própria revisada), o simulador classifica pela
 * natureza econômica genérica da operação — ver categoriasGenericasPorNatureza.
 */
export type NaturezaOperacaoGenerica = "servico" | "industria" | "comercio" | "outras";

export const LABEL_NATUREZA_OPERACAO: Record<NaturezaOperacaoGenerica, string> = {
  servico: "Prestação de serviços",
  industria: "Indústria",
  comercio: "Comércio / revenda",
  outras: "Outras atividades",
};

interface CategoriaGastoJson {
  chave: string;
  label: string;
  naturezaEconomica: NaturezaEconomica;
  reducaoAliquota?: boolean;
  /** Nota sobre o tratamento herdado — vira observacao da TratamentoTributarioCategoria. */
  observacaoTratamento?: string;
}

interface AtividadesConfig {
  mapeamentoCnaeParaPerfil: {
    cnae?: string;
    cnaePrefixo?: string;
    descricaoCnae: string;
    perfil: PerfilAtividade;
    observacao?: string;
  }[];
  categoriasDespesaPorPerfil: Record<PerfilAtividade, CategoriaGastoJson[]>;
  categoriasGenericasPorNatureza: Record<NaturezaOperacaoGenerica, CategoriaGastoJson[]>;
  taxaCrescimentoDefaultPorPerfil: Record<string, number>;
}

const atividades = atividadesJson as unknown as AtividadesConfig;

/**
 * CNAE fiscal tem 7 dígitos (XXXX-X/XX). Quando vem como number (ex.: campo
 * `cnae_fiscal` da BrasilAPI), o JSON descarta zeros à esquerda — por isso o
 * padStart aqui é obrigatório, não cosmético: sem ele, CNAEs começando com 0
 * (toda a divisão 01 de produtor rural, e 0161-0/03 de aviação agrícola)
 * deixam de bater no mapeamento.
 */
function normalizarCnae(cnae: string | number): string {
  const digitos = String(cnae).replace(/[^\d]/g, "");
  return digitos.padStart(7, "0");
}

/** Identifica o perfil de atividade coberto pelo simulador a partir do CNAE principal. */
export function identificarPerfilPorCnae(cnae: string | number): PerfilAtividade | null {
  const digitos = normalizarCnae(cnae);
  for (const item of atividades.mapeamentoCnaeParaPerfil) {
    if (item.cnae && normalizarCnae(item.cnae) === digitos) return item.perfil;
  }
  for (const item of atividades.mapeamentoCnaeParaPerfil) {
    if (item.cnaePrefixo && digitos.startsWith(item.cnaePrefixo)) return item.perfil;
  }
  return null;
}

/**
 * Hidrata uma categoria "herdada" (um dos 4 setores específicos, que já
 * existiam antes da separação natureza/tratamento/status) — preserva o
 * comportamento numérico de sempre: creditável nos 3 sistemas, status
 * "herdado" (ainda não passou por revisão tributária individual).
 */
function hidratarCategoriaLegado(json: CategoriaGastoJson): CategoriaGasto {
  const tratamento: TratamentoTributarioCategoria = { tratamento: "creditavel", status: "herdado", observacao: json.observacaoTratamento };
  return {
    chave: json.chave,
    label: json.label,
    naturezaEconomica: json.naturezaEconomica,
    reducaoAliquota: json.reducaoAliquota,
    creditoPisCofins: { ...tratamento },
    creditoIcmsIpi: { ...tratamento },
    creditoIbsCbs: { ...tratamento },
  };
}

/**
 * Hidrata uma categoria GENÉRICA (serviço/indústria/comércio/outras) — não
 * tem número histórico a preservar, então usa o default tributariamente mais
 * defensável por natureza, em vez de "creditável" por padrão:
 *  - folha_e_encargos: nunca creditável (LC 214/2025 não sujeita ao IBS/CBS
 *    serviço de pessoa física em relação de emprego) — fato estrutural, não
 *    estimativa. NÃO se estende a beneficios_pessoal (ver abaixo) — são
 *    dimensões separadas por design; um não herda o tratamento do outro.
 *  - beneficios_pessoal (vale-transporte, vale-refeição/alimentação, plano de
 *    saúde etc.): indeterminado nos três sistemas, sem premissa — a PGFN já
 *    reconheceu hipóteses de crédito de CBS para alguns desses benefícios,
 *    observadas condições legais, mas isso depende de cada caso; não
 *    presumimos crédito nem sua ausência.
 *  - despesa_administrativa: indeterminado, sem premissa — 0% de crédito até
 *    ser detalhada (conservador, nunca otimista por omissão).
 *  - custo_direto / custo_operacional: creditável, mas como estimativa (ainda
 *    não é uma categoria setor-específica revisada como as 4 verticais).
 */
function hidratarCategoriaGenerica(json: CategoriaGastoJson): CategoriaGasto {
  const tratamento: TratamentoTributarioCategoria =
    json.naturezaEconomica === "folha_e_encargos"
      ? { tratamento: "nao_creditavel", status: "confirmado", observacao: "Folha e encargos não são sujeitos a IBS/CBS (LC 214/2025) — não gera crédito." }
      : json.naturezaEconomica === "beneficios_pessoal"
        ? {
            tratamento: "indeterminado",
            status: "estimado",
            observacao:
              "A PGFN já reconheceu hipóteses de crédito de CBS para alguns benefícios (ex.: plano de saúde, vale-transporte/refeição/alimentação), observadas as condições legais — tratamento depende do caso, não herda a classificação da folha. Tratado como 0% de crédito até confirmação.",
          }
        : json.naturezaEconomica === "despesa_administrativa"
          ? { tratamento: "indeterminado", status: "estimado", observacao: "Composição não detalhada — tratado como 0% de crédito até detalhamento por categoria." }
          : { tratamento: "creditavel", status: "estimado", observacao: json.observacaoTratamento };
  return {
    chave: json.chave,
    label: json.label,
    naturezaEconomica: json.naturezaEconomica,
    reducaoAliquota: json.reducaoAliquota,
    creditoPisCofins: { ...tratamento },
    creditoIcmsIpi: { ...tratamento },
    creditoIbsCbs: { ...tratamento },
  };
}

export function categoriasDespesaDoPerfil(perfil: PerfilAtividade): CategoriaGasto[] {
  return (atividades.categoriasDespesaPorPerfil[perfil] ?? []).map(hidratarCategoriaLegado);
}

/** Categorias genéricas por natureza da operação — usadas quando a empresa não é um dos 4 setores específicos. */
export function categoriasGenericasDaNatureza(natureza: NaturezaOperacaoGenerica): CategoriaGasto[] {
  return (atividades.categoriasGenericasPorNatureza[natureza] ?? []).map(hidratarCategoriaGenerica);
}

/** Taxa de crescimento anual padrão do segmento, para pré-preencher o campo de projeção 2027 — sempre editável pelo contador. */
export function taxaCrescimentoDefault(perfil: PerfilAtividade): number {
  return atividades.taxaCrescimentoDefaultPorPerfil[perfil] ?? 0.05;
}

/**
 * Soma as despesas informadas (em R$) e retorna o % do faturamento
 * correspondente — mantida por compatibilidade com o simulador público
 * atual (Publico.tsx), que ainda não migrou para o agregador por sistema
 * tributário (ver engine/creditoTributario.ts). Continua somando tudo sem
 * filtrar por tratamento, exatamente como antes.
 */
export function percentualCustosCreditaveisDeDespesas(
  despesas: Record<string, number>,
  faturamentoAnual: number
): number {
  if (faturamentoAnual <= 0) return 0;
  const total = Object.values(despesas).reduce((soma, v) => soma + (v || 0), 0);
  return Math.min(1, total / faturamentoAnual);
}
