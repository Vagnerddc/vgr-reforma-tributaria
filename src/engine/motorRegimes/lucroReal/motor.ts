/**
 * MotorLucroReal — terceiro MotorRegime real. Diferença fundamental dos
 * outros dois (seção do princípio central do pedido): lucro contábil ≠
 * lucro tributável. Resultado CONSOLIDADO da empresa (nunca decomposto
 * por atividade — seção 22/23 do pedido: apuração de IRPJ/CSLL é
 * jurídica/empresarial, não replica a lógica por atividade do Presumido).
 * `calculo.ts` intocado — IBS/CBS reaproveitados do Motor VGR, mesmo
 * padrão dos outros dois motores.
 */

import { ANOS_SIMULACAO } from "../../parametros";
import { cenarioParaSimulacaoInput } from "../../cenarioEmpresaAdapter";
import { simular } from "../../calculo";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { MotorRegime, ResultadoAnoRegime, ResultadoRegime, ValorComponenteTributario, ComponenteTributario } from "../tipos";
import { avaliarElegibilidadeReal } from "./elegibilidade";
import { calcularBaseAjustada } from "./baseFiscal";
import { calcularIrpjCsllAnual } from "./irpjCsll";
import { avaliarQualidadeBaseFiscal } from "./qualidade";

export const motorLucroReal: MotorRegime = {
  regime: "lucro_real",

  avaliarElegibilidade: avaliarElegibilidadeReal,

  calcular(cenario: CenarioEmpresa, elegibilidade): ResultadoRegime {
    const alertas: string[] = [];
    const lucroAtual = cenario.economicoFinanceiro.lucroAtual;

    if (lucroAtual === undefined) {
      alertas.push("Lucro contábil (economicoFinanceiro.lucroAtual) não informado — base fiscal insuficiente, nenhum ano calculado.");
      const anosIndisponiveis: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => ({ ano, disponivel: false, componentes: [], cargaTotal: 0 }));
      return {
        regime: "lucro_real",
        aplicabilidade: elegibilidade,
        anos: anosIndisponiveis,
        cargaTotalPeriodo: 0,
        componentesConsolidados: {},
        premissas: {},
        qualidade: { percentualConfirmado: 0, origemIbsCbs: "nao_aplicavel" },
        alertas,
        memoria: ["Lucro Real não calculado — lucro contábil ausente."],
      };
    }

    if (!cenario.receita.crescimentoAnualEstimado) {
      alertas.push("Sem taxa de crescimento informada — lucro contábil mantido constante de 2026 a 2033 (premissa, não dado real).");
    }
    const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;
    const ajustesFiscais = cenario.tributario.ajustesFiscais;

    const avaliacaoQualidade = avaliarQualidadeBaseFiscal(true, lucroAtual.status === "estimado", (ajustesFiscais?.length ?? 0) > 0);
    alertas.push(`Qualidade da base fiscal: ${avaliacaoQualidade.qualidade} — ${avaliacaoQualidade.motivo}`);

    let saldoPrejuizoIrpj = cenario.tributario.saldosPrejuizoAnteriores?.irpj?.valor ?? 0;
    let saldoBaseNegativaCsll = cenario.tributario.saldosPrejuizoAnteriores?.csll?.valor ?? 0;

    const anos: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
      const lucroContabilDoAno = lucroAtual.valor * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
      const baseIrpj = calcularBaseAjustada(lucroContabilDoAno, ajustesFiscais, "irpj");
      const baseCsll = calcularBaseAjustada(lucroContabilDoAno, ajustesFiscais, "csll");

      const resultadoAno = calcularIrpjCsllAnual(baseIrpj.lucroLiquidoAjustado, baseCsll.lucroLiquidoAjustado, saldoPrejuizoIrpj, saldoBaseNegativaCsll);
      // Imutável: os saldos do PRÓXIMO ano vêm do retorno desta chamada — nunca mutamos saldoPrejuizoIrpj/saldoBaseNegativaCsll por referência dentro de calcularIrpjCsllAnual.
      saldoPrejuizoIrpj = resultadoAno.saldoPrejuizoIrpjFinal;
      saldoBaseNegativaCsll = resultadoAno.saldoBaseNegativaCsllFinal;

      return { ano, disponivel: true, componentes: resultadoAno.componentes, cargaTotal: resultadoAno.componentes.reduce((s, c) => s + c.valor, 0) };
    });

    const adaptado = cenarioParaSimulacaoInput({ ...cenario, tributario: { ...cenario.tributario, regimeAtual: { valor: "lucro_real", origem: "classificacao_vgr", status: "estimado" } } });
    if (adaptado.ok) {
      const resultadoVgr = simular(adaptado.input);
      const resultadoVgrPorAno = new Map(resultadoVgr.anos.map((a) => [a.ano, a]));
      for (const anoRegime of anos) {
        const resultadoVgrDoAno = resultadoVgrPorAno.get(anoRegime.ano);
        if (resultadoVgrDoAno) {
          anoRegime.componentes.push({ componente: "cbs", valor: resultadoVgrDoAno.efetivoCbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
          anoRegime.componentes.push({ componente: "ibs", valor: resultadoVgrDoAno.efetivoIbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
          anoRegime.cargaTotal += resultadoVgrDoAno.efetivoCbs + resultadoVgrDoAno.efetivoIbs;
          anoRegime.resultadoAnoVgrOrigem = resultadoVgrDoAno;
        }
      }
    } else {
      alertas.push(`IBS/CBS não calculado — dados insuficientes para o Motor VGR: ${adaptado.camposFaltantes.join(", ")}.`);
    }
    alertas.push("PIS/COFINS/ICMS/ISS não são decompostos em componentes independentes nesta fase — mesma limitação já registrada no Presumido/Simples (calculo.ts não os segrega de forma auditável).");
    if (avaliacaoQualidade.qualidade !== "completa") {
      alertas.push("cargaTotal reflete só os componentes calculados (IRPJ, adicional, CSLL, IBS/CBS reaproveitado) — NÃO é a carga tributária total definitiva enquanto ajustes fiscais completos não forem confirmados.");
    }

    const cargaTotalPeriodo = anos.reduce((s, a) => s + a.cargaTotal, 0);
    const componentesConsolidados: Partial<Record<ComponenteTributario, number>> = {};
    for (const ano of anos) for (const c of ano.componentes as ValorComponenteTributario[]) componentesConsolidados[c.componente] = (componentesConsolidados[c.componente] ?? 0) + c.valor;

    const totalComponentes = anos.flatMap((a) => a.componentes);
    const percentualConfirmado = totalComponentes.length > 0 ? (100 * totalComponentes.filter((c) => c.status === "confirmado").length) / totalComponentes.length : 0;
    const origensIbsCbs = new Set(totalComponentes.filter((c) => c.componente === "ibs" || c.componente === "cbs").map((c) => c.origemCalculo));
    const origemIbsCbs = origensIbsCbs.size === 0 ? "nao_aplicavel" : origensIbsCbs.size > 1 ? "misto" : ([...origensIbsCbs][0] ?? "nao_aplicavel");

    return {
      regime: "lucro_real",
      aplicabilidade: elegibilidade,
      anos,
      cargaTotalPeriodo,
      componentesConsolidados,
      premissas: {
        crescimentoAnualEstimado: cenario.receita.crescimentoAnualEstimado ?? { valor: 0, origem: "classificacao_vgr", status: "estimado" },
      },
      qualidade: { percentualConfirmado, origemIbsCbs },
      alertas,
      memoria: [`Lucro Real calculado por apuração trimestral. Qualidade da base fiscal: ${avaliacaoQualidade.qualidade}. Saldo de prejuízo fiscal final (2033): R$ ${saldoPrejuizoIrpj.toFixed(2)}. Saldo de base negativa CSLL final (2033): R$ ${saldoBaseNegativaCsll.toFixed(2)}.`],
    };
  },
};
