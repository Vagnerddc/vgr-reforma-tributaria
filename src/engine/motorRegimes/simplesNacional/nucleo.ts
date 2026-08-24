/**
 * Núcleo geral do Simples Nacional — compartilhado entre
 * `motorSimplesUnificado` e `motorSimplesHibrido` (ver motor.ts). A
 * ÚNICA diferença entre os dois motores é qual `Regime` é carimbado no
 * resultado e passado ao Motor VGR para o componente IBS/CBS — a
 * apuração de RBT12/anexo/faixa/DAS em si é idêntica, porque é regra do
 * Simples Nacional em si, não da transição da reforma.
 *
 * Decisão de contrato (documentada, não uma extensão): "Simples
 * Nacional" como conceito normativo é implementado como DOIS
 * MotorRegime — não foi necessário adicionar um terceiro valor a
 * `Regime` (engine/types.ts) porque esse tipo já distingue
 * "simples_unificado"/"simples_hibrido" (a bifurcação já existe em
 * calculo.ts, motivada pela própria transição da reforma). Ver
 * docs/motor-simples-nacional.md, seção A.
 *
 * Fator R (docs/motor-fator-r.md): atividades classificadas como
 * "indeterminado_fator_r" por anexo.ts deixam de ser puladas — RBT12 e
 * FS12 são calculadas mês a mês e a decisão entre Anexo III/V é tomada
 * dinamicamente, por mês, por fatorR.ts. Nunca fixamos o anexo no início
 * do ano.
 */

import { ANOS_SIMULACAO } from "../../parametros";
import { buscarPerfil } from "../../setores/catalogo";
import { cenarioParaSimulacaoInput } from "../../cenarioEmpresaAdapter";
import { simular } from "../../calculo";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { Regime, ResultadoAno } from "../../types";
import type { AvaliacaoElegibilidade, ResultadoAnoRegime, ResultadoAtividadeRegime, ResultadoRegime, ValorComponenteTributario, ComponenteTributario } from "../tipos";
import { resolverAtividadesComReceita } from "../receitaPorAtividade";
import { classificarAnexo } from "./anexo";
import { calcularRbt12MensalDoAno } from "./rbt12";
import { calcularDasMensal, calcularDasMensalComFatorR, consolidarDasAnual, consolidarDasAnualComFatorR, atingiuFaixaComTributoSegregado } from "./das";
import type { AnexoSimplesNucleo } from "./normativa";
import { calcularFs12Anual } from "./fatorR/fs12";
import { calcularFs12MensalDoAno } from "./fatorR/fs12Mensal";
import { calcularFatorRDoAno } from "./fatorR/fatorR";

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
    consolidado.push({
      componente,
      valor: grupo.reduce((s, g) => s + g.valor, 0),
      base: grupo.every((g) => g.base !== undefined) ? grupo.reduce((s, g) => s + (g.base ?? 0), 0) : undefined,
      regraAplicada: `consolidado de ${grupo.length} atividades`,
      status: grupo.some((g) => g.status === "estimado") ? "estimado" : grupo[0].status,
    });
  }
  return consolidado;
}

export function calcularNucleoSimples(cenario: CenarioEmpresa, elegibilidade: AvaliacaoElegibilidade, regime: Regime): ResultadoRegime {
  const alertas: string[] = [];
  const { atividades, alertas: alertasReceita } = resolverAtividadesComReceita(cenario);
  alertas.push(...alertasReceita);

  if (!cenario.receita.crescimentoAnualEstimado) {
    alertas.push("Sem taxa de crescimento informada — receita mantida constante de 2026 a 2033 (premissa, não dado real).");
  }
  const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;

  const atividadesFixas: { perfilId: string; receitaAnualBase: number; anexo: AnexoSimplesNucleo }[] = [];
  const atividadesFatorR: { perfilId: string; receitaAnualBase: number }[] = [];
  for (const atividade of atividades) {
    const perfil = buscarPerfil(atividade.perfilId);
    if (!perfil) {
      alertas.push(`Perfil "${atividade.perfilId}" não encontrado no catálogo — atividade não calculada.`);
      continue;
    }
    const classificacao = classificarAnexo(perfil);
    if (classificacao.anexo === "indeterminado_fator_r") {
      atividadesFatorR.push({ perfilId: atividade.perfilId, receitaAnualBase: atividade.receitaAnualBase });
    } else if (classificacao.anexo === "indeterminado") {
      alertas.push(classificacao.motivo);
    } else {
      atividadesFixas.push({ perfilId: atividade.perfilId, receitaAnualBase: atividade.receitaAnualBase, anexo: classificacao.anexo });
    }
  }

  // RBT12 é da EMPRESA INTEIRA — soma de todas as atividades resolvíveis (fixas + dependentes de Fator R).
  function receitaTotalDoAno(ano: number): number {
    return [...atividadesFixas, ...atividadesFatorR].reduce((s, a) => s + a.receitaAnualBase * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]), 0);
  }

  const dataAbertura = cenario.identificacao.dataAberturaEmpresa?.valor;
  const fs12AnualResultado = calcularFs12Anual(cenario.pessoas);
  if (atividadesFatorR.length > 0) {
    if (fs12AnualResultado.valor === undefined) {
      alertas.push("FS12 indeterminada — nenhum componente computável (folha, encargos, pró-labore) foi informado; atividade(s) sujeitas a Fator R não calculadas.");
    } else if (fs12AnualResultado.componentesAusentes.length > 0) {
      alertas.push(`FS12 parcialmente informada (faltam: ${fs12AnualResultado.componentesAusentes.join(", ")}) — o valor usado pode estar subestimado.`);
    }
  }

  function fs12TotalDoAno(ano: number): number | undefined {
    if (fs12AnualResultado.valor === undefined) return undefined;
    return fs12AnualResultado.valor * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
  }

  const porAtividadeFixa: ResultadoAtividadeRegime[] = atividadesFixas.map((atividade) => {
    const anos: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
      const receitaTotalAtual = receitaTotalDoAno(ano);
      const receitaTotalAnterior = ano > ANOS_SIMULACAO[0] || dataAbertura ? receitaTotalDoAno(ano - 1) : undefined;
      const rbt12PorMes = calcularRbt12MensalDoAno(receitaTotalAtual, receitaTotalAnterior, dataAbertura, ano);

      const receitaAtividadeNoAno = atividade.receitaAnualBase * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
      const dasMensal = calcularDasMensal(rbt12PorMes, receitaAtividadeNoAno, atividade.anexo);
      const componenteDas = consolidarDasAnual(dasMensal, atividade.anexo);
      if (atingiuFaixaComTributoSegregado(dasMensal)) {
        alertas.push(`Atividade "${atividade.perfilId}" atingiu a faixa 6 em ${ano} — nessa faixa, o tributo indireto (ICMS/ISS/IPI, conforme o anexo) é recolhido SEPARADAMENTE do DAS (LC 123/2006, art. 18, §20); esse componente adicional não está incluído em "das" nem em "cargaTotal" deste resultado.`);
      }

      return { ano, disponivel: rbt12PorMes.length > 0, componentes: rbt12PorMes.length > 0 ? [componenteDas] : [], cargaTotal: rbt12PorMes.length > 0 ? componenteDas.valor : 0 };
    });
    return { perfilId: atividade.perfilId, anos };
  });

  const porAtividadeFatorR: ResultadoAtividadeRegime[] = atividadesFatorR.map((atividade) => {
    const anos: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
      const inicioDeAtividadeNoAno = !!dataAbertura && dataAbertura.startsWith(String(ano));
      const receitaTotalAtual = receitaTotalDoAno(ano);
      const receitaTotalAnterior = ano > ANOS_SIMULACAO[0] || dataAbertura ? receitaTotalDoAno(ano - 1) : undefined;
      const rbt12PorMes = calcularRbt12MensalDoAno(receitaTotalAtual, receitaTotalAnterior, dataAbertura, ano);

      const fs12Atual = fs12TotalDoAno(ano);
      const fs12Anterior = fs12TotalDoAno(ano - 1);
      const fs12PorMes = fs12Atual !== undefined ? calcularFs12MensalDoAno(fs12Atual, fs12Anterior, dataAbertura, ano) : undefined;

      const resultadoFatorR = calcularFatorRDoAno(rbt12PorMes, fs12PorMes, inicioDeAtividadeNoAno);
      for (const a of resultadoFatorR.alertas) alertas.push(`Atividade "${atividade.perfilId}", ${ano}: [${a.codigo}] ${a.mensagem}`);

      if (!resultadoFatorR.disponivel) {
        return { ano, disponivel: false, componentes: [], cargaTotal: 0 };
      }

      const receitaAtividadeNoAno = atividade.receitaAnualBase * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
      const dasMensal = calcularDasMensalComFatorR(resultadoFatorR.meses, receitaAtividadeNoAno);
      const componenteDas = consolidarDasAnualComFatorR(dasMensal, resultadoFatorR.meses);
      if (atingiuFaixaComTributoSegregado(dasMensal)) {
        alertas.push(`Atividade "${atividade.perfilId}" atingiu a faixa 6 em ${ano} — tributo indireto recolhido separadamente do DAS, não incluído neste resultado.`);
      }

      return { ano, disponivel: true, componentes: [componenteDas], cargaTotal: componenteDas.valor };
    });
    return { perfilId: atividade.perfilId, anos };
  });

  const porAtividade = [...porAtividadeFixa, ...porAtividadeFatorR];

  const adaptado = cenarioParaSimulacaoInput({ ...cenario, tributario: { ...cenario.tributario, regimeAtual: { valor: regime, origem: "classificacao_vgr", status: "estimado" } } });
  let resultadoVgrPorAno: Map<number, ResultadoAno> | undefined;
  if (adaptado.ok) {
    const resultadoVgr = simular(adaptado.input);
    resultadoVgrPorAno = new Map(resultadoVgr.anos.map((a) => [a.ano, a]));
  } else {
    alertas.push(`IBS/CBS não calculado — dados insuficientes para o Motor VGR: ${adaptado.camposFaltantes.join(", ")}.`);
  }
  alertas.push("PIS/COFINS/ICMS/ISS/CPP embutidos no DAS não são decompostos em componentes independentes nesta fase — a partilha varia por faixa/anexo e exigiria uma segunda tabela normativa completa (ver limitações).");

  const anosConsolidados: ResultadoAnoRegime[] = ANOS_SIMULACAO.map((ano) => {
    const componentesDoAno = porAtividade.flatMap((a) => a.anos.find((r) => r.ano === ano)?.componentes ?? []);
    const resultadoVgrDoAno = resultadoVgrPorAno?.get(ano);
    if (resultadoVgrDoAno) {
      componentesDoAno.push({ componente: "cbs", valor: resultadoVgrDoAno.efetivoCbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
      componentesDoAno.push({ componente: "ibs", valor: resultadoVgrDoAno.efetivoIbs, origemCalculo: "motor_vgr", status: "estimado", regraAplicada: "motor_vgr.calculo.ts" });
    }
    const consolidados = consolidarComponentes(componentesDoAno);
    return { ano, disponivel: porAtividade.some((a) => a.anos.find((r) => r.ano === ano)?.disponivel), componentes: consolidados, cargaTotal: consolidados.reduce((s, c) => s + c.valor, 0), resultadoAnoVgrOrigem: resultadoVgrDoAno };
  });

  const cargaTotalPeriodo = anosConsolidados.filter((a) => a.disponivel).reduce((s, a) => s + a.cargaTotal, 0);
  const componentesConsolidados: Partial<Record<ComponenteTributario, number>> = {};
  for (const ano of anosConsolidados) for (const c of ano.componentes) componentesConsolidados[c.componente] = (componentesConsolidados[c.componente] ?? 0) + c.valor;

  const totalComponentes = anosConsolidados.flatMap((a) => a.componentes);
  const percentualConfirmado = totalComponentes.length > 0 ? (100 * totalComponentes.filter((c) => c.status === "confirmado").length) / totalComponentes.length : 0;
  const origensIbsCbs = new Set(totalComponentes.filter((c) => c.componente === "ibs" || c.componente === "cbs").map((c) => c.origemCalculo));
  const origemIbsCbs = origensIbsCbs.size === 0 ? "nao_aplicavel" : origensIbsCbs.size > 1 ? "misto" : ([...origensIbsCbs][0] ?? "nao_aplicavel");

  return {
    regime,
    aplicabilidade: elegibilidade,
    anos: anosConsolidados,
    porAtividade: porAtividade.length > 1 ? porAtividade : undefined,
    cargaTotalPeriodo,
    componentesConsolidados,
    premissas: { crescimentoAnualEstimado: cenario.receita.crescimentoAnualEstimado ?? { valor: 0, origem: "classificacao_vgr", status: "estimado" } },
    qualidade: { percentualConfirmado, origemIbsCbs },
    alertas,
    memoria: [`Simples Nacional (${regime}) calculado para ${atividadesFixas.length + porAtividadeFatorR.filter((a) => a.anos.some((r) => r.disponivel)).length} atividade(s), de um total de ${atividades.length} avaliada(s) (${atividadesFatorR.length} dependiam de Fator R).`],
  };
}
