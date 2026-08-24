/**
 * Qualidade da base fiscal — nunca falsa precisão (seção 9/10 do
 * pedido). Ausência de ajustes NÃO significa ausência real de ajustes;
 * isso precisa ficar explícito no resultado, não escondido atrás de um
 * número.
 */

export type QualidadeBaseFiscal = "completa" | "parcial" | "estimada" | "insuficiente";

export interface AvaliacaoQualidadeBaseFiscal {
  qualidade: QualidadeBaseFiscal;
  motivo: string;
}

export function avaliarQualidadeBaseFiscal(lucroContabilDisponivel: boolean, lucroContabilEstimado: boolean, ajustesInformados: boolean): AvaliacaoQualidadeBaseFiscal {
  if (!lucroContabilDisponivel) {
    return { qualidade: "insuficiente", motivo: "Lucro contábil não informado — base fiscal não pode ser formada." };
  }
  if (lucroContabilEstimado) {
    return { qualidade: "estimada", motivo: "Lucro contábil é uma projeção/estimativa, não um valor real apurado (ECD/balancete)." };
  }
  if (!ajustesInformados) {
    return { qualidade: "parcial", motivo: "Nenhum ajuste fiscal (adição/exclusão) foi informado — isso NÃO significa que a empresa não os tenha; o resultado reflete só o lucro contábil, sem qualquer ajuste conhecido." };
  }
  return { qualidade: "completa", motivo: "Lucro contábil confirmado e ajustes fiscais informados para o período." };
}
