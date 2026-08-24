import { parseNfeXml, type ResultadoParseNfe } from "./nfe";
import { avaliarCompletudeDupla, type OperacaoTributariaNormalizada } from "../operacaoTributaria";

export interface ErroDocumento {
  nomeArquivo: string;
  motivo: "erro_parse" | "tipo_nao_suportado";
  detalhe: string;
}

export interface RelatorioLoteXml {
  documentosProcessados: number;
  documentosComErro: ErroDocumento[];
  duplicadosIgnorados: number;
  operacoes: OperacaoTributariaNormalizada[];
}

/**
 * Processa um lote de XMLs (individuais e/ou expandidos de .zip via
 * xml/zip.ts) — um documento inválido NUNCA aborta o lote inteiro (seção 24
 * do pedido): erros são coletados por arquivo e o processamento continua.
 * Deduplicação por ID estável (chave + item): a mesma NF-e/item importado
 * mais de uma vez conta uma única vez no resultado.
 *
 * Não chama o Motor Oficial, não altera nenhum fluxo produtivo — só produz
 * OperacaoTributariaNormalizada[] para avaliação de completude/cobertura.
 */
export function processarLoteXml(arquivos: { nomeArquivo: string; conteudo: string }[]): RelatorioLoteXml {
  const erros: ErroDocumento[] = [];
  const operacoesPorId = new Map<string, OperacaoTributariaNormalizada>();
  let duplicadosIgnorados = 0;
  let documentosProcessados = 0;

  for (const arquivo of arquivos) {
    let resultado: ResultadoParseNfe;
    try {
      resultado = parseNfeXml(arquivo.nomeArquivo, arquivo.conteudo);
    } catch (e) {
      erros.push({ nomeArquivo: arquivo.nomeArquivo, motivo: "erro_parse", detalhe: e instanceof Error ? e.message : "erro inesperado" });
      continue;
    }
    if (!resultado.ok) {
      erros.push({ nomeArquivo: resultado.nomeArquivo, motivo: resultado.motivo, detalhe: resultado.detalhe });
      continue;
    }
    documentosProcessados++;
    for (const op of resultado.operacoes) {
      if (operacoesPorId.has(op.id)) {
        duplicadosIgnorados++;
        continue;
      }
      operacoesPorId.set(op.id, op);
    }
  }

  return {
    documentosProcessados,
    documentosComErro: erros,
    duplicadosIgnorados,
    operacoes: [...operacoesPorId.values()],
  };
}

const CAMPOS_NORMATIVOS = ["municipio", "uf", "ncm", "cst", "cClassTrib", "quantidade", "unidade", "valorOperacao"] as const;

export interface RelatorioCobertura {
  totalOperacoes: number;
  presencaPorCampo: Record<string, { quantidade: number; percentual: number }>;
  elegiveisNormativa: number;
  percentualElegivelNormativa: number;
  completasGerencial: number;
  percentualCompletoGerencial: number;
  /** % de operações cujo motivo de inelegibilidade normativa inclui aquele campo — uma operação pode contar em mais de um campo (múltiplos gaps). */
  motivosInelegibilidade: Record<string, number>;
  /**
   * Elegibilidade ponderada por VALOR BRUTO MOVIMENTADO (vProd/valorOperacao
   * da NF-e) — 10 mil itens de R$ 50 não têm o mesmo peso estratégico que
   * 500 operações de R$ 100 mil (ver docs/validacao-corpus-real-xml.md).
   *
   * Nomeado deliberadamente "valor bruto movimentado", não "exposição
   * tributária": a validação com dados reais mostrou que valor bruto de NF-e
   * pode ser dominado por remessas/devoluções/depósitos que não representam
   * a mesma exposição tributária de uma venda — ver `exposicaoTributaria`
   * abaixo para a métrica que tenta medir a base efetivamente relevante, não
   * apenas o valor documental. Nunca tratar este número como "exposição
   * tributária" — são conceitos diferentes.
   */
  valorPonderado: {
    valorTotalConhecido: number;
    valorElegivelNormativa: number;
    percentualElegivelPorValor: number;
    /** Quantas operações não têm valorOperacao e portanto não entraram na ponderação — 0 no caminho normal (valor é campo exigido pela própria completude normativa), mas pode ocorrer em análises gerenciais mistas. */
    operacoesSemValorConhecido: number;
  };
  /**
   * Elegibilidade ponderada pela BASE TRIBUTÁRIA (`valores.baseCalculo`, lida
   * do grupo ICMS/IBSCBS do XML) quando o próprio documento a informa —
   * nunca o valor bruto da operação usado por conveniência. Quando a
   * operação não trouxe base determinável, ela conta em
   * `operacoesSemBaseDeterminada`, NUNCA é presumida a partir do valor
   * bruto — "não determinada" é o resultado correto nesse caso, não um
   * valor aproximado.
   */
  exposicaoTributaria: {
    baseTotalConhecida: number;
    baseElegivelNormativa: number;
    percentualElegivelPorBase: number;
    operacoesSemBaseDeterminada: number;
  };
  /**
   * Das operações INELEGÍVEIS, qual % tem como único motivo a ausência de
   * cClassTrib (ver pedido: "81% dessas deficiências decorrem exclusivamente
   * da ausência de cClassTrib") — decide se um classificador VGR resolveria
   * a maioria do gap sozinho ou se o problema é mais espalhado.
   */
  percentualInelegiveisSoPorCClassTrib: number;
}

/**
 * Métrica de elegibilidade em escala (seções 17/18 do pedido anterior) —
 * medida diretamente sobre as operações efetivamente extraídas, nunca
 * estimada. Inclui ponderação por valor financeiro (pedido desta fase).
 */
export function medirCobertura(operacoes: OperacaoTributariaNormalizada[]): RelatorioCobertura {
  const presenca: Record<string, number> = Object.fromEntries(CAMPOS_NORMATIVOS.map((c) => [c, 0]));
  const motivos: Record<string, number> = Object.fromEntries(CAMPOS_NORMATIVOS.map((c) => [c, 0]));
  let elegiveis = 0;
  let completasGerencial = 0;
  let valorTotalConhecido = 0;
  let valorElegivelNormativa = 0;
  let operacoesSemValorConhecido = 0;
  let baseTotalConhecida = 0;
  let baseElegivelNormativa = 0;
  let operacoesSemBaseDeterminada = 0;
  let inelegiveis = 0;
  let inelegiveisSoPorCClassTrib = 0;

  for (const op of operacoes) {
    const { gerencial, normativa } = avaliarCompletudeDupla(op);
    if (gerencial.completa) completasGerencial++;

    const valor = op.valores.valorOperacao?.valor;
    if (valor === undefined) operacoesSemValorConhecido++;

    // Base tributária: só lida de valores.baseCalculo (o que o próprio documento informou no
    // grupo ICMS/IBSCBS) — nunca aproximada pelo valor bruto quando ausente.
    const base = op.valores.baseCalculo?.valor;
    if (base === undefined) operacoesSemBaseDeterminada++;

    if (normativa.completudeEntrada === "completa") {
      elegiveis++;
      if (valor !== undefined) valorElegivelNormativa += valor;
      if (base !== undefined) baseElegivelNormativa += base;
    } else {
      inelegiveis++;
      if (normativa.camposFaltantes.length === 1 && normativa.camposFaltantes[0] === "cClassTrib") {
        inelegiveisSoPorCClassTrib++;
      }
    }
    if (valor !== undefined) valorTotalConhecido += valor;
    if (base !== undefined) baseTotalConhecida += base;

    for (const c of CAMPOS_NORMATIVOS) {
      if (!normativa.camposFaltantes.includes(c)) presenca[c]++;
      else motivos[c]++;
    }
  }

  const total = operacoes.length;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return {
    totalOperacoes: total,
    presencaPorCampo: Object.fromEntries(CAMPOS_NORMATIVOS.map((c) => [c, { quantidade: presenca[c], percentual: pct(presenca[c]) }])),
    elegiveisNormativa: elegiveis,
    percentualElegivelNormativa: pct(elegiveis),
    completasGerencial,
    percentualCompletoGerencial: pct(completasGerencial),
    motivosInelegibilidade: Object.fromEntries(CAMPOS_NORMATIVOS.map((c) => [c, pct(motivos[c])])),
    valorPonderado: {
      valorTotalConhecido,
      valorElegivelNormativa,
      percentualElegivelPorValor: valorTotalConhecido > 0 ? (valorElegivelNormativa / valorTotalConhecido) * 100 : 0,
      operacoesSemValorConhecido,
    },
    exposicaoTributaria: {
      baseTotalConhecida,
      baseElegivelNormativa,
      percentualElegivelPorBase: baseTotalConhecida > 0 ? (baseElegivelNormativa / baseTotalConhecida) * 100 : 0,
      operacoesSemBaseDeterminada,
    },
    percentualInelegiveisSoPorCClassTrib: inelegiveis > 0 ? (inelegiveisSoPorCClassTrib / inelegiveis) * 100 : 0,
  };
}
