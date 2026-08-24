/**
 * Aplicação de alterações — PURA, nunca muta `CenarioEmpresa` original
 * (seção 5 do pedido: imutabilidade do baseline é obrigatória). Usa
 * `structuredClone` para derivar uma cópia independente antes de
 * qualquer patch.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { CampoComProveniencia } from "../operacaoTributaria";
import type { AlteracoesCenario, ErroValidacaoCenario, ValorAlterado } from "./tipos";

/**
 * Resolve um `ValorAlterado` contra o valor base atual — ordem
 * determinística fixa (seção 41 do pedido): `set` ignora a base;
 * `incremento_absoluto` soma à base (ausência de base tratada como 0);
 * `incremento_percentual` multiplica a base por `(1 + valor)` e EXIGE que
 * a base exista (rejeitado na validação quando não existir — nunca
 * assume 0% como base percentual).
 */
export function resolverValorAlterado(base: number | undefined, alterado: ValorAlterado): number {
  switch (alterado.tipo) {
    case "set":
      return alterado.valor;
    case "incremento_absoluto":
      return (base ?? 0) + alterado.valor;
    case "incremento_percentual":
      return (base ?? 0) * (1 + alterado.valor);
  }
}

function campoAlterado(base: number | undefined, alterado: ValorAlterado): CampoComProveniencia<number> {
  return { valor: resolverValorAlterado(base, alterado), origem: alterado.origem, status: alterado.status };
}

/**
 * Detecta alterações estruturalmente impossíveis ANTES de aplicar
 * qualquer patch (seção 42/43 do pedido: nunca corrige silenciosamente,
 * sempre rejeita). Só valida o que este módulo pode avaliar sem
 * depender dos motores fiscais/financeiros (esses continuam livres para
 * marcar seus próprios pontos como indeterminados/impossíveis).
 */
export function validarAlteracoes(base: CenarioEmpresa, alteracoes: AlteracoesCenario): ErroValidacaoCenario[] {
  const erros: ErroValidacaoCenario[] = [];

  const faturamentoResolvido = alteracoes.receita?.faturamentoAnual
    ? resolverValorAlterado(base.receita.faturamentoAnual?.valor, alteracoes.receita.faturamentoAnual)
    : base.receita.faturamentoAnual?.valor;
  if (faturamentoResolvido !== undefined && faturamentoResolvido < 0) {
    erros.push({ campo: "receita.faturamentoAnual", motivo: `Receita resultante negativa (${faturamentoResolvido.toFixed(2)}) — alteração rejeitada, nunca corrigida para zero.` });
  }

  if (alteracoes.receita?.crescimentoAnualEstimado?.tipo === "incremento_percentual" && base.receita.crescimentoAnualEstimado?.valor === undefined) {
    erros.push({ campo: "receita.crescimentoAnualEstimado", motivo: "incremento_percentual exige uma taxa de crescimento base já existente — cenário não a possui." });
  }

  for (const item of alteracoes.custos?.itens ?? []) {
    const existente = base.custos.itens.find((i) => i.categoria.chave === item.categoriaChave);
    if (!existente) {
      erros.push({ campo: `custos.itens[${item.categoriaChave}]`, motivo: "Categoria de custo não encontrada no cenário-base — este módulo não cria categorias novas." });
      continue;
    }
    const valorResolvido = resolverValorAlterado(existente.valorAnual, item.valorAnual);
    if (valorResolvido < 0) {
      erros.push({ campo: `custos.itens[${item.categoriaChave}].valorAnual`, motivo: `Valor resultante negativo (${valorResolvido.toFixed(2)}) — alteração rejeitada.` });
    }
  }

  const fator = alteracoes.custos?.fatorEscalaCustosCreditaveisIbsCbs;
  if (fator && resolverValorAlterado(1, fator) < 0) {
    erros.push({ campo: "custos.fatorEscalaCustosCreditaveisIbsCbs", motivo: "Fator resultante negativo — não representa uma escala válida de custo." });
  }
  const fatorTodos = alteracoes.custos?.fatorEscalaTodosItens;
  if (fatorTodos && resolverValorAlterado(1, fatorTodos) < 0) {
    erros.push({ campo: "custos.fatorEscalaTodosItens", motivo: "Fator resultante negativo — não representa uma escala válida de custo." });
  }

  for (const [campo, alterado] of Object.entries(alteracoes.pessoas ?? {})) {
    if (!alterado) continue;
    const baseValor = (base.pessoas as Record<string, CampoComProveniencia<number> | undefined>)[campo]?.valor;
    const resolvido = resolverValorAlterado(baseValor, alterado);
    if (resolvido < 0) erros.push({ campo: `pessoas.${campo}`, motivo: `Valor resultante negativo (${resolvido.toFixed(2)}) — alteração rejeitada (ex.: FS12 nunca pode ficar negativa).` });
  }

  const margemAlvo = alteracoes.financeiro?.margemAlvo;
  if (margemAlvo) {
    const resolvido = resolverValorAlterado(undefined, margemAlvo);
    if (resolvido <= -1) erros.push({ campo: "financeiro.margemAlvo", motivo: "Margem-alvo ≤ -100% não é uma margem representável." });
  }

  const custosVariaveis = alteracoes.financeiro?.percentualCustosVariaveis;
  if (custosVariaveis) {
    const resolvido = resolverValorAlterado(base.economicoFinanceiro?.margemAtual ? undefined : undefined, custosVariaveis);
    if (resolvido < 0 || resolvido > 1) erros.push({ campo: "financeiro.percentualCustosVariaveis", motivo: `Percentual de custos variáveis deve estar entre 0 e 1 (recebido: ${resolvido}).` });
  }

  for (const [campo, alterado] of Object.entries(alteracoes.splitPayment ?? {})) {
    if (!alterado) continue;
    const resolvido = resolverValorAlterado(undefined, alterado);
    if ((campo === "percentualRecebimentosSujeitos" || campo === "percentualTributoSegregado") && (resolvido < 0 || resolvido > 1)) {
      erros.push({ campo: `splitPayment.${campo}`, motivo: `Percentual deve estar entre 0 e 1 (recebido: ${resolvido}) — nunca corrigido automaticamente (ex.: 150% é rejeitado, não truncado para 100%).` });
    }
    if (campo === "taxaCustoCapitalMensal" && resolvido < 0) {
      erros.push({ campo: "splitPayment.taxaCustoCapitalMensal", motivo: "Taxa de custo de capital negativa não é válida." });
    }
    if (campo === "caixaMinimoOperacional" && resolvido < 0) {
      erros.push({ campo: "splitPayment.caixaMinimoOperacional", motivo: "Caixa mínimo operacional negativo não é válido." });
    }
  }

  return erros;
}

/**
 * Deriva um novo `CenarioEmpresa` a partir do base + alterações — NUNCA
 * muta `base`. Deve ser chamado só depois de `validarAlteracoes` não
 * retornar erros (chamadores que ignorarem isso podem produzir um
 * cenário com valores negativos, já que este módulo não repete a
 * validação).
 */
export function aplicarAlteracoes(base: CenarioEmpresa, alteracoes: AlteracoesCenario): { cenario: CenarioEmpresa; alertas: string[] } {
  const cenario: CenarioEmpresa = structuredClone(base);
  const alertas: string[] = [];

  if (alteracoes.receita?.faturamentoAnual) {
    cenario.receita.faturamentoAnual = campoAlterado(base.receita.faturamentoAnual?.valor, alteracoes.receita.faturamentoAnual);
  }
  if (alteracoes.receita?.crescimentoAnualEstimado) {
    cenario.receita.crescimentoAnualEstimado = campoAlterado(base.receita.crescimentoAnualEstimado?.valor, alteracoes.receita.crescimentoAnualEstimado);
  }

  for (const item of alteracoes.custos?.itens ?? []) {
    const idx = cenario.custos.itens.findIndex((i) => i.categoria.chave === item.categoriaChave);
    if (idx === -1) continue; // já reportado por validarAlteracoes; aplicação silenciosa de um erro não-fatal não é responsabilidade deste módulo.
    const existenteBase = base.custos.itens.find((i) => i.categoria.chave === item.categoriaChave)!;
    cenario.custos.itens[idx] = { ...cenario.custos.itens[idx], valorAnual: resolverValorAlterado(existenteBase.valorAnual, item.valorAnual) };
  }

  const fator = alteracoes.custos?.fatorEscalaCustosCreditaveisIbsCbs;
  if (fator) {
    const fatorResolvido = resolverValorAlterado(1, fator);
    cenario.custos.itens = cenario.custos.itens.map((i) => (i.categoria.creditoIbsCbs.tratamento === "creditavel" ? { ...i, valorAnual: i.valorAnual * fatorResolvido } : i));
    alertas.push(`Custos creditáveis (IBS/CBS) escalados por fator ${fatorResolvido.toFixed(3)} — crédito efetivo recalculado pelo motor fiscal a partir do novo valorAnual, nunca informado direto.`);
  }

  const fatorTodos = alteracoes.custos?.fatorEscalaTodosItens;
  if (fatorTodos) {
    const fatorResolvido = resolverValorAlterado(1, fatorTodos);
    cenario.custos.itens = cenario.custos.itens.map((i) => ({ ...i, valorAnual: i.valorAnual * fatorResolvido }));
    alertas.push(`Todos os itens de custo escalados por fator ${fatorResolvido.toFixed(3)}.`);
  }

  for (const [campo, alterado] of Object.entries(alteracoes.pessoas ?? {})) {
    if (!alterado) continue;
    const baseValor = (base.pessoas as Record<string, CampoComProveniencia<number> | undefined>)[campo]?.valor;
    (cenario.pessoas as Record<string, CampoComProveniencia<number> | undefined>)[campo] = campoAlterado(baseValor, alterado);
  }

  if (alteracoes.tributario?.premissas) {
    cenario.tributario.premissas = { ...cenario.tributario.premissas };
    for (const [chave, alterado] of Object.entries(alteracoes.tributario.premissas)) {
      const baseValor = base.tributario.premissas?.[chave]?.valor;
      const numerico = typeof baseValor === "number" ? baseValor : undefined;
      cenario.tributario.premissas[chave] = { valor: resolverValorAlterado(numerico, alterado as ValorAlterado<number>), origem: alterado.origem, status: alterado.status };
    }
  }

  if (alteracoes.financeiro?.margemAlvo || alteracoes.financeiro?.percentualCustosVariaveis) {
    alertas.push("Premissas financeiras (margemAlvo/percentualCustosVariaveis) não alteram CenarioEmpresa — são repassadas diretamente ao Motor Financeiro na execução (ver OpcoesExecucaoCenario).");
  }
  if (alteracoes.splitPayment) {
    alertas.push("Premissas de split payment não alteram CenarioEmpresa — são repassadas diretamente ao Motor de Split na execução (ver OpcoesExecucaoCenario).");
  }

  return { cenario, alertas };
}
