import { medirCobertura, type ErroDocumento } from "./lote";
import { classificarPadrao, ranking, sanitizarErro, type MotivoRanking } from "./analiseCorpus";
import { parseNfeXml } from "./nfe";
import type { OperacaoTributariaNormalizada } from "../operacaoTributaria";

/**
 * Agrupamento automático por cliente + mês de emissão — para quando os
 * arquivos chegam misturados (ex.: uma pasta de Downloads com XMLs de
 * vários clientes e meses, fora de ordem). NUNCA usa a ordem dos
 * arquivos/pastas como período: o mês vem exclusivamente da data de
 * emissão real dentro do XML (identificacao.data).
 *
 * A EMPRESA ANALISADA (proprietária do corpus) é resolvida pelo contexto
 * de cada arquivo (`identificarProprietario`, obrigatório — sem default
 * implícito), nunca inferida do conteúdo do XML (emitente/destinatário/
 * direção da operação). Essa é uma correção deliberada: uma versão
 * anterior desta função inferia a empresa pela direção da NF-e
 * (emitente em saída, destinatário em entrada) e reatribuiu erroneamente
 * ~10% do valor financeiro de um cliente real a "clientes" fantasmas —
 * documentos de devolução emitidos pela própria empresa (tpNF="0") faziam
 * a heurística pegar o destinatário, uma contraparte, como se fosse um
 * cliente novo. Ver ResolverProprietario para o racional completo. O
 * relatório final sempre anonimiza como "Cliente A", "Cliente B"... nunca
 * expõe CNPJ/razão social.
 *
 * Reutiliza nfe.ts/lote.ts (parser, cobertura, ranking) — não duplica essa
 * lógica; só isola erro por arquivo e deduplica aqui porque precisa manter
 * a associação arquivo→proprietário antes de deduplicar globalmente.
 */

/**
 * Resolve a EMPRESA ANALISADA (proprietária do corpus) para um arquivo —
 * definida pelo CONTEXTO em que o arquivo chegou (ex.: prefixo da pasta,
 * qual pasta/zip foi entregue por qual cliente), nunca inferida a partir
 * do conteúdo do XML (emitente/destinatário/tpNF).
 *
 * Isso é deliberado: um documento de entrada emitido pela própria empresa
 * (ex.: nota de devolução, tpNF="0") ainda pertence a ela mesmo aparecendo
 * como "emitente" nesse papel; uma compra normal de um fornecedor externo
 * também pertence a ela mesmo aparecendo como "destinatário". A direção da
 * operação (entrada/saída) descreve o PAPEL de cada participante no
 * documento — nunca decide, por si só, de quem é o corpus. Ver
 * docs/piloto-integracao-motor-oficial.md para o caso real que motivou essa
 * correção (uma tentativa anterior de inferir por tpNF/direção reatribuiu
 * ~10% do valor financeiro de um cliente a "clientes" fantasmas).
 */
export type ResolverProprietario = (nomeArquivo: string) => string;

const MES_REGEX = /^(\d{4})-(\d{2})/;

/** Extrai "YYYY-MM" da data de emissão real do documento — nunca da ordem de leitura do arquivo. */
function identificarMes(op: OperacaoTributariaNormalizada): string | undefined {
  const data = op.identificacao.data?.valor;
  if (!data) return undefined;
  const m = MES_REGEX.exec(data);
  return m ? `${m[1]}-${m[2]}` : undefined;
}

const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatarMes(mesChave: string): string {
  const m = MES_REGEX.exec(mesChave + "-01");
  if (!m) return mesChave;
  const ano = m[1];
  const mes = parseInt(m[2], 10);
  return `${NOMES_MES[mes - 1]}/${ano}`;
}

/** Gera a sequência cronológica de chaves "YYYY-MM" entre dois meses (inclusive), para exibir mesmo os meses sem documento. */
export function gerarSequenciaMeses(mesInicio: string, mesFim: string): string[] {
  const [anoIni, mesIniN] = mesInicio.split("-").map(Number);
  const [anoFim, mesFimN] = mesFim.split("-").map(Number);
  const meses: string[] = [];
  let ano = anoIni;
  let mes = mesIniN;
  while (ano < anoFim || (ano === anoFim && mes <= mesFimN)) {
    meses.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return meses;
}

export interface LinhaEvolucaoMensal {
  periodo: string; // "Jan/2026"
  semDocumentos: boolean;
  documentos: number;
  itens: number;
  percentualRtc: number;
  percentualElegivelItens: number;
  percentualElegivelValor: number;
  principalGap: string | null; // null quando 100% elegível ou sem documentos
}

export interface RelatorioClienteTemporal {
  /** Rótulo anonimizado — "Cliente A", "Cliente B"... nunca o CNPJ real. */
  clienteAnonimo: string;
  evolucaoMensal: LinhaEvolucaoMensal[];
  consolidadoPeriodo: LinhaEvolucaoMensal;
}

export interface RelatorioTemporalConsolidado {
  /** Meses fora da faixa 01/2026–08/2026 informada, mantidos e sinalizados — nunca descartados silenciosamente. */
  documentosForaDoPeriodo: number;
  /** Documentos sem data de emissão interpretável — nunca alocados a um mês "no chute". */
  documentosSemDataInterpretavel: number;
  porCliente: RelatorioClienteTemporal[];
  consolidadoGeral: LinhaEvolucaoMensal;
  erros: ErroDocumento[];
}

function linhaDeOperacoes(periodo: string, operacoes: OperacaoTributariaNormalizada[]): LinhaEvolucaoMensal {
  if (operacoes.length === 0) {
    return { periodo, semDocumentos: true, documentos: 0, itens: 0, percentualRtc: 0, percentualElegivelItens: 0, percentualElegivelValor: 0, principalGap: null };
  }
  const documentosUnicos = new Set(operacoes.map((op) => op.identificacao.documentoId?.valor ?? op.id));
  const cobertura = medirCobertura(operacoes);
  const comRtc = operacoes.filter((op) => classificarPadrao(op) === "rtc").length;
  const rankingMotivos = ranking(cobertura);
  return {
    periodo,
    semDocumentos: false,
    documentos: documentosUnicos.size,
    itens: operacoes.length,
    percentualRtc: (comRtc / operacoes.length) * 100,
    percentualElegivelItens: cobertura.percentualElegivelNormativa,
    percentualElegivelValor: cobertura.valorPonderado.percentualElegivelPorValor,
    principalGap: rankingMotivos[0] ? `${rankingMotivos[0].campo} ausente (${rankingMotivos[0].percentual.toFixed(1)}%)` : null,
  };
}

/**
 * Analisa um corpus misto (várias empresas, vários meses, arquivos fora de
 * ordem) agrupando automaticamente por cliente (CNPJ, anonimizado no
 * relatório) e por mês de emissão real — nunca pela ordem de
 * arquivos/pastas. `mesInicio`/`mesFim` definem a janela cronológica que
 * deve aparecer completa no relatório (mesmo os meses sem documento),
 * conforme a faixa real conhecida do corpus (ex.: "2026-01" a "2026-08").
 */
export function analisarCorpusTemporal(
  arquivos: { nomeArquivo: string; conteudo: string }[],
  mesInicio: string,
  mesFim: string,
  identificarProprietario: ResolverProprietario
): RelatorioTemporalConsolidado {
  const sequenciaMeses = gerarSequenciaMeses(mesInicio, mesFim);
  const mesesValidos = new Set(sequenciaMeses);

  // Cada arquivo é processado individualmente (mesmo parser/isolamento de erro de
  // nfe.ts) para que o proprietário seja resolvido pelo CONTEXTO do arquivo, não
  // pelo conteúdo do documento — ver ResolverProprietario acima. A deduplicação
  // (por id estável) acontece depois, sobre o conjunto completo.
  const porOperacaoId = new Map<string, OperacaoTributariaNormalizada>();
  const erros: ErroDocumento[] = [];
  const porEmpresa = new Map<string, OperacaoTributariaNormalizada[]>();
  let documentosForaDoPeriodo = 0;
  let documentosSemDataInterpretavel = 0;

  for (const arquivo of arquivos) {
    const resultado = parseNfeXml(arquivo.nomeArquivo, arquivo.conteudo);
    if (!resultado.ok) {
      erros.push({ nomeArquivo: resultado.nomeArquivo, motivo: resultado.motivo, detalhe: resultado.detalhe });
      continue;
    }
    const empresa = identificarProprietario(arquivo.nomeArquivo);
    for (const op of resultado.operacoes) {
      if (porOperacaoId.has(op.id)) continue; // deduplicação por id estável — mesma operação não conta duas vezes
      porOperacaoId.set(op.id, op);

      if (!porEmpresa.has(empresa)) porEmpresa.set(empresa, []);
      porEmpresa.get(empresa)!.push(op);

      const mes = identificarMes(op);
      if (mes === undefined) documentosSemDataInterpretavel++;
      else if (!mesesValidos.has(mes)) documentosForaDoPeriodo++;
    }
  }

  // Ordenação determinística das empresas (por CNPJ/identificador) antes de anonimizar —
  // não depende da ordem de chegada dos arquivos, que o pedido explicitamente disse ser arbitrária.
  const empresasOrdenadas = [...porEmpresa.keys()].sort();
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const porCliente: RelatorioClienteTemporal[] = empresasOrdenadas.map((empresa, indice) => {
    const operacoesDaEmpresa = porEmpresa.get(empresa)!;
    const porMes = new Map<string, OperacaoTributariaNormalizada[]>();
    for (const mes of sequenciaMeses) porMes.set(mes, []);
    for (const op of operacoesDaEmpresa) {
      const mes = identificarMes(op);
      if (mes !== undefined && mesesValidos.has(mes)) porMes.get(mes)!.push(op);
    }
    const evolucaoMensal = sequenciaMeses.map((mes) => linhaDeOperacoes(formatarMes(mes), porMes.get(mes)!));
    const operacoesNoPeriodo = sequenciaMeses.flatMap((mes) => porMes.get(mes)!);
    return {
      clienteAnonimo: `Cliente ${letras[indice] ?? `#${indice + 1}`}`,
      evolucaoMensal,
      consolidadoPeriodo: linhaDeOperacoes(`${formatarMes(mesInicio)} – ${formatarMes(mesFim)}`, operacoesNoPeriodo),
    };
  });

  const todasOperacoesNoPeriodo = [...porOperacaoId.values()].filter((op) => {
    const mes = identificarMes(op);
    return mes !== undefined && mesesValidos.has(mes);
  });

  return {
    documentosForaDoPeriodo,
    documentosSemDataInterpretavel,
    porCliente,
    consolidadoGeral: linhaDeOperacoes(`${formatarMes(mesInicio)} – ${formatarMes(mesFim)}`, todasOperacoesNoPeriodo),
    erros: erros.map(sanitizarErro),
  };
}

export type { MotivoRanking };
