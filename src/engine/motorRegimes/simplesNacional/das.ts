/**
 * Alíquota efetiva e DAS — apuração MENSAL (LC 123/2006, art. 18),
 * consolidada ao ano só no final (seção 16 do pedido: nunca "receita
 * anual × alíquota média" diretamente). A faixa é reavaliada em CADA mês
 * a partir da RBT12 rolante daquele mês — é assim que a mudança de faixa
 * durante o ano (seção 39) surge naturalmente, sem regra especial.
 */

import type { AnexoSimplesNucleo, FaixaSimples } from "./normativa";
import { TABELAS_SIMPLES, determinarIndiceFaixa } from "./normativa";
import type { Rbt12Mensal } from "./rbt12";
import type { FatorRMensal } from "./fatorR/fatorR";
import type { ValorComponenteTributario } from "../tipos";

export interface AliquotaEfetivaResultado {
  faixa: FaixaSimples;
  aliquotaEfetiva: number;
}

/** (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12 — fórmula normativa da alíquota efetiva (LC 123/2006, art. 18, §1º-A). */
export function calcularAliquotaEfetiva(rbt12: number, anexo: AnexoSimplesNucleo): AliquotaEfetivaResultado {
  const indiceFaixa = determinarIndiceFaixa(rbt12);
  const faixa = TABELAS_SIMPLES[anexo].find((f) => f.indice === indiceFaixa)!;
  const aliquotaEfetiva = rbt12 > 0 ? (rbt12 * faixa.aliquotaNominal - faixa.parcelaDeduzir) / rbt12 : 0;
  return { faixa, aliquotaEfetiva };
}

export interface DasMensal {
  mes: number;
  rbt12: number;
  faixa: number;
  aliquotaEfetiva: number;
  receitaMes: number;
  das: number;
}

/**
 * DAS de UMA atividade, mês a mês — `receitaAnualAtividade` é distribuída
 * uniformemente entre os 12 meses (mesma premissa já usada no Presumido
 * e na RBT12 acima; nunca escondida — quem chama isso deve registrar a
 * premissa em `alertas`/`premissas`, não este módulo).
 */
export function calcularDasMensal(rbt12PorMes: Rbt12Mensal[], receitaAnualAtividade: number, anexo: AnexoSimplesNucleo): DasMensal[] {
  const receitaMensal = receitaAnualAtividade / 12;
  return rbt12PorMes.map(({ mes, rbt12 }) => {
    const { faixa, aliquotaEfetiva } = calcularAliquotaEfetiva(rbt12, anexo);
    return { mes, rbt12, faixa: faixa.indice, aliquotaEfetiva, receitaMes: receitaMensal, das: receitaMensal * aliquotaEfetiva };
  });
}

/**
 * Igual a `calcularDasMensal`, mas o ANEXO varia mês a mês (III ou V),
 * decidido pelo Fator R daquele mês (`fatorR.ts`) — é assim que uma
 * mudança de Fator R no meio do ano (seção 34 do pedido) tem efeito real
 * no DAS, mês exato em que ocorre, nunca um anexo fixado no início do ano.
 */
export function calcularDasMensalComFatorR(mesesFatorR: FatorRMensal[], receitaAnualAtividade: number): DasMensal[] {
  const receitaMensal = receitaAnualAtividade / 12;
  return mesesFatorR.map(({ mes, rbt12, anexoResultante }) => {
    const { faixa, aliquotaEfetiva } = calcularAliquotaEfetiva(rbt12, anexoResultante);
    return { mes, rbt12, faixa: faixa.indice, aliquotaEfetiva, receitaMes: receitaMensal, das: receitaMensal * aliquotaEfetiva };
  });
}

/**
 * Na faixa 6 (a mais alta), o ICMS (Anexo I)/ISS (Anexo III)/IPI (Anexo
 * II) deixa de ser recolhido DENTRO do DAS — passa a ser apurado e
 * recolhido separadamente pelo contribuinte (LC 123/2006, art. 18, §20).
 * A parcela a deduzir da faixa 6 já reflete essa exclusão (por isso a
 * alíquota efetiva pode até cair ao entrar nela — não é um erro). Este
 * motor NÃO calcula esse componente separado (fora de escopo do núcleo
 * geral) — sinalizado explicitamente, nunca escondido dentro de "das".
 */
export function atingiuFaixaComTributoSegregado(dasMensal: DasMensal[]): boolean {
  return dasMensal.some((m) => m.faixa === 6);
}

/**
 * Consolidação anual quando o anexo veio do Fator R (varia por mês) —
 * preserva na memória exatamente o que a seção 19 do pedido exige: Fator
 * R usado, FS12, RBT12, limite, decisão de anexo, tudo por referência ao
 * ano (média simples dos 12 meses, só para leitura executiva — o detalhe
 * mês a mês continua em `mesesFatorR`, não é descartado).
 */
export function consolidarDasAnualComFatorR(dasMensal: DasMensal[], mesesFatorR: FatorRMensal[]): ValorComponenteTributario {
  const dasAnual = dasMensal.reduce((s, m) => s + m.das, 0);
  const receitaAnual = dasMensal.reduce((s, m) => s + m.receitaMes, 0);
  const anexosUsados = [...new Set(mesesFatorR.map((m) => m.anexoResultante))];
  const fatorRMedio = mesesFatorR.reduce((s, m) => s + m.fatorR, 0) / mesesFatorR.length;
  const rbt12Medio = mesesFatorR.reduce((s, m) => s + m.rbt12, 0) / mesesFatorR.length;
  const fs12Medio = mesesFatorR.reduce((s, m) => s + m.fs12, 0) / mesesFatorR.length;

  return {
    componente: "das",
    valor: dasAnual,
    base: receitaAnual,
    regraAplicada: "simples.fator_r.mensal.v1",
    fundamentoLegal: "LC 123/2006, arts. 18 e 18, §5º-M",
    memoriaCalculo:
      anexosUsados.length === 1
        ? `Fator R médio no ano: ${(fatorRMedio * 100).toFixed(2)}% (FS12 médio R$ ${fs12Medio.toFixed(2)} ÷ RBT12 médio R$ ${rbt12Medio.toFixed(2)}) — sempre no Anexo ${anexosUsados[0] === "anexo_iii" ? "III" : "V"} durante o ano. DAS anual = R$ ${dasAnual.toFixed(2)}.`
        : `Fator R cruzou o limite de 28% durante o ano — anexo mudou de ${anexosUsados.map((a) => (a === "anexo_iii" ? "III" : "V")).join(" para ")} conforme o mês. DAS anual (recalculado mês a mês) = R$ ${dasAnual.toFixed(2)}.`,
    status: "estimado",
  };
}

/** Consolida os meses calculados em um único componente "das" anual, preservando memória suficiente para reconstrução (seção 15/28 do pedido). */
export function consolidarDasAnual(dasMensal: DasMensal[], anexo: AnexoSimplesNucleo): ValorComponenteTributario {
  const dasAnual = dasMensal.reduce((s, m) => s + m.das, 0);
  const receitaAnual = dasMensal.reduce((s, m) => s + m.receitaMes, 0);
  const faixasUsadas = [...new Set(dasMensal.map((m) => m.faixa))].sort((a, b) => a - b);
  const rbt12Min = Math.min(...dasMensal.map((m) => m.rbt12));
  const rbt12Max = Math.max(...dasMensal.map((m) => m.rbt12));

  return {
    componente: "das",
    valor: dasAnual,
    base: receitaAnual,
    regraAplicada: `simples.${anexo}.mensal.v1`,
    fundamentoLegal: "LC 123/2006, art. 18",
    memoriaCalculo:
      faixasUsadas.length === 1
        ? `12 meses na faixa ${faixasUsadas[0]} (RBT12 entre R$ ${rbt12Min.toFixed(2)} e R$ ${rbt12Max.toFixed(2)}). DAS mensal = receita do mês × alíquota efetiva; soma anual = R$ ${dasAnual.toFixed(2)}.`
        : `RBT12 variou de R$ ${rbt12Min.toFixed(2)} a R$ ${rbt12Max.toFixed(2)} ao longo do ano, passando pelas faixas ${faixasUsadas.join(" → ")}. DAS mensal recalculado em cada mês; soma anual = R$ ${dasAnual.toFixed(2)}.`,
    status: "estimado",
  };
}
