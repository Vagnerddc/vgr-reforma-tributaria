/**
 * Adapter isolado: `ClienteData` (pipeline legado — SPED/manual, ver
 * `ImportarSped.tsx`) → `CenarioEmpresa` (contrato do pipeline
 * estratégico). Existe só para permitir que a rota estratégica tenha
 * uma entrada real sem depender de fixture — NUNCA inventa dado
 * ausente (seção 20/23 do pedido). Campos que o legado não consegue
 * preencher (FS12/pessoas, premissas de split, itens de custo
 * classificados por crédito) ficam ausentes (`undefined`/array vazio),
 * nunca um valor estimado artificial.
 *
 * `CenarioEmpresa` nunca é reduzido para caber no legado (seção 23) —
 * é sempre o legado que se adapta ao contrato novo.
 */

import type { ClienteData } from "../../../context/ClienteDataContext";
import type { CenarioEmpresa } from "../../../engine/cenarioEmpresa";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";

export interface PerdaAdaptacaoLegado {
  campo: string;
  motivo: string;
}

export interface ResultadoAdapterLegado {
  cenario: CenarioEmpresa;
  perdas: PerdaAdaptacaoLegado[];
}

/**
 * Converte o `ClienteData` (contexto global do pipeline legado) num
 * `CenarioEmpresa`. Só produz um cenário quando `resultadoSimulacao`
 * (o `SimulacaoInput` já preenchido pelo wizard legado) existe — sem
 * ele, não há regime/faturamento/meio de pagamento confiáveis para
 * adaptar.
 */
export function adaptarClienteLegadoParaCenarioEmpresa(cliente: ClienteData): ResultadoAdapterLegado | undefined {
  const input = cliente.resultadoSimulacao?.input;
  if (!input) return undefined;

  const perdas: PerdaAdaptacaoLegado[] = [
    { campo: "pessoas.folhaAnual/encargosAnual/proLaboreAnual", motivo: "O pipeline legado (SPED/manual) não segrega folha de pagamento — não é possível calcular Fator R a partir desta entrada." },
    { campo: "custos.itens", motivo: "Despesas legadas (custoMercadoriaInsumo/despesaOperacional/...) não são classificadas por tratamento de crédito IBS/CBS por categoria — nenhum item de custo é sintetizado sem essa classificação." },
    { campo: "economicoFinanceiro.caixaDisponivel/capitalGiroNecessario/prazoMedioRecebimentoDias/prazoMedioPagamentoDias", motivo: "Não capturados pelo pipeline legado." },
    { campo: "tributario.saldosPrejuizoAnteriores/ajustesFiscais", motivo: "Não capturados pelo pipeline legado — Lucro Real ficará com base fiscal parcial quando aplicável." },
  ];

  const cenario: CenarioEmpresa = {
    id: `legado:${cliente.nomeEmpresa}`,
    identificacao: {
      nomeEmpresa: campo(cliente.nomeEmpresa, "informado_usuario", "confirmado"),
      atividadePrincipal: input.perfil ? { perfilId: input.perfil, status: "estimado", origem: "classificacao_vgr" } : undefined,
    },
    receita: {
      faturamentoAnual: campo(input.faturamentoAnual, "informado_usuario", "confirmado"),
      mixMercado: {
        b2b: campo(input.perfilClientes.percentualClienteContribuinte, "informado_usuario", "estimado"),
        b2c: campo(input.perfilClientes.percentualClienteNaoContribuinte, "informado_usuario", "estimado"),
      },
    },
    custos: { itens: [] },
    pessoas: {},
    tributario: {
      regimeAtual: campo(input.regimeAtual, "informado_usuario", "confirmado"),
      premissas: {
        pisCofinsPercentualAtual: campo(input.pisCofinsPercentualAtual, "informado_usuario", "estimado"),
        icmsIpiPercentualAtual: campo(input.icmsIpiPercentualAtual, "informado_usuario", "estimado"),
      },
    },
    economicoFinanceiro: {
      meioPagamentoPredominante: campo(input.meioPagamentoPredominante, "informado_usuario", "estimado"),
    },
    dadosSetoriais: [],
  };

  return { cenario, perdas };
}
