/**
 * Família obrigatória de qualidade de dados (seção 29/30 do pedido) —
 * quando um achado de qualidade insuficiente/parcial existe, a
 * validação é priorizada CONCEITUALMENTE antes de qualquer alternativa
 * conclusiva que dependa daquele dado (a ordenação real acontece em
 * motor.ts, não aqui).
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, type ContextoEstrategico } from "../contexto";

function alternativaValidacao(id: string, codigo: AlternativaEstrategica["codigo"], titulo: string, achadosOrigem: ReturnType<typeof achadosPorCodigo>, ano: number): AlternativaEstrategica | undefined {
  if (achadosOrigem.length === 0) return undefined;
  return {
    id,
    codigo,
    categoria: "qualidade_dados",
    titulo,
    objetivo: `${titulo} antes de qualquer alternativa conclusiva que dependa desses dados.`,
    descricaoTecnica: achadosOrigem.map((a) => a.descricaoTecnica).join(" "),
    achadosOrigem: achadosOrigem.map((a) => a.id),
    evidencias: achadosOrigem.flatMap((a) => a.evidencias),
    aplicabilidade: "aplicavel",
    condicoes: [],
    dependencias: [],
    restricoes: [],
    impactosConhecidos: [],
    impactosIndeterminados: ["resultado final após a validação/complementação dos dados"],
    cenariosRelacionados: [],
    pontosViradaRelacionados: [],
    periodosAplicaveis: [{ ano }],
    qualidade: "insuficiente",
    premissas: {},
    riscos: [{ tipo: "RISCO_DADOS", descricao: "Conclusões baseadas nesses dados podem mudar após a validação/complementação." }],
    bloqueios: [{ tipo: "dados_insuficientes", descricao: achadosOrigem[0].descricaoTecnica }],
    validacoesNecessarias: [{ tipo: "VALIDACAO_FISCAL", descricao: titulo, motivo: achadosOrigem[0].descricaoTecnica, bloqueante: true }],
    origens: achadosOrigem[0].origens,
    regime: achadosOrigem[0].regime,
  };
}

export function gerarValidacoesDeDados(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const achadosFiscaisInsuficientes = [...achadosPorCodigo(ctx, "DADOS_FISCAIS_INSUFICIENTES"), ...achadosPorCodigo(ctx, "CARGA_TRIBUTARIA_PARCIAL"), ...achadosPorCodigo(ctx, "CARGA_FISCAL_INCOMPLETA")];
  const achadosBaseReal = achadosPorCodigo(ctx, "BASE_LUCRO_REAL_PARCIAL");
  const achadosSplit = [...achadosPorCodigo(ctx, "DADOS_SPLIT_INSUFICIENTES"), ...achadosPorCodigo(ctx, "PREMISSA_SPLIT_NAO_CONFIRMADA")];
  const achadosComparabilidade = [...achadosPorCodigo(ctx, "REGIMES_NAO_COMPARAVEIS"), ...achadosPorCodigo(ctx, "COMPONENTE_MATERIAL_AUSENTE")];

  return [
    alternativaValidacao(`alternativa:VALIDAR_DADOS_FISCAIS:${ctx.ano}`, "VALIDAR_DADOS_FISCAIS", "Validar dados fiscais", achadosFiscaisInsuficientes, ctx.ano),
    alternativaValidacao(`alternativa:VALIDAR_BASE_LUCRO_REAL:${ctx.ano}`, "VALIDAR_BASE_LUCRO_REAL", "Validar base do Lucro Real", achadosBaseReal, ctx.ano),
    alternativaValidacao(`alternativa:VALIDAR_PREMISSAS_SPLIT:${ctx.ano}`, "VALIDAR_PREMISSAS_SPLIT", "Validar premissas de split payment", achadosSplit, ctx.ano),
    alternativaValidacao(`alternativa:VALIDAR_COBERTURA_TRIBUTARIA:${ctx.ano}`, "VALIDAR_COBERTURA_TRIBUTARIA", "Validar cobertura tributária entre regimes", achadosComparabilidade, ctx.ano),
  ].filter((a): a is AlternativaEstrategica => a !== undefined);
}
