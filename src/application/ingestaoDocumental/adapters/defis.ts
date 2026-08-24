/**
 * Adapter de DEFIS — complementar ao PGDAS-D (nunca o substitui). PGDAS-D é
 * mensal; DEFIS é a declaração anual do Simples. Mesmo padrão de parser por
 * rótulo sobre texto já extraído (ver `pgdas.ts`).
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

function encontrarLinha(linhas: string[], rotulos: string[]): string | null {
  for (const rotulo of rotulos) {
    const rotuloNormalizado = normalizar(rotulo);
    const linha = linhas.find((l) => normalizar(l).includes(rotuloNormalizado));
    if (linha) return linha;
  }
  return null;
}

function extrairAno(linhas: string[]): string | undefined {
  const linha = encontrarLinha(linhas, ["ANO-CALENDARIO", "ANO-CALENDÁRIO", "EXERCICIO"]);
  if (!linha) return undefined;
  const match = linha.match(/(20\d{2})/);
  return match ? match[1] : undefined;
}

export function parseDefisTexto(texto: string, documentoId: string): ResultadoIngestaoDocumento {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const periodo = extrairAno(linhas);
  const ctx = { documentoId, tipoDocumento: "defis" as const, periodo };
  const campos: CampoExtraido<unknown>[] = [];
  const alertas: ResultadoIngestaoDocumento["alertas"] = [
    { codigo: "defis_nao_substitui_pgdas", mensagem: "DEFIS é declaração anual complementar — nunca substitui o PGDAS-D mensal.", gravidade: "info" },
  ];

  const linhaReceitaBruta = encontrarLinha(linhas, ["RECEITA BRUTA TOTAL", "RECEITA BRUTA AUFERIDA NO ANO"]);
  if (linhaReceitaBruta) {
    const valor = extrairValorDaLinha(linhaReceitaBruta);
    if (valor !== null) campos.push(campoExtraido(valor, "confirmado", { ...ctx, observacao: "receitaBrutaAnual", evidencia: linhaReceitaBruta.slice(0, 120) }));
  }

  const linhaEmpregados = encontrarLinha(linhas, ["QUANTIDADE DE EMPREGADOS"]);
  if (linhaEmpregados) {
    const match = linhaEmpregados.match(/(\d+)\s*$/);
    if (match) campos.push(campoExtraido(Number(match[1]), "confirmado", { ...ctx, observacao: "numeroEmpregados", evidencia: linhaEmpregados.slice(0, 120) }));
  }

  if (campos.length === 0) {
    alertas.push({ codigo: "nenhum_campo_localizado", mensagem: "Nenhum campo do DEFIS foi localizado no texto informado.", gravidade: "atencao" });
  }

  return {
    documentoId,
    tipoDocumento: "defis",
    periodo,
    status: campos.length === 0 ? "falhou" : "processado_com_ressalvas",
    camposExtraidos: campos,
    alertas,
    inconsistencias: [],
    limitacoes: [{ descricao: "Extração por rótulo textual — cobertura parcial dos blocos do DEFIS." }],
    metadados: { nomeArquivo: `defis-${documentoId}`, processadoEm: new Date().toISOString() },
  };
}
