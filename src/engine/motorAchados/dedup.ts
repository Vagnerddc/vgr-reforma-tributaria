/**
 * Deduplicação (seção 41/42 do pedido) — quando dois módulos confirmam o
 * MESMO fato (mesmo código + regime + ano + cenário), consolida em UM
 * achado, preservando TODAS as evidências (nunca perde a segunda fonte).
 * Achados com premissas DIFERENTES nunca são deduplicados entre si
 * (seção 43 — contradições por premissa distinta permanecem separadas).
 */

import type { AchadoEstrategico } from "./tipos";

function chaveDeduplicacao(a: AchadoEstrategico): string {
  const premissasChave = JSON.stringify(a.premissas ?? {});
  return [a.codigo, a.regime ?? "", a.periodo?.ano ?? "", a.cenarioId ?? "", a.atividade ?? "", premissasChave].join("|");
}

export function deduplicarAchados(achados: AchadoEstrategico[]): AchadoEstrategico[] {
  const porChave = new Map<string, AchadoEstrategico>();

  for (const achado of achados) {
    const chave = chaveDeduplicacao(achado);
    const existente = porChave.get(chave);
    if (!existente) {
      porChave.set(chave, achado);
      continue;
    }
    porChave.set(chave, {
      ...existente,
      evidencias: [...existente.evidencias, ...achado.evidencias.filter((e) => !existente.evidencias.some((ex) => ex.origem === e.origem && ex.referencia === e.referencia))],
      qualidade: piorQualidade(existente.qualidade, achado.qualidade),
    });
  }

  return [...porChave.values()];
}

function piorQualidade(a: AchadoEstrategico["qualidade"], b: AchadoEstrategico["qualidade"]): AchadoEstrategico["qualidade"] {
  const ordem = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
  return ordem[a] <= ordem[b] ? a : b;
}
