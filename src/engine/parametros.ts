import parametrosJson from "../../config/parametros.json";

export interface Parametros {
  versao: string;
  fontes: { descricao: string; url: string }[];
  notaImportante: string;
  anos: {
    inicioTeste: number;
    inicioDestaqueObrigatorioNFe: string;
    inicioCobrancaEfetiva: number;
    inicioJanelaOpcaoHibrido: string;
    inicioTransicaoIcmsIss: number;
    fimTransicaoIcmsIss: number;
    sistemaPleno: number;
  };
  aliquotas: {
    cbs: Record<string, number>;
    ibs: Record<string, number>;
    reducaoInsumoAgropecuario: number;
    aliquotaChefeReferenciaPlena2033: { cbs: number; ibs: number };
  };
  simplesNacional: {
    unificado: {
      descricao: string;
      percentualCreditoRepassadoPorAnexo: Record<string, number>;
    };
    hibrido: {
      descricao: string;
      percentualCreditoRepassado: number;
      custoComplianceAdicionalMensal: number;
      custoComplianceAdicionalPercentualFaturamento: number;
      janelaOpcao: string;
      fracaoDasReferenteIbsCbs: number;
    };
  };
  produtorRural: {
    limiteReceitaAnualNaoContribuinte: number;
    correcaoAnual: string;
    creditoPresumidoComprasDeNaoContribuinte: number;
  };
  aviacaoAgricola: {
    tratamentoServico: string;
    reducaoAliquotaServicoPulverizacao: number;
  };
  construcaoCivil: {
    reducaoAliquotaVendaIncorporacao: number;
    reducaoAliquotaLocacao: number;
    reducaoAliquotaEmpreitada: number;
  };
  splitPayment: {
    fase1DataInicio: string;
    meiosPagamentoFase1: string[];
    meiosPagamentoFaseFutura: string[];
    prazoMedioRecebimentoAtualDias: Record<string, number>;
  };
}

export const parametros = parametrosJson as unknown as Parametros;

export const ANOS_SIMULACAO = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

export function aliquotaCbs(ano: number): number {
  return parametros.aliquotas.cbs[String(ano)] ?? parametros.aliquotas.cbs["2033"];
}

export function aliquotaIbs(ano: number): number {
  return parametros.aliquotas.ibs[String(ano)] ?? parametros.aliquotas.ibs["2033"];
}
