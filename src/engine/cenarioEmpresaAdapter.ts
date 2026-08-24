/**
 * Adapter CenarioEmpresa → SimulacaoInput — preserva `calculo.ts` intocado
 * (seção 14/15 do pedido). Não migra nada: `simular()` continua recebendo
 * exatamente o `SimulacaoInput` de sempre; este módulo só traduz o
 * contrato novo (mais amplo, multiatividade, qualquer setor) para o
 * contrato antigo (específico do Motor VGR atual, 4 perfis legados).
 *
 * Nunca inventa dado ausente: quando um campo obrigatório de
 * `SimulacaoInput` não pode ser derivado do `CenarioEmpresa`, o adapter
 * devolve os campos faltantes em vez de um valor padrão silencioso.
 */

import type { CenarioEmpresa } from "./cenarioEmpresa";
import type { SimulacaoInput } from "./types";
import type { PerfilAtividade } from "./atividades";
import { agregarCreditoPorSistema } from "./creditoTributario";

export type ResultadoAdapterSimulacaoInput = { ok: true; input: SimulacaoInput } | { ok: false; camposFaltantes: string[] };

/** Só os 4 perfis que `calculo.ts` de fato trata de forma diferenciada (reduções específicas) — qualquer outro perfilId da nova taxonomia cai em `perfil: undefined`, que é um valor válido (fallback genérico), não um erro. */
const PERFIS_LEGADOS: ReadonlySet<PerfilAtividade> = new Set(["produtor_rural", "aviacao_agricola", "transporte_rodoviario_cargas", "construcao_civil"]);

function comoPerfilLegado(perfilId: string | undefined): PerfilAtividade | undefined {
  return perfilId && PERFIS_LEGADOS.has(perfilId as PerfilAtividade) ? (perfilId as PerfilAtividade) : undefined;
}

/**
 * Converte um CenarioEmpresa em SimulacaoInput, quando os dados mínimos
 * exigidos pelo Motor VGR atual estiverem presentes. `percentualCustosCreditaveis`
 * (e suas variantes por sistema) são DERIVADOS de `custos.itens` via
 * `agregarCreditoPorSistema` — nunca digitados de novo, mesma disciplina
 * já usada por `CustosDespesasStep.tsx`.
 */
export function cenarioParaSimulacaoInput(cenario: CenarioEmpresa): ResultadoAdapterSimulacaoInput {
  const faltantes: string[] = [];

  const nomeEmpresa = cenario.identificacao.nomeEmpresa?.valor;
  if (!nomeEmpresa) faltantes.push("identificacao.nomeEmpresa");

  const regimeAtual = cenario.tributario.regimeAtual?.valor;
  if (!regimeAtual) faltantes.push("tributario.regimeAtual");

  const faturamentoAnual = cenario.receita.faturamentoAnual?.valor;
  if (faturamentoAnual === undefined) faltantes.push("receita.faturamentoAnual");

  const pisCofinsPercentualAtual = cenario.tributario.premissas?.pisCofinsPercentualAtual?.valor;
  if (typeof pisCofinsPercentualAtual !== "number") faltantes.push("tributario.premissas.pisCofinsPercentualAtual");

  const icmsIpiPercentualAtual = cenario.tributario.premissas?.icmsIpiPercentualAtual?.valor;
  if (typeof icmsIpiPercentualAtual !== "number") faltantes.push("tributario.premissas.icmsIpiPercentualAtual");

  const percentualClienteContribuinte = cenario.receita.mixMercado?.b2b?.valor;
  const percentualClienteNaoContribuinte = cenario.receita.mixMercado?.b2c?.valor;
  if (percentualClienteContribuinte === undefined || percentualClienteNaoContribuinte === undefined) {
    faltantes.push("receita.mixMercado.b2b/b2c");
  }

  const meioPagamentoPredominante = cenario.economicoFinanceiro.meioPagamentoPredominante?.valor;
  if (!meioPagamentoPredominante) faltantes.push("economicoFinanceiro.meioPagamentoPredominante");

  if (faltantes.length > 0) return { ok: false, camposFaltantes: faltantes };

  const agregacaoAtual = agregarCreditoPorSistema(cenario.custos.itens, "pisCofins", faturamentoAnual!);
  const agregacaoIcmsIpi = agregarCreditoPorSistema(cenario.custos.itens, "icmsIpi", faturamentoAnual!);
  const agregacaoNovo = agregarCreditoPorSistema(cenario.custos.itens, "ibsCbs", faturamentoAnual!);
  const percentualCustosCreditaveisSistemaAtual = (agregacaoAtual.percentualCreditavel + agregacaoIcmsIpi.percentualCreditavel) / 2;

  const perfilId = cenario.identificacao.atividadePrincipal?.perfilId;

  const input: SimulacaoInput = {
    nomeEmpresa: nomeEmpresa!,
    perfil: comoPerfilLegado(perfilId),
    regimeAtual: regimeAtual!,
    faturamentoAnual: faturamentoAnual!,
    pisCofinsPercentualAtual: pisCofinsPercentualAtual as number,
    icmsIpiPercentualAtual: icmsIpiPercentualAtual as number,
    percentualCustosCreditaveis: percentualCustosCreditaveisSistemaAtual,
    percentualCustosCreditaveisSistemaAtual,
    percentualCustosCreditaveisNovoSistema: agregacaoNovo.percentualCreditavel,
    perfilClientes: { percentualClienteContribuinte: percentualClienteContribuinte!, percentualClienteNaoContribuinte: percentualClienteNaoContribuinte! },
    meioPagamentoPredominante: meioPagamentoPredominante!,
  };

  return { ok: true, input };
}
