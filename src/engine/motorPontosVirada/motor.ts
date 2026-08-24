/**
 * Motor de Pontos de Virada — orquestra o Motor de Cenários
 * (`executarCenario`/`alteracaoParaVariavel`) e soluções analíticas
 * (`analitico.ts`); nenhuma fórmula fiscal/econômica/financeira própria
 * (seção 1 do pedido). "Em qual valor de X o resultado muda?" — nunca
 * "qual valor devemos escolher?".
 */

import { executarCenario } from "../motorCenarios/motor";
import { alteracaoParaVariavel } from "../motorCenarios/sensibilidade";
import { validarAlteracoes } from "../motorCenarios/patch";
import type { ResultadoCenario, OpcoesExecucaoCenario } from "../motorCenarios/tipos";
import { ANOS_SIMULACAO } from "../parametros";
import { amostrarIntervalo, detectarTransicoes, refinarBissecao, type PontoAmostra } from "./numerico";
import { calcularFs12NecessariaAnalitica, resolverAnaliticoMargem } from "./analitico";
import { menorCargaComparavelNoAno, anexoSimplesNoAno, statusJuridicoNoAno, resultadoEconomicoDoRegimeNoAno, custoFinanceiroDoRegimeNoAno, excedeuLimiteCapitalGiro } from "./estado";
import { precisaoPadrao, amostrasIniciaisPadrao, arredondarCentavos } from "./precisao";
import { gerarAchadosPontoVirada } from "./achados";
import type { DefinicaoPontoVirada, ResultadoPontoVirada, PontoDeViradaTemporal } from "./tipos";

function estadoParaPonto(a: PontoAmostra) {
  return { valor: a.valor, resultado: a.resultado, estadoCategorico: a.estado };
}

function extratorDeEstado(definicao: DefinicaoPontoVirada): (resultado: ResultadoCenario) => string | undefined {
  const ano = definicao.ano;
  switch (definicao.tipo) {
    case "mudanca_regime_menor_carga":
      return (r) => menorCargaComparavelNoAno(r, ano);
    case "mudanca_anexo_simples":
      return (r) => (definicao.regimeReferencia ? anexoSimplesNoAno(r, definicao.regimeReferencia, ano) : undefined);
    case "mudanca_elegibilidade":
      return (r) => (definicao.regimeReferencia ? statusJuridicoNoAno(r, definicao.regimeReferencia, ano) : undefined);
    case "limite_capital_giro":
      return (r) => {
        if (!definicao.regimeReferencia) return undefined;
        const excedeu = excedeuLimiteCapitalGiro(r, definicao.regimeReferencia, ano);
        return excedeu === undefined ? undefined : excedeu ? "excedeu_limite" : "dentro_do_limite";
      };
    case "igualdade_resultado_economico":
      return (r) => {
        if (!definicao.regimesEnvolvidos) return undefined;
        const [A, B] = definicao.regimesEnvolvidos;
        const a = resultadoEconomicoDoRegimeNoAno(r, A, ano);
        const b = resultadoEconomicoDoRegimeNoAno(r, B, ano);
        if (a === undefined || b === undefined) return undefined;
        const diff = arredondarCentavos(a - b);
        return diff === 0 ? "empate" : diff > 0 ? `${A}_maior` : `${B}_maior`;
      };
    case "igualdade_custo_financeiro":
      return (r) => {
        if (!definicao.regimesEnvolvidos) return undefined;
        const [A, B] = definicao.regimesEnvolvidos;
        const a = custoFinanceiroDoRegimeNoAno(r, A, ano);
        const b = custoFinanceiroDoRegimeNoAno(r, B, ano);
        if (a === undefined || b === undefined) return undefined;
        const diff = arredondarCentavos(a - b);
        return diff === 0 ? "empate" : diff > 0 ? `${A}_maior` : `${B}_maior`;
      };
    default:
      return () => undefined;
  }
}

function opcoesComLimiteCapitalGiro(definicao: DefinicaoPontoVirada): OpcoesExecucaoCenario {
  const opcoes = { ...definicao.opcoes };
  if (definicao.tipo === "limite_capital_giro" && definicao.limiteCapitalGiroInformado !== undefined && opcoes.premissasSplit?.caixaMinimoOperacional === undefined) {
    opcoes.premissasSplit = { ...opcoes.premissasSplit, caixaMinimoOperacional: { valor: definicao.limiteCapitalGiroInformado, origem: "informado_usuario", status: "confirmado" } };
  }
  return opcoes;
}

/**
 * Ponto de entrada principal. Para `cruzamento_fator_r`/`preservacao_margem`/
 * `margem_zero` usa exclusivamente soluções analíticas já existentes
 * (seção 12/14/20); para os demais tipos, varredura + bisseção sobre
 * `executarCenario` (seção 21/26).
 */
export function buscarPontoVirada(definicao: DefinicaoPontoVirada): ResultadoPontoVirada {
  const precisao = definicao.intervalo.precisao ?? precisaoPadrao(definicao.variavel);
  const base: Omit<ResultadoPontoVirada, "status" | "achados"> = {
    tipo: definicao.tipo,
    variavel: definicao.variavel,
    valorEncontrado: undefined,
    intervaloOriginal: definicao.intervalo,
    precisao,
    iteracoes: 0,
    qualidade: "media",
    origemSolucao: definicao.tipo === "cruzamento_fator_r" || definicao.tipo === "preservacao_margem" || definicao.tipo === "margem_zero" ? "analitica" : "numerica",
    premissas: {},
    alertas: [],
  };

  if (definicao.tipo === "cruzamento_fator_r") return buscarCruzamentoFatorR(definicao, base);
  if (definicao.tipo === "preservacao_margem" || definicao.tipo === "margem_zero") return buscarPontoMargem(definicao, base);

  const { min, max } = definicao.intervalo;
  if (min >= max) {
    return { ...base, status: "intervalo_invalido", achados: [], alertas: ["Intervalo inválido: min deve ser menor que max."] };
  }

  const errosMin = validarAlteracoes(definicao.cenarioBase, alteracaoParaVariavel(definicao.variavel, min));
  const errosMax = validarAlteracoes(definicao.cenarioBase, alteracaoParaVariavel(definicao.variavel, max));
  if (errosMin.length > 0 || errosMax.length > 0) {
    return { ...base, status: "intervalo_invalido", achados: [], alertas: [...errosMin, ...errosMax].map((e) => `${e.campo}: ${e.motivo}`) };
  }

  const opcoes = opcoesComLimiteCapitalGiro(definicao);
  const avaliar = (valor: number) => executarCenario(definicao.cenarioBase, definicao.motoresRegime, alteracaoParaVariavel(definicao.variavel, valor), opcoes);
  const extrairEstado = extratorDeEstado(definicao);

  const n = definicao.intervalo.amostrasIniciais ?? amostrasIniciaisPadrao();
  const amostras = amostrarIntervalo(min, max, n, avaliar, extrairEstado);

  if (amostras.every((a) => a.estado === undefined)) {
    return { ...base, status: "dados_insuficientes", achados: [], alertas: ["Nenhuma amostra do intervalo produziu estado determinável — dados insuficientes para localizar o ponto de virada."] };
  }

  const transicoes = detectarTransicoes(amostras);
  if (transicoes.length === 0) {
    return { ...base, status: "nao_encontrado", achados: gerarAchadosPontoVirada(definicao.tipo, "nao_encontrado"), alertas: [`Estado permaneceu "${amostras[0].estado}" em todo o intervalo — nenhuma mudança detectada.`] };
  }

  if (transicoes.length > 1) {
    return {
      ...base,
      status: "multiplos_pontos",
      intervaloFinal: undefined,
      outrosPontos: transicoes.map((t) => ({ intervalo: [t.a.valor, t.b.valor] as [number, number] })),
      achados: gerarAchadosPontoVirada(definicao.tipo, "multiplos_pontos", undefined, transicoes.length),
      alertas: [`${transicoes.length} mudanças de estado detectadas na varredura inicial — nenhuma foi assumida como fronteira única (ver outrosPontos).`],
    };
  }

  const { a, b } = transicoes[0];
  const semTransicaoRegiaoIndeterminada = a.estado === undefined || b.estado === undefined;
  const refinamento = refinarBissecao(a, b, precisao, avaliar, extrairEstado);

  if (refinamento.status === "resultado_indeterminado") {
    return { ...base, status: "resultado_indeterminado", intervaloFinal: [refinamento.esquerda.valor, refinamento.direita.valor], iteracoes: refinamento.iteracoes, achados: [], alertas: [refinamento.motivo ?? "Busca não convergiu."] };
  }

  const valorEncontrado = (refinamento.esquerda.valor + refinamento.direita.valor) / 2;
  const alertas: string[] = [];
  if (semTransicaoRegiaoIndeterminada) alertas.push("A transição detectada envolve uma região com estado indeterminado (ex.: comparabilidade ausente) — o valor encontrado é a fronteira entre determinado/indeterminado, não necessariamente entre dois regimes.");

  return {
    ...base,
    status: "encontrado",
    valorEncontrado,
    intervaloFinal: [refinamento.esquerda.valor, refinamento.direita.valor],
    iteracoes: refinamento.iteracoes,
    estadoAntes: estadoParaPonto(refinamento.esquerda),
    estadoDepois: estadoParaPonto(refinamento.direita),
    cenarioNoPonto: refinamento.direita.resultado,
    qualidade: refinamento.esquerda.resultado.qualidade.fiscal === "alta" && refinamento.direita.resultado.qualidade.fiscal === "alta" ? "alta" : "media",
    achados: gerarAchadosPontoVirada(definicao.tipo, "encontrado", valorEncontrado),
    alertas,
  };
}

function buscarCruzamentoFatorR(definicao: DefinicaoPontoVirada, base: Omit<ResultadoPontoVirada, "status" | "achados">): ResultadoPontoVirada {
  const analitico = calcularFs12NecessariaAnalitica(definicao.cenarioBase, definicao.ano);
  if (!analitico.disponivel) {
    return { ...base, status: "dados_insuficientes", achados: [], alertas: [analitico.motivo] };
  }

  const valorEncontrado = analitico.porMes.reduce((s, m) => s + m.fs12NecessariaParaLimite, 0) / analitico.porMes.length;
  const opcoes = definicao.opcoes ?? {};
  const abaixo = executarCenario(definicao.cenarioBase, definicao.motoresRegime, alteracaoParaVariavel("folha", Math.max(0, valorEncontrado - 1)), opcoes);
  const acima = executarCenario(definicao.cenarioBase, definicao.motoresRegime, alteracaoParaVariavel("folha", valorEncontrado + 1), opcoes);
  const regime = definicao.regimeReferencia;

  return {
    ...base,
    status: "encontrado",
    valorEncontrado,
    intervaloFinal: [valorEncontrado - 1, valorEncontrado + 1],
    estadoAntes: regime ? { valor: valorEncontrado - 1, resultado: abaixo, estadoCategorico: anexoSimplesNoAno(abaixo, regime, definicao.ano) } : undefined,
    estadoDepois: regime ? { valor: valorEncontrado + 1, resultado: acima, estadoCategorico: anexoSimplesNoAno(acima, regime, definicao.ano) } : undefined,
    cenarioNoPonto: acima,
    premissas: { porMes: analitico.porMes },
    qualidade: "alta",
    achados: gerarAchadosPontoVirada("cruzamento_fator_r", "encontrado", valorEncontrado),
    alertas: ["FS12 necessária calculada analiticamente (RBT12 × 28%, mesma fórmula do motor real) — nenhuma busca numérica foi executada."],
  };
}

function buscarPontoMargem(definicao: DefinicaoPontoVirada, base: Omit<ResultadoPontoVirada, "status" | "achados">): ResultadoPontoVirada {
  if (!definicao.regimeReferencia) {
    return { ...base, status: "dados_insuficientes", achados: [], alertas: ["regimeReferencia é obrigatório para preservacao_margem/margem_zero."] };
  }
  const margemAlvo = definicao.tipo === "margem_zero" ? 0 : definicao.margemAlvo;
  if (margemAlvo === undefined) {
    return { ...base, status: "dados_insuficientes", achados: [], alertas: ["margemAlvo é obrigatório para preservacao_margem."] };
  }

  const { resultado, anoFinanceiro } = resolverAnaliticoMargem(definicao.cenarioBase, definicao.motoresRegime, definicao.regimeReferencia, definicao.ano, margemAlvo, definicao.opcoes);
  if (anoFinanceiro?.reajusteMedioNecessario === undefined) {
    return { ...base, status: "resultado_indeterminado", cenarioNoPonto: resultado, achados: [], alertas: anoFinanceiro?.alertas ?? ["Receita necessária para a margem-alvo não é matematicamente possível neste cenário (ver alertas do Motor Financeiro)."] };
  }

  return {
    ...base,
    status: "encontrado",
    valorEncontrado: anoFinanceiro.reajusteMedioNecessario,
    cenarioNoPonto: resultado,
    qualidade: anoFinanceiro.qualidade,
    achados: gerarAchadosPontoVirada(definicao.tipo, "encontrado", anoFinanceiro.reajusteMedioNecessario),
    alertas: ["Reutiliza calcularReceitaNecessariaParaMargem (motorFinanceiro/precoNecessario.ts) — fórmula fechada, nenhuma busca numérica executada.", ...anoFinanceiro.alertas],
    premissas: { margemAlvo, cenariosRepasse: anoFinanceiro.cenariosRepasse },
  };
}

/**
 * Mudança temporal (seção 38/39) — não é uma busca sobre variável
 * contínua, é uma leitura ano a ano de `menorCargaComparavel` já
 * calculado. Nunca interpola data fictícia entre anos.
 */
export function buscarMudancaTemporal(cenarioBase: DefinicaoPontoVirada["cenarioBase"], motoresRegime: DefinicaoPontoVirada["motoresRegime"], opcoes: OpcoesExecucaoCenario = {}): PontoDeViradaTemporal {
  const resultado = executarCenario(cenarioBase, motoresRegime, {}, opcoes);
  const regimeReferenciaAno = ANOS_SIMULACAO.map((ano) => ({ ano, menorCargaComparavel: menorCargaComparavelNoAno(resultado, ano) }));

  const transicoes: PontoDeViradaTemporal["transicoes"] = [];
  for (let i = 1; i < regimeReferenciaAno.length; i++) {
    const antes = regimeReferenciaAno[i - 1];
    const depois = regimeReferenciaAno[i];
    if (antes.menorCargaComparavel !== depois.menorCargaComparavel) {
      transicoes.push({ anoAntes: antes.ano, anoDepois: depois.ano, regimeAntes: antes.menorCargaComparavel, regimeDepois: depois.menorCargaComparavel });
    }
  }

  return { regimeReferenciaAno, transicoes, alertas: resultado.alertas };
}
