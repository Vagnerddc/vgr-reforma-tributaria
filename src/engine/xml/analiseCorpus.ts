import { processarLoteXml, medirCobertura, type RelatorioCobertura, type ErroDocumento } from "./lote";
import type { OperacaoTributariaNormalizada } from "../operacaoTributaria";

/**
 * Modo de análise de corpus real de XMLs — reutiliza integralmente
 * engine/xml/lote.ts (mesmo parser, mesma dedup, mesmo isolamento de erro).
 * Não altera calculo.ts, Motor VGR, Dashboard, Simulador ou pipeline SPED;
 * o Motor Oficial continua fora do fluxo produtivo. Produz SOMENTE métricas
 * agregadas — nunca CNPJ, razão social, valores ou conteúdo de XML.
 *
 * O rótulo de cada lote ("Cliente A — jul/2026") é fornecido por quem chama
 * esta função, não derivado automaticamente do CNPJ do XML — o relatório
 * nunca extrai ou expõe identificação do cliente a partir do documento.
 */

export interface LoteRotulado {
  /** Identificador definido por quem roda a análise (ex.: "Cliente A — jul/2026") — nunca o CNPJ do XML. */
  rotulo: string;
  arquivos: { nomeArquivo: string; conteudo: string }[];
}

/**
 * Critério objetivo de padrão, derivado só do que já existe na operação:
 * uma operação é "rtc" quando o XML trouxe cClassTrib (só existe em
 * documentos emitidos no padrão da Reforma); "legado" quando não. Não
 * inferido por NCM/CFOP/CST/descrição — critério estrutural, não heurística.
 */
export function classificarPadrao(op: OperacaoTributariaNormalizada): "rtc" | "legado" {
  return op.classificacaoTributaria.cClassTrib ? "rtc" : "legado";
}

export interface MotivoRanking {
  campo: string;
  percentual: number;
}

export interface RelatorioLote {
  rotulo: string;
  documentosProcessados: number;
  documentosComErro: number;
  itensEncontrados: number;
  operacoesNormalizadas: number;
  percentualRtc: number;
  cobertura: RelatorioCobertura;
  rankingMotivosInelegibilidade: MotivoRanking[];
}

export interface RelatorioConsolidado {
  porLote: RelatorioLote[];
  consolidado: {
    documentosProcessados: number;
    operacoesNormalizadas: number;
    percentualRtc: number;
    percentualElegivelNormativa: number;
    /** Elegibilidade ponderada por valor financeiro — ver RelatorioCobertura.valorPonderado. */
    percentualElegivelPorValor: number;
    percentualInelegiveisSoPorCClassTrib: number;
    rankingMotivosInelegibilidade: MotivoRanking[];
  };
  recomendacao: {
    /** Sugestão orientativa, não uma decisão automática de produto — ver justificativa e ressalvas. */
    cenarioSugerido: "A" | "B" | "C";
    titulo: string;
    justificativa: string;
    /** Sinais que a leitura pura do percentual por item não capturaria — para quem decide considerar antes de fechar o cenário. */
    ressalvas: string[];
  };
  /** Nomes de arquivo + motivo dos documentos que falharam, sem o conteúdo do XML. */
  erros: ErroDocumento[];
}

/**
 * O relatório consolidado é para compartilhamento interno sem dado fiscal
 * sensível (seção 9 do pedido) — a mensagem de erro do parser (lote.ts)
 * pode incluir um trecho do XML malformado (útil para depuração técnica,
 * não para o relatório). Aqui ela é substituída por um motivo genérico,
 * mantendo só nome de arquivo + categoria do erro.
 */
export function sanitizarErro(erro: ErroDocumento): ErroDocumento {
  const mensagemGenerica = erro.motivo === "erro_parse" ? "XML malformado ou ilegível — não foi possível interpretar o documento." : "Modelo de documento não suportado nesta fase.";
  return { nomeArquivo: erro.nomeArquivo, motivo: erro.motivo, detalhe: mensagemGenerica };
}

export function ranking(cobertura: RelatorioCobertura): MotivoRanking[] {
  return Object.entries(cobertura.motivosInelegibilidade)
    .map(([campo, percentual]) => ({ campo, percentual }))
    .filter((m) => m.percentual > 0)
    .sort((a, b) => b.percentual - a.percentual);
}

/**
 * Sugestão ORIENTATIVA, não uma regra rígida de produto (decisão explícita:
 * os limiares abaixo entram como um dos sinais, não como veredito automático
 * — quem decide deve olhar também as ressalvas, especialmente a elegibilidade
 * por valor e a concentração do gap em cClassTrib).
 */
function recomendar(percentualRtcItens: number, cobertura: RelatorioCobertura): RelatorioConsolidado["recomendacao"] {
  const percentualValor = cobertura.valorPonderado.percentualElegivelPorValor;
  const divergenciaItemValor = Math.abs(percentualValor - cobertura.percentualElegivelNormativa);
  const ressalvas: string[] = [];

  if (cobertura.valorPonderado.operacoesSemValorConhecido > 0) {
    ressalvas.push(`${cobertura.valorPonderado.operacoesSemValorConhecido} operação(ões) sem valor conhecido não entraram na ponderação por valor — o percentual por valor cobre só o que tem dado suficiente para isso.`);
  }
  if (divergenciaItemValor >= 10) {
    ressalvas.push(
      percentualValor > cobertura.percentualElegivelNormativa
        ? `Elegibilidade por valor (${percentualValor.toFixed(1)}%) é bem maior que por item (${cobertura.percentualElegivelNormativa.toFixed(1)}%) — as operações inelegíveis parecem concentradas em itens de baixo valor; pode ser um cenário melhor do que a contagem por item sugere.`
        : `Elegibilidade por valor (${percentualValor.toFixed(1)}%) é bem menor que por item (${cobertura.percentualElegivelNormativa.toFixed(1)}%) — as operações inelegíveis parecem concentradas em itens de alto valor; pode ser um cenário PIOR do que a contagem por item sugere, mesmo com % de itens alto.`
    );
  }
  if (cobertura.percentualInelegiveisSoPorCClassTrib >= 70) {
    ressalvas.push(`${cobertura.percentualInelegiveisSoPorCClassTrib.toFixed(1)}% das operações inelegíveis têm cClassTrib como ÚNICO motivo — um classificador VGR resolveria a maior parte do gap de uma vez.`);
  } else if (cobertura.percentualInelegiveisSoPorCClassTrib < 40 && cobertura.percentualElegivelNormativa < 100) {
    ressalvas.push(`Só ${cobertura.percentualInelegiveisSoPorCClassTrib.toFixed(1)}% das operações inelegíveis têm cClassTrib como único motivo — o gap está espalhado por mais de um campo; um classificador de cClassTrib sozinho não resolveria a maioria dos casos.`);
  }

  // Limiares de referência (não escondidos, mas também não a decisão final — ver ressalvas
  // acima): >=80% de adoção RTC por item já orienta para integração direta; <20% ainda não
  // justifica um classificador; a faixa intermediária é onde o híbrido por operação paga.
  if (percentualRtcItens >= 80) {
    return {
      cenarioSugerido: "A",
      titulo: "Avançar diretamente para integração com Motor Oficial",
      justificativa: `${percentualRtcItens.toFixed(1)}% das operações já vêm no padrão RTC (${percentualValor.toFixed(1)}% do valor financeiro) — a maioria dos casos reais já tem o dado necessário.`,
      ressalvas,
    };
  }
  if (percentualRtcItens >= 20) {
    return {
      cenarioSugerido: "B",
      titulo: "Arquitetura híbrida por operação",
      justificativa: `${percentualRtcItens.toFixed(1)}% das operações estão no padrão RTC (${percentualValor.toFixed(1)}% do valor financeiro) — parte relevante já pode ir ao Motor Oficial, parte ainda depende do Motor VGR/estimativa.`,
      ressalvas,
    };
  }
  return {
    cenarioSugerido: "C",
    titulo: "Desenvolver primeiro enriquecimento/classificação VGR",
    justificativa: `Apenas ${percentualRtcItens.toFixed(1)}% das operações estão no padrão RTC (${percentualValor.toFixed(1)}% do valor financeiro) — a maioria dos clientes ainda não migrou.`,
    ressalvas,
  };
}

/** Analisa um lote rotulado — mesma função para 1 cliente/período ou para o corpus inteiro. */
export function analisarLote(lote: LoteRotulado): RelatorioLote {
  const resultado = processarLoteXml(lote.arquivos);
  const cobertura = medirCobertura(resultado.operacoes);
  const comRtc = resultado.operacoes.filter((op) => classificarPadrao(op) === "rtc").length;
  const percentualRtc = resultado.operacoes.length > 0 ? (comRtc / resultado.operacoes.length) * 100 : 0;

  return {
    rotulo: lote.rotulo,
    documentosProcessados: resultado.documentosProcessados,
    documentosComErro: resultado.documentosComErro.length,
    itensEncontrados: resultado.operacoes.length + resultado.duplicadosIgnorados,
    operacoesNormalizadas: resultado.operacoes.length,
    percentualRtc,
    cobertura,
    rankingMotivosInelegibilidade: ranking(cobertura),
  };
}

/**
 * Analisa vários lotes (ex.: clientes/períodos diferentes) e consolida —
 * permite ver a distribuição por cliente/período (seção 5 do pedido) além
 * do agregado geral. Nunca mistura os dados fiscais em si, só as métricas.
 */
export function analisarCorpus(lotes: LoteRotulado[]): RelatorioConsolidado {
  const porLote = lotes.map(analisarLote);

  const todasOperacoes: OperacaoTributariaNormalizada[] = [];
  const erros: ErroDocumento[] = [];
  let documentosProcessados = 0;
  for (const lote of lotes) {
    const r = processarLoteXml(lote.arquivos);
    documentosProcessados += r.documentosProcessados;
    todasOperacoes.push(...r.operacoes);
    erros.push(...r.documentosComErro.map(sanitizarErro));
  }

  const coberturaConsolidada = medirCobertura(todasOperacoes);
  const comRtc = todasOperacoes.filter((op) => classificarPadrao(op) === "rtc").length;
  const percentualRtc = todasOperacoes.length > 0 ? (comRtc / todasOperacoes.length) * 100 : 0;

  return {
    porLote,
    consolidado: {
      documentosProcessados,
      operacoesNormalizadas: todasOperacoes.length,
      percentualRtc,
      percentualElegivelNormativa: coberturaConsolidada.percentualElegivelNormativa,
      percentualElegivelPorValor: coberturaConsolidada.valorPonderado.percentualElegivelPorValor,
      percentualInelegiveisSoPorCClassTrib: coberturaConsolidada.percentualInelegiveisSoPorCClassTrib,
      rankingMotivosInelegibilidade: ranking(coberturaConsolidada),
    },
    recomendacao: recomendar(percentualRtc, coberturaConsolidada),
    erros,
  };
}
