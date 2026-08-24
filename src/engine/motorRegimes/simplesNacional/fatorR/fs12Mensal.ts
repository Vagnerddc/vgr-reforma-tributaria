/**
 * FS12 rolante mês a mês — mesma matemática de janela móvel de 12 meses
 * já usada em rbt12.ts, aplicada à folha em vez da receita. Implementado
 * como módulo PRÓPRIO (não uma generalização de rbt12.ts) de propósito:
 * evita acoplar o cálculo já testado de RBT12 a uma reestruturação
 * genérica só para reuso — risco maior que o benefício nesta fase.
 *
 * Início de atividade: a proporcionalização aqui é estruturalmente igual
 * à da RBT12, mas o fundamento legal específico para proporcionalizar a
 * FS12 (em vez de só a RBT12) NÃO foi confirmado com segurança nesta
 * fase — por isso, o resultado para o ano de abertura é retornado com
 * `status: "estimado"` e uma metodologia que sinaliza essa incerteza; a
 * decisão de tratar o Fator R como indeterminado nesse caso é tomada em
 * fatorR.ts, não aqui (ver docs/motor-fator-r.md, seção E).
 */

import type { StatusInformacao } from "../../../operacaoTributaria";

export interface Fs12Mensal {
  mes: number;
  fs12: number;
  status: StatusInformacao;
  metodologia: string;
}

interface DataAbertura {
  ano: number;
  mes: number;
}

function parseDataAbertura(data: string | undefined): DataAbertura | undefined {
  if (!data) return undefined;
  const m = /^(\d{4})-(\d{2})/.exec(data);
  if (!m) return undefined;
  return { ano: parseInt(m[1], 10), mes: parseInt(m[2], 10) };
}

export function calcularFs12MensalDoAno(fs12AnualAtual: number, fs12AnualAnterior: number | undefined, dataAberturaTexto: string | undefined, ano: number): Fs12Mensal[] {
  const abertura = parseDataAbertura(dataAberturaTexto);

  if (abertura && abertura.ano === ano) {
    const mesesAtivos = 13 - abertura.mes;
    const fs12Proporcional = mesesAtivos > 0 ? (fs12AnualAtual / mesesAtivos) * 12 : fs12AnualAtual;
    const meses: Fs12Mensal[] = [];
    for (let mes = abertura.mes; mes <= 12; mes++) {
      meses.push({
        mes,
        fs12: fs12Proporcional,
        status: "estimado",
        metodologia: `Início de atividade — FS12 proporcionalizada por analogia à regra da RBT12 (LC 123/2006, art. 3º, §2º); fundamento específico para FS12 não confirmado nesta fase.`,
      });
    }
    return meses;
  }

  const mensalAtual = fs12AnualAtual / 12;
  const semDadoAnoAnterior = fs12AnualAnterior === undefined;
  const mensalAnterior = fs12AnualAnterior !== undefined ? fs12AnualAnterior / 12 : mensalAtual;

  const metodologia = semDadoAnoAnterior
    ? "Sem folha do ano anterior disponível — FS12 aproximada pela folha do próprio ano (primeiro ano simulado), constante nos 12 meses."
    : "FS12 rolante: mesma janela móvel de 12 meses usada na RBT12, aplicada à folha — médias mensais são premissas de distribuição uniforme, não série real.";

  const meses: Fs12Mensal[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const fs12 = (12 - mes) * mensalAnterior + mes * mensalAtual;
    meses.push({ mes, fs12, status: "estimado", metodologia });
  }
  return meses;
}
