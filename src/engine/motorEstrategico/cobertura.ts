/**
 * Cobertura estratégica (seção 58/59/84) — "nenhuma alternativa" precisa
 * ser distinguível de "não analisado", mesma disciplina do Motor de
 * Achados.
 */

import type { CoberturaEstrategica } from "./tipos";
import type { ContextoEstrategico } from "./contexto";

export function avaliarCoberturaEstrategica(ctx: ContextoEstrategico, fatorRAplicavel: boolean): CoberturaEstrategica {
  const fiscalDisponivel = ctx.relatorio.cobertura.fiscal === "disponivel";
  const margemDisponivel = ctx.relatorio.cobertura.margem === "disponivel";
  const caixaDisponivel = ctx.relatorio.cobertura.caixa === "disponivel";

  return {
    preco: margemDisponivel ? "analisado" : "indisponivel",
    creditos: ctx.relatorio.cobertura.creditos === "disponivel" ? "analisado" : "indisponivel",
    fatorR: !fatorRAplicavel ? "nao_aplicavel" : fiscalDisponivel ? "analisado" : "indisponivel",
    regimes: fiscalDisponivel ? "analisado" : "indisponivel",
    capitalGiro: caixaDisponivel ? "analisado" : "indisponivel",
    custoFinanceiro: caixaDisponivel ? "analisado" : "indisponivel",
    qualidadeDados: "analisado",
  };
}
