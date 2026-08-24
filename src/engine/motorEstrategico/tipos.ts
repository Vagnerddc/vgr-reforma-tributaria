/**
 * Contrato universal de alternativa estratégica — o Motor Estratégico
 * transforma achados JÁ PRODUZIDOS (RelatorioAuditoriaEstrategica) em
 * possibilidades estruturadas, NUNCA em recomendação (seção 1/5 do
 * pedido). Toda `AlternativaEstrategica` nasce de pelo menos um
 * `AchadoEstrategico` — nunca "do nada".
 */

import type { Regime } from "../types";
import type { CampoComProveniencia, OrigemInformacao } from "../operacaoTributaria";
import type { AchadoEstrategico, QualidadeAchado, CategoriaAchado } from "../motorAchados/tipos";

export type { QualidadeAchado };

export type CategoriaAlternativa = "preco" | "creditos" | "fator_r" | "folha" | "regime" | "capital_giro" | "custo_financeiro" | "estrutura_custos" | "mix_receitas" | "qualidade_dados";

export type CodigoAlternativa =
  | "AVALIAR_RECOMPOSICAO_PRECO"
  | "AVALIAR_ESTRUTURA_CREDITOS"
  | "AVALIAR_FATOR_R"
  | "AVALIAR_ESTRUTURA_FOLHA"
  | "AVALIAR_REGIME_TRIBUTARIO"
  | "AVALIAR_CAPITAL_GIRO"
  | "AVALIAR_CUSTO_FINANCEIRO"
  | "AVALIAR_ESTRUTURA_CUSTOS"
  | "AVALIAR_MIX_RECEITAS"
  | "VALIDAR_DADOS_FISCAIS"
  | "VALIDAR_BASE_LUCRO_REAL"
  | "VALIDAR_PREMISSAS_SPLIT"
  | "VALIDAR_COBERTURA_TRIBUTARIA";

export type Aplicabilidade = "aplicavel" | "potencialmente_aplicavel" | "condicionada" | "nao_aplicavel" | "indeterminada";

export type TipoBloqueio = "dados_insuficientes" | "regime_nao_comparavel" | "elegibilidade_indeterminada" | "premissa_nao_confirmada" | "validacao_juridica_necessaria";

export interface Bloqueio {
  tipo: TipoBloqueio;
  descricao: string;
}

/** Impede concluir (seção 32) — nunca confundido com risco (que não impede a análise). */
export type TipoRisco = "RISCO_COMERCIAL" | "RISCO_CAIXA" | "RISCO_DADOS" | "RISCO_JURIDICO" | "RISCO_OPERACIONAL" | "RISCO_TRIBUTARIO";

export interface Risco {
  tipo: TipoRisco;
  descricao: string;
}

export type TipoValidacao = "VALIDACAO_FISCAL" | "VALIDACAO_JURIDICA" | "VALIDACAO_CONTABIL" | "VALIDACAO_FINANCEIRA" | "VALIDACAO_COMERCIAL";

export interface ValidacaoNecessaria {
  tipo: TipoValidacao;
  descricao: string;
  motivo: string;
  bloqueante: boolean;
}

export interface ImpactoConhecido {
  descricao: string;
  valor?: number;
  unidade?: AchadoEstrategico["unidade"];
  origem: string;
}

/** Um cenário/ponto de virada relacionado — REFERÊNCIA, nunca cópia (seção 49). */
export interface ReferenciaCenario {
  cenarioId: string;
  descricao: string;
}

export interface ReferenciaPontoVirada {
  tipo: string;
  variavel: string;
  valorEncontrado?: number;
  estadoAntes?: string;
  estadoDepois?: string;
}

export interface AlternativaEstrategica {
  id: string;
  codigo: CodigoAlternativa;
  categoria: CategoriaAlternativa;
  titulo: string;
  objetivo: string;
  descricaoTecnica: string;

  achadosOrigem: string[]; // AchadoEstrategico.id[]
  evidencias: AchadoEstrategico["evidencias"];

  aplicabilidade: Aplicabilidade;
  condicoes: string[];
  dependencias: string[];
  restricoes: string[];

  impactosConhecidos: ImpactoConhecido[];
  impactosIndeterminados: string[];

  cenariosRelacionados: ReferenciaCenario[];
  pontosViradaRelacionados: ReferenciaPontoVirada[];
  periodosAplicaveis?: { anoInicio: number; anoFim: number } | { ano: number }[];

  qualidade: QualidadeAchado;
  premissas: Record<string, CampoComProveniencia<unknown> | string | number>;
  riscos: Risco[];
  bloqueios: Bloqueio[];
  validacoesNecessarias: ValidacaoNecessaria[];
  origens: OrigemInformacao[];
  regime?: Regime;
}

export type CodigoConflito = "TRIBUTO_VS_CAIXA" | "TRIBUTO_VS_MARGEM" | "MARGEM_VS_CAIXA" | "CURTO_PRAZO_VS_LONGO_PRAZO";

export interface ConflitoEstrategico {
  codigo: CodigoConflito;
  descricao: string;
  alternativasEnvolvidas: string[]; // AlternativaEstrategica.id[]
  evidencias: AchadoEstrategico["evidencias"];
}

export interface CoberturaEstrategica {
  preco: "analisado" | "nao_aplicavel" | "indisponivel";
  creditos: "analisado" | "nao_aplicavel" | "indisponivel";
  fatorR: "analisado" | "nao_aplicavel" | "indisponivel";
  regimes: "analisado" | "nao_aplicavel" | "indisponivel";
  capitalGiro: "analisado" | "nao_aplicavel" | "indisponivel";
  custoFinanceiro: "analisado" | "nao_aplicavel" | "indisponivel";
  qualidadeDados: "analisado" | "nao_aplicavel" | "indisponivel";
}

export interface PlanoAlternativasEstrategicas {
  cenarioId: string;
  perfilSetorial?: string;
  alternativas: AlternativaEstrategica[];
  conflitos: ConflitoEstrategico[];
  bloqueiosGlobais: Bloqueio[];
  validacoesNecessarias: ValidacaoNecessaria[];
  qualidade: QualidadeAchado;
  cobertura: CoberturaEstrategica;
}

/**
 * Uma regra estruturada — sem DSL exagerada (seção 39). `avaliar` só lê
 * o contexto já calculado (achados + resultado + pontos de virada) e
 * devolve 0 ou 1 alternativa; nunca recalcula nada dos motores.
 */
export interface RegraEstrategica {
  codigo: CodigoAlternativa;
  categoria: CategoriaAlternativa;
  achadosNecessarios: string[]; // pelo menos UM destes códigos de achado precisa existir
  achadosExcludentes?: string[];
}

export type CategoriaAchadoRelevante = CategoriaAchado;
