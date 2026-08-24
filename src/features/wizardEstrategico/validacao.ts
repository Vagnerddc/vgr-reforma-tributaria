/**
 * Validação e conversão do rascunho. Não duplica validação de domínio
 * — o domínio (`engine/cenarioEmpresa.ts`) não possui um validador de
 * `CenarioEmpresa` completo (só `validarDadosSetoriais` e
 * `avaliarCompletudeCenario`, que mede presença, não corretude); as
 * regras aqui são específicas da experiência de captura do Wizard V2
 * (bloqueios estruturais e ressalvas materiais), nunca fórmulas fiscais.
 */
import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import type { RascunhoCenarioEmpresa } from "./tipos";

const TOLERANCIA_RECONCILIACAO = 0.01;

export type QualidadeArea = "confirmado" | "estimado" | "indeterminado" | "parcial" | "nao_informado";

export interface ResultadoValidacaoRascunho {
  valido: boolean;
  bloqueios: string[];
  ressalvas: string[];
  qualidadePorArea: Record<string, QualidadeArea>;
}

function qualidadeDeStatus(status: string[]): QualidadeArea {
  if (status.length === 0) return "nao_informado";
  const unicos = new Set(status);
  if (unicos.size === 1) return status.values().next().value as QualidadeArea;
  return "parcial";
}

function calcularQualidadePorArea(rascunho: RascunhoCenarioEmpresa): Record<string, QualidadeArea> {
  const empresa = [rascunho.identificacao.nomeEmpresa?.status, rascunho.identificacao.uf?.status, rascunho.identificacao.municipio?.status, rascunho.identificacao.dataAberturaEmpresa?.status].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const atividades = [rascunho.identificacao.atividadePrincipal?.status, ...(rascunho.identificacao.atividadesSecundarias ?? []).map((a) => a.status)].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const receita = [rascunho.receita.faturamentoAnual?.status, ...Object.values(rascunho.receita.receitaPorAtividade ?? {}).map((c) => c.status)].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const custosCreditos: string[] = [];
  for (const item of rascunho.custos.itens) {
    for (const tratamento of [item.categoria.creditoPisCofins, item.categoria.creditoIcmsIpi, item.categoria.creditoIbsCbs]) {
      custosCreditos.push(tratamento.tratamento === "indeterminado" ? "indeterminado" : tratamento.status);
    }
  }

  const pessoasFs12 = [rascunho.pessoas.folhaAnual?.status, rascunho.pessoas.encargosAnual?.status, rascunho.pessoas.proLaboreAnual?.status].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const fiscal = [rascunho.tributario.regimeAtual?.status, ...(rascunho.tributario.ajustesFiscais ?? []).map((a) => a.status), rascunho.tributario.saldosPrejuizoAnteriores?.irpj?.status, rascunho.tributario.saldosPrejuizoAnteriores?.csll?.status].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const caixa = rascunho.analisarCaixa
    ? [rascunho.premissasSplit?.percentualRecebimentosSujeitos?.status, rascunho.premissasSplit?.percentualTributoSegregado?.status, rascunho.premissasSplit?.taxaCustoCapitalMensal?.status].filter((s): s is NonNullable<typeof s> => Boolean(s))
    : [];

  const premissas: QualidadeArea = rascunho.otimizacao.habilitada && rascunho.otimizacao.variaveis.length > 0 ? "confirmado" : rascunho.otimizacao.habilitada || rascunho.pontosVirada.length > 0 ? "parcial" : "nao_informado";

  return {
    Empresa: qualidadeDeStatus(empresa),
    Atividades: qualidadeDeStatus(atividades),
    Receita: qualidadeDeStatus(receita),
    "Custos/Créditos": qualidadeDeStatus(custosCreditos),
    "Pessoas/FS12": qualidadeDeStatus(pessoasFs12),
    Fiscal: qualidadeDeStatus(fiscal),
    Caixa: rascunho.analisarCaixa ? qualidadeDeStatus(caixa) : "nao_informado",
    Premissas: premissas,
  };
}

export function validarRascunho(rascunho: RascunhoCenarioEmpresa): ResultadoValidacaoRascunho {
  const bloqueios: string[] = [];
  const ressalvas: string[] = [];

  const faturamento = rascunho.receita.faturamentoAnual?.valor;
  if (faturamento === undefined) {
    bloqueios.push("Receita ausente — informe o faturamento anual para simular.");
  } else if (faturamento < 0) {
    bloqueios.push("Faturamento anual não pode ser negativo.");
  }

  const entradasAtividade = Object.values(rascunho.receita.receitaPorAtividade ?? {});
  if (entradasAtividade.length > 0 && faturamento !== undefined) {
    const somaAtividades = entradasAtividade.reduce((acc, c) => acc + c.valor, 0);
    const diferenca = Math.abs(somaAtividades - faturamento);
    if (faturamento === 0 ? somaAtividades !== 0 : diferenca / faturamento > TOLERANCIA_RECONCILIACAO) {
      bloqueios.push(`Receita total informada (${faturamento}) diverge da soma das atividades (${somaAtividades}) — ajuste antes de simular.`);
    }
  }

  if (rascunho.regimesSelecionados.length === 0) {
    bloqueios.push("Selecione ao menos um regime para comparar.");
  }

  for (const item of rascunho.custos.itens) {
    if (item.valorAnual < 0) bloqueios.push(`Valor anual negativo em "${item.categoria.label}".`);
  }

  const fs12Ausente = rascunho.pessoas.folhaAnual === undefined && rascunho.pessoas.encargosAnual === undefined && rascunho.pessoas.proLaboreAnual === undefined;
  if (fs12Ausente) {
    ressalvas.push("FS12 não informada — Fator R poderá ficar indeterminado.");
  }

  if (!rascunho.analisarCaixa) {
    ressalvas.push("Split não configurado — impacto de caixa não será calculado.");
  } else if (!rascunho.premissasSplit) {
    ressalvas.push("Split habilitado, mas nenhuma premissa foi informada — impacto de caixa poderá ficar indisponível.");
  }

  if (rascunho.regimesSelecionados.includes("lucro_real")) {
    const semAjustes = !rascunho.tributario.ajustesFiscais || rascunho.tributario.ajustesFiscais.length === 0;
    const semSaldos = !rascunho.tributario.saldosPrejuizoAnteriores;
    if (semAjustes || semSaldos) {
      ressalvas.push("Lucro Real com dados parciais — ajustes fiscais e/ou saldos de prejuízo anteriores não informados.");
    }
  }

  if (rascunho.otimizacao.habilitada && rascunho.otimizacao.variaveis.length === 0) {
    ressalvas.push("Otimização habilitada sem variáveis configuradas — nenhum limite foi presumido.");
  }

  return { valido: bloqueios.length === 0, bloqueios, ressalvas, qualidadePorArea: calcularQualidadePorArea(rascunho) };
}

export interface CenarioComOrigem {
  cenario: CenarioEmpresa;
  origemCenario: "wizard_v2";
}

/** Conversão pura — nunca muta o rascunho recebido. */
export function converterRascunhoParaCenario(rascunho: RascunhoCenarioEmpresa): CenarioComOrigem {
  return {
    cenario: {
      id: rascunho.id,
      identificacao: structuredClone(rascunho.identificacao),
      receita: structuredClone(rascunho.receita),
      custos: structuredClone(rascunho.custos),
      pessoas: structuredClone(rascunho.pessoas),
      tributario: structuredClone(rascunho.tributario),
      economicoFinanceiro: structuredClone(rascunho.economicoFinanceiro),
      dadosSetoriais: structuredClone(rascunho.dadosSetoriais),
    },
    origemCenario: "wizard_v2",
  };
}
