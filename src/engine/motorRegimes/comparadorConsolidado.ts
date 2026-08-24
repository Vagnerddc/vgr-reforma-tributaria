/**
 * Comparador Consolidado — camada sobre `compararRegimes` (comparador.ts,
 * intocado) que responde "os resultados podem ser comparados de forma
 * válida?" antes de responder "qual é menor". Nenhuma fórmula tributária
 * aqui — só lê o que os motores já produziram (`ResultadoRegime`) e o
 * `CenarioEmpresa` original (para a receita de referência, que é
 * derivação econômica pura, não regra fiscal).
 *
 * Não substitui `ResultadoComparacaoRegimes.regimeMenorCarga` (comparador.ts)
 * — esse campo continua existindo e agora deve ser lido como
 * "menorCargaCalculada" (diagnóstico interno, nunca conclusão executiva,
 * ver docs/comparador-consolidado.md). Este módulo introduz
 * `menorCargaComparavel`, que é o único campo seguro para qualquer
 * leitura executiva futura.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../parametros";
import type { ComponenteTributario, ResultadoRegime, StatusElegibilidade } from "./tipos";
import type { Regime } from "../types";

export type StatusComparabilidade = "comparavel" | "comparavel_com_ressalvas" | "nao_comparavel" | "indeterminado";
export type Severidade = "informativo" | "ressalva" | "bloqueante";

export type CodigoMotivoComparabilidade =
  | "COMPONENTE_MATERIAL_AUSENTE"
  | "BASE_FISCAL_PARCIAL"
  | "RECEITAS_NAO_EQUIVALENTES"
  | "PERIODO_INCOMPATIVEL"
  | "REGIME_INELEGIVEL"
  | "ELEGIBILIDADE_INDETERMINADA"
  | "QUALIDADE_INSUFICIENTE"
  | "COMPONENTE_SEGREGADO_NAO_CALCULADO";

export interface MotivoComparabilidade {
  codigo: CodigoMotivoComparabilidade;
  severidade: Severidade;
  descricao: string;
}

export interface AvaliacaoCobertura {
  esperados: ComponenteTributario[];
  disponiveis: ComponenteTributario[];
  /** Subconjunto de `esperados` que não está em `disponiveis` — sempre tratado como material nesta fase (seção 8 do pedido: sem percentual arbitrário, só estrutural). */
  ausentesMateriais: ComponenteTributario[];
}

export type QualidadeConsolidada = "alta" | "media" | "baixa" | "insuficiente";

export interface ResumoComparativoRegimeAno {
  regime: Regime;
  ano: number;
  statusJuridico: StatusElegibilidade;
  disponivel: boolean;
  cargaConhecida: number;
  receitaReferencia?: number;
  percentualSobreReceita?: number;
  cobertura: AvaliacaoCobertura;
  qualidadeConsolidada: QualidadeConsolidada;
  status: StatusComparabilidade;
  motivos: MotivoComparabilidade[];
}

export interface ComparacaoAno {
  ano: number;
  porRegime: ResumoComparativoRegimeAno[];
  /** Só entre status comparavel/comparavel_com_ressalvas — nunca inclui inelegível/indeterminado/não comparável. */
  rankingTributario: Regime[];
  /** undefined quando não há candidato comparável, quando há empate, ou quando um regime obrigatório restringe a comparação a ele mesmo sozinho. */
  menorCargaComparavel?: Regime;
  empate: boolean;
  regimesEmEmpate?: Regime[];
}

export interface ResultadoComparacaoConsolidado {
  cenarioId: string;
  porAno: ComparacaoAno[];
  /** Referência direta aos resultados dos motores — nunca copiado/duplicado. */
  resultadosPorRegime: ResultadoRegime[];
}

/**
 * Componentes esperados por regime — estrutural, não uma lista universal
 * (seção 7 do pedido). ICMS/ISS deliberadamente NÃO entram aqui: qual dos
 * dois se aplica depende da atividade (mercadoria vs. serviço), e nenhum
 * dos três motores atuais os calcula de qualquer forma — incluí-los
 * tornaria TODO resultado permanentemente "com ressalva" por um motivo
 * que nenhum motor pode resolver hoje. PIS/COFINS entram porque são
 * universalmente aplicáveis (Presumido/Real) e sua ausência é uma
 * limitação real e conhecida (não uma característica do regime).
 */
function componentesEsperados(regime: Regime): ComponenteTributario[] {
  if (regime === "simples_unificado" || regime === "simples_hibrido") return ["das", "ibs", "cbs"];
  return ["irpj", "csll", "pis", "cofins", "ibs", "cbs"];
}

function avaliarCobertura(regime: Regime, componentesDisponiveis: ComponenteTributario[]): AvaliacaoCobertura {
  const esperados = componentesEsperados(regime);
  const disponiveis = [...new Set(componentesDisponiveis)];
  const ausentesMateriais = esperados.filter((c) => !disponiveis.includes(c));
  return { esperados, disponiveis, ausentesMateriais };
}

/**
 * Determinística, documentada (seção 28 do pedido — nunca uma média
 * numérica arbitrária): "insuficiente" quando o ano não está disponível;
 * "baixa" quando há mais de 1 componente material ausente; "media" com
 * até 1 ausente e pelo menos 30% dos componentes confirmados; "alta" só
 * com cobertura completa e pelo menos 80% confirmados.
 */
function calcularQualidadeConsolidada(disponivel: boolean, ausentesMateriais: number, percentualConfirmado: number): QualidadeConsolidada {
  if (!disponivel) return "insuficiente";
  if (ausentesMateriais === 0 && percentualConfirmado >= 80) return "alta";
  if (ausentesMateriais <= 1 && percentualConfirmado >= 30) return "media";
  return "baixa";
}

function receitaDoAno(cenario: CenarioEmpresa, ano: number): number | undefined {
  const base = cenario.receita.faturamentoAnual?.valor;
  if (base === undefined) return undefined;
  const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;
  return base * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
}

function alertaDeQualidadeBaseFiscal(resultado: ResultadoRegime): "completa" | "parcial" | "estimada" | "insuficiente" | undefined {
  const alerta = resultado.alertas.find((a) => a.startsWith("Qualidade da base fiscal:"));
  if (!alerta) return undefined;
  if (alerta.includes("insuficiente")) return "insuficiente";
  if (alerta.includes("parcial")) return "parcial";
  if (alerta.includes("estimada")) return "estimada";
  if (alerta.includes("completa")) return "completa";
  return undefined;
}

function atingiuFaixaSegregadaNoAno(resultado: ResultadoRegime, ano: number): boolean {
  return resultado.alertas.some((a) => a.includes("faixa 6") && a.includes(String(ano)));
}

function avaliarUmRegimeNoAno(cenario: CenarioEmpresa, resultado: ResultadoRegime, ano: number, crescimentosDivergentes: boolean): ResumoComparativoRegimeAno {
  const anoRegime = resultado.anos.find((a) => a.ano === ano);
  const disponivel = anoRegime?.disponivel ?? false;
  const componentes = anoRegime?.componentes.map((c) => c.componente) ?? [];
  const cobertura = avaliarCobertura(resultado.regime, componentes);
  const cargaConhecida = anoRegime?.cargaTotal ?? 0;
  const receitaReferencia = receitaDoAno(cenario, ano);
  const percentualSobreReceita = receitaReferencia !== undefined && receitaReferencia > 0 ? (cargaConhecida / receitaReferencia) * 100 : undefined;

  const motivos: MotivoComparabilidade[] = [];
  let status: StatusComparabilidade = "comparavel";

  if (resultado.aplicabilidade.status === "inelegivel") {
    motivos.push({ codigo: "REGIME_INELEGIVEL", severidade: "bloqueante", descricao: "Regime juridicamente inelegível/indisponível para este cenário." });
    status = "nao_comparavel";
  } else if (resultado.aplicabilidade.status === "indeterminado") {
    motivos.push({ codigo: "ELEGIBILIDADE_INDETERMINADA", severidade: "bloqueante", descricao: "Elegibilidade jurídica não confirmada — potencialmente disponível, sujeito a validação; não entra em ranking definitivo." });
    status = "indeterminado";
  }

  if (!disponivel) {
    motivos.push({ codigo: "PERIODO_INCOMPATIVEL", severidade: "bloqueante", descricao: `Resultado indisponível para ${ano} — não há grandeza para comparar neste ano.` });
    status = "nao_comparavel";
  }

  if (status === "comparavel") {
    if (atingiuFaixaSegregadaNoAno(resultado, ano)) {
      motivos.push({ codigo: "COMPONENTE_SEGREGADO_NAO_CALCULADO", severidade: "bloqueante", descricao: "Tributo indireto segregado do DAS (faixa 6) não foi calculado — o valor disponível não representa a carga completa deste ano." });
      status = "nao_comparavel";
    }

    const qualidadeBase = alertaDeQualidadeBaseFiscal(resultado);
    if (qualidadeBase === "insuficiente") {
      motivos.push({ codigo: "QUALIDADE_INSUFICIENTE", severidade: "bloqueante", descricao: "Base fiscal insuficiente para apuração confiável." });
      status = "nao_comparavel";
    } else if (qualidadeBase === "parcial" || qualidadeBase === "estimada") {
      motivos.push({ codigo: "BASE_FISCAL_PARCIAL", severidade: "ressalva", descricao: `Base fiscal ${qualidadeBase} — resultado pode não refletir ajustes fiscais reais ainda não informados.` });
      status = "comparavel_com_ressalvas";
    }
  }

  if (status === "comparavel" || status === "comparavel_com_ressalvas") {
    if (cobertura.ausentesMateriais.length > 0) {
      motivos.push({ codigo: "COMPONENTE_MATERIAL_AUSENTE", severidade: "ressalva", descricao: `Componentes esperados não calculados: ${cobertura.ausentesMateriais.join(", ")}.` });
      status = "comparavel_com_ressalvas";
    }
    if (crescimentosDivergentes) {
      motivos.push({ codigo: "RECEITAS_NAO_EQUIVALENTES", severidade: "ressalva", descricao: "Premissa de crescimento de receita difere entre os regimes comparados neste ano." });
      status = "comparavel_com_ressalvas";
    }
  }

  const qualidadeConsolidada = calcularQualidadeConsolidada(disponivel, cobertura.ausentesMateriais.length, resultado.qualidade.percentualConfirmado);

  return { regime: resultado.regime, ano, statusJuridico: resultado.aplicabilidade.status, disponivel, cargaConhecida, receitaReferencia, percentualSobreReceita, cobertura, qualidadeConsolidada, status, motivos };
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function montarComparacaoAno(cenario: CenarioEmpresa, resultados: ResultadoRegime[], ano: number): ComparacaoAno {
  const crescimentos = resultados.map((r) => r.premissas.crescimentoAnualEstimado?.valor).filter((v): v is number => v !== undefined);
  const crescimentosDivergentes = crescimentos.length > 1 && new Set(crescimentos.map(arredondarCentavos)).size > 1;

  let porRegime = resultados.map((r) => avaliarUmRegimeNoAno(cenario, r, ano, crescimentosDivergentes));

  // Obrigatoriedade prevalece (seção 17 do pedido): se algum regime é obrigatório neste ano,
  // nenhum outro pode aparecer como alternativa válida — mesmo que numericamente "menor".
  const obrigatorios = porRegime.filter((r) => r.statusJuridico === "obrigatorio");
  if (obrigatorios.length > 0) {
    porRegime = porRegime.map((r) => {
      if (r.statusJuridico === "obrigatorio") return r;
      return {
        ...r,
        status: "nao_comparavel" as StatusComparabilidade,
        motivos: [...r.motivos, { codigo: "REGIME_INELEGIVEL" as const, severidade: "bloqueante" as const, descricao: "Outro regime é juridicamente obrigatório neste cenário — este não é uma alternativa válida." }],
      };
    });
  }

  const candidatos = porRegime.filter((r) => r.status === "comparavel" || r.status === "comparavel_com_ressalvas");
  const ordenados = [...candidatos].sort((a, b) => arredondarCentavos(a.cargaConhecida) - arredondarCentavos(b.cargaConhecida));
  const rankingTributario = ordenados.map((r) => r.regime);

  let empate = false;
  let regimesEmEmpate: Regime[] | undefined;
  let menorCargaComparavel: Regime | undefined;
  if (ordenados.length === 1) {
    menorCargaComparavel = ordenados[0].regime;
  } else if (ordenados.length > 1) {
    const menorValor = arredondarCentavos(ordenados[0].cargaConhecida);
    const empatados = ordenados.filter((r) => arredondarCentavos(r.cargaConhecida) === menorValor);
    if (empatados.length > 1) {
      empate = true;
      regimesEmEmpate = empatados.map((r) => r.regime);
    } else {
      menorCargaComparavel = ordenados[0].regime;
    }
  }

  return { ano, porRegime, rankingTributario, menorCargaComparavel, empate, regimesEmEmpate };
}

/**
 * Recebe os `ResultadoRegime` JÁ CALCULADOS pelos motores (tipicamente
 * `compararRegimes(cenario, motores).resultados`) e produz a avaliação de
 * comparabilidade ano a ano. Não chama motor nenhum — não decide nada
 * fiscal, só interpreta o que já foi produzido.
 */
export function avaliarComparacaoConsolidada(cenario: CenarioEmpresa, resultados: ResultadoRegime[]): ResultadoComparacaoConsolidado {
  const porAno = ANOS_SIMULACAO.map((ano) => montarComparacaoAno(cenario, resultados, ano));
  return { cenarioId: cenario.id, porAno, resultadosPorRegime: resultados };
}
