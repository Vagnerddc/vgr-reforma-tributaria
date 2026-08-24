/**
 * Adapter de PGDAS-D — PRIORIDADE ALTA (fonte nativa do Simples Nacional).
 * Opera sobre TEXTO já extraído do PDF gerado pelo portal do Simples (não há
 * parser de PDF estruturado nesta fase — extração de bytes fica isolada em
 * `extrairTextoPgdasPdf`, não implementada aqui). Parser por RÓTULO, mesmo
 * estilo de `engine/dre/parseTextoDre.ts`: nunca por posição fixa, e nunca
 * assume um valor quando o rótulo não é encontrado — vira "indeterminado"
 * (ausência do campo), nunca zero fabricado.
 *
 * IMPORTANTE: este documento é chamado corretamente de "PGDAS-D" no
 * contrato — nunca genericamente de "Extrato do DAS" (que é outro
 * documento, sem XML/texto estruturado padrão, não implementado nesta fase).
 */
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento, CampoExtraido } from "../tipos";

function normalizar(texto: string): string {
  return texto.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function extrairValorDaLinha(linha: string): number | null {
  const matches = linha.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1].replace(/\./g, "").replace(",", "."));
}

function extrairPercentualDaLinha(linha: string): number | null {
  const match = linha.match(/(\d{1,3}(?:,\d{1,4})?)\s*%/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function encontrarLinha(linhas: string[], rotulos: string[]): string | null {
  for (const rotulo of rotulos) {
    const rotuloNormalizado = normalizar(rotulo);
    const linha = linhas.find((l) => normalizar(l).includes(rotuloNormalizado));
    if (linha) return linha;
  }
  return null;
}

function extrairPeriodo(linhas: string[]): string | undefined {
  const linha = encontrarLinha(linhas, ["PERIODO DE APURACAO", "PERÍODO DE APURAÇÃO", "PA -"]);
  if (!linha) return undefined;
  const match = linha.match(/(\d{2}\/\d{4}|\d{4}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : undefined;
}

export function parsePgdasTexto(texto: string, documentoId: string): ResultadoIngestaoDocumento {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const periodo = extrairPeriodo(linhas);
  const ctx = { documentoId, tipoDocumento: "pgdas" as const, periodo };
  const campos: CampoExtraido<unknown>[] = [];
  const alertas: ResultadoIngestaoDocumento["alertas"] = [];

  function campoNumerico(rotulos: string[], observacao: string, extrator: (linha: string) => number | null = extrairValorDaLinha) {
    const linha = encontrarLinha(linhas, rotulos);
    if (!linha) return;
    const valor = extrator(linha);
    if (valor === null) return;
    campos.push(campoExtraido(valor, "confirmado", { ...ctx, observacao, evidencia: linha.slice(0, 120) }));
  }

  campoNumerico(["RECEITA BRUTA DO PA", "RECEITA BRUTA DO PERIODO DE APURACAO"], "receita.periodoApuracao");
  campoNumerico(["RBT12", "RECEITA BRUTA ACUMULADA NOS DOZE MESES"], "rbt12");
  campoNumerico(["ALIQUOTA EFETIVA", "ALÍQUOTA EFETIVA"], "aliquotaEfetiva", extrairPercentualDaLinha);
  campoNumerico(["VALOR TOTAL DO DEBITO", "VALOR TOTAL DO DAS", "TOTAL A RECOLHER"], "dasApurado");

  const linhaAnexo = encontrarLinha(linhas, ["ANEXO"]);
  if (linhaAnexo) {
    const match = linhaAnexo.match(/ANEXO\s*([IVX]+)/i);
    if (match) campos.push(campoExtraido(match[1].toUpperCase(), "confirmado", { ...ctx, observacao: "anexo", evidencia: linhaAnexo.slice(0, 120) }));
  }

  for (const [tributo, rotulos] of Object.entries({
    irpj: ["IRPJ"],
    csll: ["CSLL"],
    pis: ["PIS/PASEP", "PIS"],
    cofins: ["COFINS"],
    cpp: ["CPP"],
    icms: ["ICMS"],
    iss: ["ISS"],
  })) {
    const linha = encontrarLinha(linhas, rotulos);
    if (!linha) continue;
    const valor = extrairValorDaLinha(linha);
    if (valor === null) continue;
    campos.push(campoExtraido(valor, "confirmado", { ...ctx, observacao: `tributoComponente.${tributo}`, evidencia: linha.slice(0, 120) }));
  }

  if (campos.length === 0) {
    alertas.push({ codigo: "nenhum_campo_localizado", mensagem: "Nenhum campo do PGDAS-D (receita, RBT12, anexo, DAS) foi localizado no texto informado — confirme manualmente.", gravidade: "atencao" });
  }
  if (!periodo) {
    alertas.push({ codigo: "periodo_nao_identificado", mensagem: "Período de apuração não identificado no PGDAS-D.", gravidade: "atencao" });
  }

  return {
    documentoId,
    tipoDocumento: "pgdas",
    periodo,
    status: campos.length === 0 ? "falhou" : alertas.length > 0 ? "processado_com_ressalvas" : "processado",
    camposExtraidos: campos,
    alertas,
    inconsistencias: [],
    limitacoes: [{ descricao: "Extração por rótulo textual — layouts do PGDAS-D fora do padrão do portal do Simples podem não ser reconhecidos." }],
    metadados: { nomeArquivo: `pgdas-${documentoId}`, processadoEm: new Date().toISOString() },
  };
}

/** Extração de bytes de PDF real — NÃO implementada nesta fase (import dinâmico de pdfjs-dist ficaria aqui, análogo a extrairDrePdf.ts, quando esta função for implementada). */
export async function extrairTextoPgdasPdf(_bytes: Uint8Array): Promise<string> {
  throw new Error("Extração de texto de PGDAS-D a partir de PDF binário não implementada nesta fase — forneça o texto já extraído.");
}
