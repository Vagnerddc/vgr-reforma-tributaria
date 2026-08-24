/**
 * MotorLucroPresumido — primeiro MotorRegime real (seções 1/36 do
 * pedido). Calcula o que é próprio do regime (IRPJ/adicional/CSLL, por
 * atividade, respeitando multiatividade e periodicidade trimestral) e
 * REAPROVEITA o Motor VGR existente (calculo.ts, via
 * cenarioParaSimulacaoInput + simular()) para IBS/CBS — nunca duplica
 * esse cálculo. PIS/COFINS/ICMS legados NÃO são expostos como
 * componentes nesta fase (ver docs/motor-lucro-presumido.md, seção I):
 * `calculo.ts` só devolve um valor combinado (pisCofinsProjetado), sem
 * segregação confiável entre os dois tributos — inventar uma proporção
 * violaria a regra de nunca fabricar dado ausente.
 */

import { ANOS_SIMULACAO } from "../../parametros";
import { buscarPerfil } from "../../setores/catalogo";
import { cenarioParaSimulacaoInput } from "../../cenarioEmpresaAdapter";
import { simular } from "../../calculo";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { ResultadoAno } from "../../types";
import type { MotorRegime, ResultadoAnoRegime, ResultadoAtividadeRegime, ResultadoRegime, ValorComponenteTributario, ComponenteTributario } from "../tipos";
import { resolverAtividadesComReceita } from "../receitaPorAtividade";
import { avaliarElegibilidadePresumido } from "./elegibilidade";
import { inferirNaturezaTributaria } from "./naturezaReceita";
import { calcularIrpjCsllAnual } from "./irpjCsll";

/** Consolida componentes de mesmo tipo somando valor/base; aliquota só é preservada quando todas as entradas concordam (evita uma "aliquota consolidada" sem sentido em multiatividade heterogênea). */
function consolidarComponentes(entradas: ValorComponenteTributario[]): ValorComponenteTributario[] {
  const porComponente = new Map<ComponenteTributario, ValorComponenteTributario[]>();
  for (const e of entradas) {
    if (!porComponente.has(e.componente)) porComponente.set(e.componente, []);
    porComponente.get(e.componente)!.push(e);
  }

  const consolidado: ValorComponenteTributario[] = [];
  for (const [componente, grupo] of porComponente) {
    if (grupo.length === 1) {
      consolidado.push(grupo[0]);
      continue;
    }
    const aliquotaComum = grupo.every((g) => g.aliquota === grupo[0].aliquota) ? grupo[0].aliquota : undefined;
    const baseTotal = grupo.every((g) => g.base !== undefined) ? grupo.reduce((s, g) => s + (g.base ?? 0), 0) : undefined;
    consolidado.push({
      componente,
      valor: grupo.reduce((s, g) => s + g.valor, 0),
      base: baseTotal,
      aliquota: aliquotaComum,
      regraAplicada: `consolidado de ${grupo.length} atividades`,
      status: grupo.some((g) => g.status === "estimado") ? "estimado" : grupo[0].status,
    });
  }
  return consolidado;
}

export const motorLucroPresumido: MotorRegime = {
  regime: "lucro_presumido",

  avaliarElegibilidade: avaliarElegibilidadePresumido,

  calcular(cenario: CenarioEmpresa, elegibilidade): ResultadoRegime {
    const alertas: string[] = [];
    const { atividades, alertas: alertasReceita } = resolverAtividadesComReceita(cenario);
    alertas.push(...alertasReceita);

    if (!cenario.receita.crescimentoAnualEstimado) {
      alertas.push("Sem taxa de crescimento informada — receita mantida constante de 2026 a 2033 (premissa, não dado real).");
    }
    const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;

    // 1 entrada por atividade: componentes fiscais próprios do Presumido, já por ano.
    const porAtividade: ResultadoAtividadeRegime[] = [];
    for (const atividade of atividades) {
      const perfil = buscarPerfil(atividade.perfilId);
      if (!perfil) {
        alertas.push(`Perfil "${atividade.perfilId}" não encontrado no catálogo — atividade não calculada.`);
        continue;
      }
      const natureza = inferirNaturezaTributaria(perfil);
      if (natureza === "indeterminada") {
        alertas.push(`Natureza tributária da receita não determinada para "${perfil.segmento}" — regra de presunção não modelada nesta fase para este arquétipo.`);
        continue;
      }

      const anos: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
        const receitaDoAno = atividade.receitaAnualBase * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
        const { componentes } = calcularIrpjCsllAnual(receitaDoAno, natureza);
        return { ano, disponivel: true, componentes, cargaTotal: componentes.reduce((s, c) => s + c.valor, 0) };
      });
      porAtividade.push({ perfilId: atividade.perfilId, anos });
    }

    // IBS/CBS: reaproveita o Motor VGR (calculo.ts) — só no nível consolidado da empresa,
    // porque calculo.ts não segmenta por atividade (limitação documentada, não resolvida aqui).
    const adaptado = cenarioParaSimulacaoInput(cenario);
    let resultadoVgrPorAno: Map<number, ResultadoAno> | undefined;
    if (adaptado.ok) {
      const resultadoVgr = simular(adaptado.input);
      resultadoVgrPorAno = new Map(resultadoVgr.anos.map((a) => [a.ano, a]));
    } else {
      alertas.push(`IBS/CBS não calculado — dados insuficientes para o Motor VGR: ${adaptado.camposFaltantes.join(", ")}.`);
    }
    alertas.push("PIS/COFINS e ICMS/ISS legados não são apresentados como componentes nesta fase — calculo.ts não os segrega de forma auditável (ver limitações).");

    // Consolidação por ano: soma dos componentes de todas as atividades + IBS/CBS reaproveitado.
    const anosConsolidados: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
      const componentesDoAno = porAtividade.flatMap((a) => a.anos.find((r) => r.ano === ano)?.componentes ?? []);
      const resultadoVgrDoAno = resultadoVgrPorAno?.get(ano);
      if (resultadoVgrDoAno) {
        componentesDoAno.push({ componente: "cbs", valor: resultadoVgrDoAno.efetivoCbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
        componentesDoAno.push({ componente: "ibs", valor: resultadoVgrDoAno.efetivoIbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
      }
      const consolidados = consolidarComponentes(componentesDoAno);
      return { ano, disponivel: porAtividade.length > 0, componentes: consolidados, cargaTotal: consolidados.reduce((s, c) => s + c.valor, 0), resultadoAnoVgrOrigem: resultadoVgrDoAno };
    });

    const cargaTotalPeriodo = anosConsolidados.filter((a) => a.disponivel).reduce((s, a) => s + a.cargaTotal, 0);
    const componentesConsolidados: Partial<Record<ComponenteTributario, number>> = {};
    for (const ano of anosConsolidados) {
      for (const c of ano.componentes) componentesConsolidados[c.componente] = (componentesConsolidados[c.componente] ?? 0) + c.valor;
    }

    const totalComponentes = anosConsolidados.flatMap((a) => a.componentes);
    const percentualConfirmado = totalComponentes.length > 0 ? (100 * totalComponentes.filter((c) => c.status === "confirmado").length) / totalComponentes.length : 0;
    const origensIbsCbs = new Set(totalComponentes.filter((c) => c.componente === "ibs" || c.componente === "cbs").map((c) => c.origemCalculo));
    const origemIbsCbs = origensIbsCbs.size === 0 ? "nao_aplicavel" : origensIbsCbs.size > 1 ? "misto" : ([...origensIbsCbs][0] ?? "nao_aplicavel");

    return {
      regime: "lucro_presumido",
      aplicabilidade: elegibilidade,
      anos: anosConsolidados,
      porAtividade: porAtividade.length > 1 ? porAtividade : undefined,
      cargaTotalPeriodo,
      componentesConsolidados,
      premissas: {
        crescimentoAnualEstimado: cenario.receita.crescimentoAnualEstimado ?? { valor: 0, origem: "classificacao_vgr", status: "estimado" },
      },
      qualidade: { percentualConfirmado, origemIbsCbs },
      alertas,
      memoria: [`Lucro Presumido calculado para ${porAtividade.length} atividade(s) com receita segregada, de um total de ${atividades.length} avaliada(s).`],
    };
  },
};
