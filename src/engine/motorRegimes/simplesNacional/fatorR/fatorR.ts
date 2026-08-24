/**
 * Decisão do Fator R — mês a mês (LC 123/2006, art. 18, §§5º-J a 5º-M):
 * Fator R = FS12 ÷ RBT12; ≥ 28% → Anexo III; < 28% → Anexo V. Preserva
 * tudo que a seção 19/28 do pedido exige: FS12, RBT12, decimal,
 * percentual, limite, decisão, distância, FS12 necessária/adicional —
 * nada é reduzido a só "anexo = III".
 */

import type { Rbt12Mensal } from "../rbt12";
import type { Fs12Mensal } from "./fs12Mensal";
import { LIMITE_FATOR_R } from "../normativa";
import type { StatusInformacao } from "../../../operacaoTributaria";

export interface FatorRMensal {
  mes: number;
  rbt12: number;
  fs12: number;
  fatorR: number;
  anexoResultante: "anexo_iii" | "anexo_v";
  /** Em pontos percentuais — positivo quando acima do limite (Anexo III), negativo quando abaixo (Anexo V). */
  distanciaLimitePp: number;
  fs12NecessariaParaLimite: number;
  /** 0 quando já está no limite ou acima (nunca negativo). */
  fs12AdicionalNecessaria: number;
  status: StatusInformacao;
}

export interface AlertaCodificado {
  codigo: "FATOR_R_INDETERMINADO" | "FS12_INCOMPLETA" | "HISTORICO_FOLHA_INSUFICIENTE" | "FATOR_R_PROXIMO_LIMITE";
  mensagem: string;
}

export type ResultadoFatorRAno = { disponivel: true; meses: FatorRMensal[]; alertas: AlertaCodificado[] } | { disponivel: false; alertas: AlertaCodificado[] };

/** Distância considerada "próxima" do limite, para o alerta informativo (seção 21 do pedido) — só sinalização, não uma segunda regra de decisão. */
const MARGEM_PROXIMIDADE_PP = 2;

/**
 * Precisão monetária/decimal (seção 9 do pedido): compara em CENTAVOS
 * (arredondado a 2 casas) antes de decidir III/V, para que 27,995% não
 * seja empurrado para 28% por erro de ponto flutuante, e vice-versa.
 */
function decidirAnexo(fatorR: number): "anexo_iii" | "anexo_v" {
  const fatorRArredondado = Math.round(fatorR * 100_00) / 100_00; // 4 casas decimais (0,01 pp)
  return fatorRArredondado >= LIMITE_FATOR_R.valor ? "anexo_iii" : "anexo_v";
}

export function calcularFatorRDoAno(rbt12PorMes: Rbt12Mensal[], fs12PorMes: Fs12Mensal[] | undefined, inicioDeAtividadeNoAno: boolean): ResultadoFatorRAno {
  if (inicioDeAtividadeNoAno) {
    return {
      disponivel: false,
      alertas: [{ codigo: "HISTORICO_FOLHA_INSUFICIENTE", mensagem: "Empresa em início de atividade — o fundamento normativo para proporcionalizar a FS12 (por analogia à RBT12) não foi confirmado com segurança nesta fase; Fator R não calculado para este ano." }],
    };
  }
  if (fs12PorMes === undefined) {
    return { disponivel: false, alertas: [{ codigo: "FATOR_R_INDETERMINADO", mensagem: "FS12 indeterminada — nenhum componente computável (folha, encargos, pró-labore) foi informado no cenário." }] };
  }

  const meses: FatorRMensal[] = rbt12PorMes.map(({ mes, rbt12, status: statusRbt12 }) => {
    const fs12Mes = fs12PorMes.find((f) => f.mes === mes)!;
    const fatorR = rbt12 > 0 ? fs12Mes.fs12 / rbt12 : 0;
    const anexoResultante = decidirAnexo(fatorR);
    const fs12NecessariaParaLimite = rbt12 * LIMITE_FATOR_R.valor;
    return {
      mes,
      rbt12,
      fs12: fs12Mes.fs12,
      fatorR,
      anexoResultante,
      distanciaLimitePp: (fatorR - LIMITE_FATOR_R.valor) * 100,
      fs12NecessariaParaLimite,
      fs12AdicionalNecessaria: Math.max(0, fs12NecessariaParaLimite - fs12Mes.fs12),
      status: statusRbt12 === "estimado" || fs12Mes.status === "estimado" ? "estimado" : statusRbt12,
    };
  });

  const alertas: AlertaCodificado[] = [];
  if (meses.some((m) => Math.abs(m.distanciaLimitePp) <= MARGEM_PROXIMIDADE_PP)) {
    alertas.push({ codigo: "FATOR_R_PROXIMO_LIMITE", mensagem: `O Fator R ficou a até ${MARGEM_PROXIMIDADE_PP} p.p. do limite de 28% em pelo menos um mês do ano — pequenas variações de folha ou receita podem mudar o anexo.` });
  }

  return { disponivel: true, meses, alertas };
}
