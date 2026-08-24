/**
 * Validação pós-geração (seção 36-39/59/60 do pedido) — a defesa real,
 * não o prompt. Rejeita qualquer resposta que contradiga o
 * `ResultadoDecisaoEstrategica`: alternativa trocada, condição omitida,
 * qualidade promovida, risco inventado, evidência/condição inexistente,
 * número não rastreável ao contexto, ou linguagem absoluta/prescritiva.
 */

import type { ContextoIaConsultiva, RespostaBrutaIa } from "./tipos";

const ORDEM_QUALIDADE = { insuficiente: 0, baixa: 1, media: 2, alta: 3 } as const;

const TERMOS_ABSOLUTOS = ["definitivamente", "garantido", "sempre é", "com certeza", "certamente é"];
const TERMOS_PRESCRITIVOS = ["recomendamos", "deve migrar", "migre para", "contrate", "aumente o pró-labore", "aumente pró-labore", "a empresa deve", "é a melhor opção", "convém"];

function extrairNumeros(texto: string): number[] {
  const matches = texto.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((m) => parseFloat(m.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")));
}

function numerosAutorizados(ctx: ContextoIaConsultiva): number[] {
  const valores: number[] = [];
  for (const e of [...ctx.evidenciasFavoraveis, ...ctx.evidenciasContrarias]) {
    if (e.valor === undefined) continue;
    valores.push(e.valor, e.valor * 100, Math.abs(e.valor), Math.abs(e.valor) * 100);
  }
  for (const c of ctx.condicoes) if (c.limite !== undefined) valores.push(c.limite, c.limite * 100);
  for (const p of ctx.pontosVirada) if (p.valorEncontrado !== undefined) valores.push(p.valorEncontrado, p.valorEncontrado * 100);
  valores.push(ctx.identificacaoAnalise.ano);
  return valores;
}

function numeroEstaAutorizado(numero: number, autorizados: number[]): boolean {
  if (Math.abs(numero) < 1) return true; // frações pequenas isoladas (ex.: "1" de "1 p.p.") não são materiais por si só.
  return autorizados.some((a) => Math.abs(a - numero) < Math.max(0.5, Math.abs(a) * 0.01));
}

export interface ResultadoGuardrail {
  valido: boolean;
  motivos: string[];
}

export function validarResposta(resposta: RespostaBrutaIa, ctx: ContextoIaConsultiva): ResultadoGuardrail {
  const motivos: string[] = [];
  const idsValidos = new Set([...ctx.evidenciasFavoraveis.map((e) => e.id), ...ctx.evidenciasContrarias.map((e) => e.id)]);
  const idsCondicao = new Set(ctx.condicoes.map((c) => c.id));

  for (const id of resposta.principaisEvidencias) if (!idsValidos.has(id)) motivos.push(`Evidência citada não existe no contexto: ${id}.`);
  for (const id of resposta.condicoesCitadas) if (!idsCondicao.has(id)) motivos.push(`Condição citada não existe no contexto: ${id}.`);

  if (resposta.alternativaComunicada !== undefined && resposta.alternativaComunicada !== ctx.alternativaPreferida) {
    motivos.push(`Alternativa comunicada (${resposta.alternativaComunicada}) diverge da alternativa preferida pelo motor de decisão (${ctx.alternativaPreferida ?? "nenhuma"}).`);
  }
  if (resposta.alternativaComunicada !== undefined && !ctx.alternativasAvaliadas.includes(resposta.alternativaComunicada) && resposta.alternativaComunicada !== ctx.alternativaPreferida) {
    motivos.push(`Alternativa comunicada não existe entre as avaliadas: ${resposta.alternativaComunicada}.`);
  }

  if (resposta.qualidadeComunicada !== undefined && ORDEM_QUALIDADE[resposta.qualidadeComunicada] > ORDEM_QUALIDADE[ctx.qualidade]) {
    motivos.push(`Qualidade comunicada (${resposta.qualidadeComunicada}) é superior à qualidade real (${ctx.qualidade}) — qualidade nunca pode ser promovida.`);
  }

  if (ctx.statusConclusao === "preferencia_tecnica_condicionada" && ctx.condicoes.length > 0 && resposta.condicoesCitadas.length === 0) {
    motivos.push("Preferência condicionada exige que ao menos uma condição seja citada — nenhuma condição foi referenciada na resposta.");
  }

  for (const riscoComunicado of resposta.riscosComunicados ?? []) {
    const existe = ctx.riscos.some((r) => riscoComunicado.toLowerCase().includes(r.descricao.toLowerCase()) || r.descricao.toLowerCase().includes(riscoComunicado.toLowerCase()));
    if (!existe) motivos.push(`Risco comunicado não corresponde a nenhum risco do contexto: "${riscoComunicado}".`);
  }

  const textoCompleto = `${resposta.titulo} ${resposta.resumoExecutivo} ${resposta.explicacao} ${resposta.textoTecnico ?? ""}`.toLowerCase();
  for (const termo of TERMOS_ABSOLUTOS) if (textoCompleto.includes(termo)) motivos.push(`Linguagem absoluta detectada: "${termo}".`);
  for (const termo of TERMOS_PRESCRITIVOS) if (textoCompleto.includes(termo)) motivos.push(`Linguagem prescritiva detectada: "${termo}".`);

  if (ctx.statusConclusao === "conflito_nao_resolvido") {
    for (const alt of ctx.alternativasAvaliadas) {
      if (textoCompleto.includes(`${alt.toLowerCase()} é a melhor`) || textoCompleto.includes(`${alt.toLowerCase()} vence`)) {
        motivos.push(`Conflito não resolvido não pode declarar vencedor: "${alt}".`);
      }
    }
  }

  const autorizados = numerosAutorizados(ctx);
  for (const numero of extrairNumeros(textoCompleto)) {
    if (!numeroEstaAutorizado(numero, autorizados)) motivos.push(`Número não rastreável ao contexto: ${numero}.`);
  }

  return { valido: motivos.length === 0, motivos };
}
