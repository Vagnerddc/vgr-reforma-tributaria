import { XMLParser } from "fast-xml-parser";
import { campoComProveniencia as campo, gerarIdEstavelOperacao, type OperacaoTributariaNormalizada } from "../operacaoTributaria";

/**
 * Parser granular de NF-e (modelo 55) — piloto de importação de XML fiscal,
 * PARALELO ao pipeline SPED. Não altera calculo.ts, agregador.ts, nem
 * qualquer parser SPED existente. Alimenta o MESMO modelo normalizado VGR
 * (OperacaoTributariaNormalizada) criado na fase anterior — não é um
 * segundo domínio específico de XML.
 *
 * Cobre apenas NF-e (mod=55) nesta primeira fase, conforme pedido — outros
 * documentos (NFS-e, CT-e, etc.) retornam "tipo_nao_suportado" em vez de
 * serem interpretados incorretamente.
 *
 * Distingue explicitamente, para diagnóstico do pipeline (não confundir
 * as duas causas):
 *  - "ausente": o documento simplesmente não tem aquele grupo/campo (comum
 *    em NF-e emitidas antes da RTC, que não têm o grupo IBSCBS).
 *  - "erro_parse": o XML não pôde ser interpretado como NF-e válida.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "det",
  parseTagValue: false, // preserva strings — numeroSped-like parse é feito explicitamente, nunca implícito
});

export type ResultadoParseNfe =
  | { ok: true; nomeArquivo: string; chave: string; operacoes: OperacaoTributariaNormalizada[] }
  | { ok: false; nomeArquivo: string; motivo: "erro_parse" | "tipo_nao_suportado"; detalhe: string };

function texto(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function numero(v: unknown): number | undefined {
  const s = texto(v);
  if (s === undefined) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** O grupo ICMS da NF-e tem uma única chave filha de nome variável (ICMS00, ICMS10, ICMS40, ICMSSN102...) — não há como saber o nome antes de ler. */
function grupoIcms(imposto: unknown): Record<string, unknown> | undefined {
  const icms = (imposto as Record<string, unknown> | undefined)?.ICMS as Record<string, unknown> | undefined;
  if (!icms) return undefined;
  const chave = Object.keys(icms)[0];
  return chave ? (icms[chave] as Record<string, unknown>) : undefined;
}

function extrairChave(infNFe: Record<string, unknown>, protNFe: Record<string, unknown> | undefined): string | undefined {
  const idAttr = texto(infNFe["@_Id"]);
  if (idAttr) return idAttr.replace(/^NFe/, "");
  const chNFe = texto((protNFe?.infProt as Record<string, unknown> | undefined)?.chNFe);
  return chNFe;
}

export function parseNfeXml(nomeArquivo: string, conteudoXml: string): ResultadoParseNfe {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(conteudoXml);
  } catch (e) {
    return { ok: false, nomeArquivo, motivo: "erro_parse", detalhe: e instanceof Error ? e.message : "erro desconhecido ao interpretar XML" };
  }

  const nfeProc = doc.nfeProc as Record<string, unknown> | undefined;
  const nfe = (nfeProc?.NFe ?? doc.NFe) as Record<string, unknown> | undefined;
  const infNFe = nfe?.infNFe as Record<string, unknown> | undefined;
  const protNFe = nfeProc?.protNFe as Record<string, unknown> | undefined;

  if (!infNFe) {
    return { ok: false, nomeArquivo, motivo: "erro_parse", detalhe: "elemento infNFe não encontrado — não é um XML de NF-e reconhecível" };
  }

  const ide = infNFe.ide as Record<string, unknown> | undefined;
  const modelo = texto(ide?.mod);
  if (modelo !== undefined && modelo !== "55") {
    return { ok: false, nomeArquivo, motivo: "tipo_nao_suportado", detalhe: `modelo de documento "${modelo}" não é NF-e (55) — não suportado nesta fase` };
  }

  const chave = extrairChave(infNFe, protNFe);
  const emit = infNFe.emit as Record<string, unknown> | undefined;
  const dest = infNFe.dest as Record<string, unknown> | undefined;
  const enderEmit = emit?.enderEmit as Record<string, unknown> | undefined;
  const enderDest = dest?.enderDest as Record<string, unknown> | undefined;

  const numDoc = texto(ide?.nNF) ?? "";
  const dataEmissao = texto(ide?.dhEmi) ?? texto(ide?.dEmi);
  // tpNF: 0=entrada, 1=saída — mesma convenção do IND_OPER do SPED.
  const tipoOperacao = texto(ide?.tpNF) === "0" ? "entrada" : "saida";
  // cMunFG (município do fato gerador) é o campo estruturalmente mais correto para
  // caracterizar ONDE a operação é tributada — mais confiável que aproximar pelo
  // município da empresa, como era necessário no pipeline SPED.
  const municipioFatoGerador = texto(ide?.cMunFG);
  const ufDestino = texto(enderDest?.UF);
  const ufEmitente = texto(enderEmit?.UF);

  const emitenteId = texto(emit?.CNPJ) ?? texto(emit?.CPF);
  const destinatarioId = texto(dest?.CNPJ) ?? texto(dest?.CPF);

  const itens = (infNFe.det ?? []) as Record<string, unknown>[];
  const operacoes: OperacaoTributariaNormalizada[] = itens.map((det) => {
    const nItem = texto(det["@_nItem"]) ?? "";
    const prod = det.prod as Record<string, unknown> | undefined;
    const imposto = det.imposto as Record<string, unknown> | undefined;
    const icms = grupoIcms(imposto);
    const ibscbs = imposto?.IBSCBS as Record<string, unknown> | undefined;

    // Durante a transição (LC 214/2025, 2026), muitos documentos trazem os DOIS grupos
    // simultaneamente — ICMS legado E IBSCBS novo, lado a lado no mesmo item. São CSTs de
    // sistemas DIFERENTES (o legado tem 2-3 dígitos, ex. "00"/"40"; o da RTC tem sempre 3
    // dígitos, ex. "550"/"200", e é o que o contrato do Motor Oficial espera no campo `cst`
    // de nível de item — confirmado empiricamente: o Motor Oficial rejeita um CST fora do
    // padrão RTC com erro de validação "size must be between 3 and 3"). Por isso o CST do
    // grupo IBSCBS tem prioridade quando presente — o legado só é usado como fallback,
    // quando o documento ainda não emite o grupo novo.
    const cst = texto(ibscbs?.CST) ?? texto(icms?.CST) ?? texto(icms?.CSOSN);
    const cClassTrib = texto(ibscbs?.cClassTrib);
    const baseCalculo = numero(icms?.vBC) ?? numero((ibscbs?.gIBSCBS as Record<string, unknown> | undefined)?.vBC);

    const id = gerarIdEstavelOperacao({ chaveDocumental: chave, nomeArquivo, numeroDocumento: numDoc, numeroItem: nItem });

    return {
      id,
      identificacao: {
        documentoId: numDoc ? campo(numDoc, "xml", "confirmado") : undefined,
        itemId: nItem ? campo(nItem, "xml", "confirmado") : undefined,
        data: dataEmissao ? campo(dataEmissao, "xml", "confirmado") : undefined,
        tipoOperacao: campo(tipoOperacao, "xml", "confirmado"),
      },
      produtoServico: {
        descricao: texto(prod?.xProd) ? campo(texto(prod?.xProd)!, "xml", "confirmado") : undefined,
        ncm: texto(prod?.NCM) ? campo(texto(prod?.NCM)!, "xml", "confirmado") : undefined,
        // NBS é raro em NF-e (mais comum em NFS-e) — ausente na maioria dos documentos reais, nunca inventado.
        nbs: texto(prod?.NBS) ? campo(texto(prod?.NBS)!, "xml", "confirmado") : undefined,
        unidade: texto(prod?.uCom) ? campo(texto(prod?.uCom)!, "xml", "confirmado") : undefined,
        quantidade: numero(prod?.qCom) !== undefined ? campo(numero(prod?.qCom)!, "xml", "confirmado") : undefined,
      },
      classificacaoTributaria: {
        cst: cst ? campo(cst, "xml", "confirmado") : undefined,
        // cClassTrib só existe em documentos emitidos no padrão RTC — ausência em NF-e
        // anterior/sem o grupo IBSCBS é normal, não é falha do parser (ver seção 8 do pedido).
        cClassTrib: cClassTrib ? campo(cClassTrib, "xml", "confirmado") : undefined,
        cfop: texto(prod?.CFOP) ? campo(texto(prod?.CFOP)!, "xml", "confirmado") : undefined,
      },
      valores: {
        valorOperacao: numero(prod?.vProd) !== undefined ? campo(numero(prod?.vProd)!, "xml", "confirmado") : undefined,
        baseCalculo: baseCalculo !== undefined ? campo(baseCalculo, "xml", "confirmado") : undefined,
        descontos: numero(prod?.vDesc) !== undefined ? campo(numero(prod?.vDesc)!, "xml", "confirmado") : undefined,
      },
      localidade: {
        uf: (ufDestino ?? ufEmitente) ? campo((ufDestino ?? ufEmitente)!, "xml", "confirmado") : undefined,
        municipio: municipioFatoGerador ? campo(municipioFatoGerador, "xml", "confirmado", "cMunFG — município do fato gerador, direto do XML (mais confiável que aproximação por empresa).") : undefined,
      },
      participantes: {
        fornecedor: emitenteId ? { identificacao: campo(emitenteId, "xml", "confirmado") } : undefined,
        cliente: destinatarioId ? { identificacao: campo(destinatarioId, "xml", "confirmado") } : undefined,
      },
      granularidade: "item",
    };
  });

  return { ok: true, nomeArquivo, chave: chave ?? "", operacoes };
}
