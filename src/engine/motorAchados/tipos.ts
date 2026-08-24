/**
 * Contrato universal de achado estratégico — consolida achados JÁ
 * PRODUZIDOS pelos motores existentes (motorFinanceiro/achados.ts,
 * splitPayment/achados.ts, motorCenarios/achados.ts,
 * motorPontosVirada/achados.ts) mais um pequeno conjunto de achados
 * cruzados/fiscais/setoriais novos — nenhum recalcula tributo, margem,
 * caixa, cenário ou ponto de virada (seção 1/2 do pedido). "O que os
 * dados estão revelando?" — nunca "o que fazer?".
 */

import type { CampoComProveniencia, OrigemInformacao, OrigemCalculo, StatusInformacao } from "../operacaoTributaria";
import type { Regime } from "../types";

/**
 * Categorias amplas (seção 6) — usadas para filtrar, nunca para
 * ranquear relevância estratégica (isso é fase futura).
 */
export type CategoriaAchado = "fiscal" | "creditos" | "regimes" | "margem" | "preco" | "caixa" | "capital_giro" | "fator_r" | "dados" | "comparabilidade" | "cenario" | "ponto_virada" | "setorial" | "qualidade" | "divergencia";

/**
 * Códigos estruturados — nunca string livre como chave de negócio
 * (seção 5). Um código por fato reconhecível; o texto (`tituloTecnico`/
 * `descricaoTecnica`) é sempre DERIVADO do código+valor, nunca a
 * origem da verdade.
 */
export type CodigoAchadoEstrategico =
  // fiscal
  | "CARGA_TRIBUTARIA_AUMENTOU"
  | "CARGA_TRIBUTARIA_REDUZIU"
  | "CARGA_TRIBUTARIA_ESTAVEL"
  | "CARGA_FISCAL_INCOMPLETA"
  | "REGIME_OBRIGATORIO"
  | "REGIME_INELEGIVEL"
  | "ELEGIBILIDADE_INDETERMINADA"
  // comparabilidade
  | "REGIMES_NAO_COMPARAVEIS"
  | "REGIMES_COMPARAVEIS_COM_RESSALVAS"
  | "COMPONENTE_MATERIAL_AUSENTE"
  // créditos
  | "INDICE_CREDITO_CALCULADO"
  | "CREDITOS_INDETERMINADOS"
  | "CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA"
  // fator R (consolidação — reaproveita alertas/analítico já existentes)
  | "FATOR_R_ABAIXO_LIMITE"
  | "FATOR_R_ACIMA_LIMITE"
  | "FATOR_R_EXATAMENTE_NO_LIMITE"
  | "FS12_ADICIONAL_NECESSARIA"
  // margem (motorFinanceiro/achados.ts, reexportado)
  | "MARGEM_REDUZIDA"
  | "MARGEM_PRESERVADA"
  | "MARGEM_NEGATIVA"
  | "IMPACTO_ANUAL_RELEVANTE"
  | "REAJUSTE_PRECO_NECESSARIO"
  | "DADOS_ECONOMICOS_INSUFICIENTES"
  // caixa/capital de giro (splitPayment/achados.ts, reexportado)
  | "REDUCAO_DISPONIBILIDADE_CAIXA"
  | "CAPITAL_GIRO_ADICIONAL"
  | "PICO_CAPITAL_GIRO"
  | "CUSTO_FINANCEIRO_ADICIONAL"
  | "DADOS_SPLIT_INSUFICIENTES"
  | "PREMISSA_SPLIT_NAO_CONFIRMADA"
  // divergências cruzadas (novo)
  | "MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA"
  | "MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM"
  | "MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA"
  // cenários (novo, sempre relativo a um baseline explícito)
  | "CENARIO_REDUZ_CARGA"
  | "CENARIO_AUMENTA_CARGA"
  | "CENARIO_MELHORA_MARGEM"
  | "CENARIO_PIORA_MARGEM"
  | "CENARIO_REDUZ_CAPITAL_GIRO"
  | "CENARIO_PIORA_CAIXA"
  // sensibilidade (motorCenarios, reexportado/derivado)
  | "RESULTADO_SENSIVEL_A_VARIAVEL"
  // pontos de virada (motorPontosVirada, reexportado)
  | "PONTO_VIRADA_FATURAMENTO"
  | "PONTO_VIRADA_CREDITOS"
  | "PONTO_VIRADA_FATOR_R"
  | "PONTO_VIRADA_CUSTO_CAPITAL"
  | "PONTO_VIRADA_CAPITAL_GIRO"
  | "PONTO_VIRADA_GENERICO"
  // temporal
  | "REGIME_MENOR_CARGA_MUDA_AO_LONGO_DA_TRANSICAO"
  | "VARIACAO_MARGEM_2026_2033"
  // dados/qualidade
  | "DADOS_FISCAIS_INSUFICIENTES"
  | "DADOS_FINANCEIROS_INSUFICIENTES"
  | "BASE_LUCRO_REAL_PARCIAL"
  | "CARGA_TRIBUTARIA_PARCIAL"
  | "PREMISSA_RELEVANTE_NAO_CONFIRMADA";

/**
 * `bloqueante`/`informacao_insuficiente`/`juridicamente_invalido` — só
 * quando há fundamento OBJETIVO (seção 8). Nunca severidade empresarial
 * subjetiva ("crítico"/"alto risco") nesta fase.
 */
export type SeveridadeTecnica = "bloqueante" | "informacao_insuficiente" | "juridicamente_invalido";

export type QualidadeAchado = "alta" | "media" | "baixa" | "insuficiente";

export interface EvidenciaAchado {
  origem: "motor_fiscal" | "comparador_consolidado" | "motor_financeiro" | "motor_split_payment" | "motor_cenarios" | "motor_pontos_virada" | "motor_creditos" | "motor_achados";
  /** Referência estável ao dado de origem (ex.: "ResultadoRegime.lucro_presumido.anos[2027].cargaTotal") — texto livre por ora, sempre presente. */
  referencia: string;
  valor?: number;
}

export interface AchadoEstrategico {
  id: string;
  codigo: CodigoAchadoEstrategico;
  categoria: CategoriaAchado;
  tituloTecnico: string;
  descricaoTecnica: string;
  /** Valor objetivo do fato — nunca ausente em achados quantitativos (seção 9). */
  valor?: number;
  unidade?: "reais" | "pontos_percentuais" | "percentual" | "meses" | "dias" | "indice";
  periodo?: { ano?: number; anoInicio?: number; anoFim?: number };
  regime?: Regime;
  /** Presente só quando há dados segregados e confiáveis por atividade (seção 38) — ausência = achado no nível da empresa. */
  atividade?: string;
  cenarioId?: string;
  evidencias: EvidenciaAchado[];
  qualidade: QualidadeAchado;
  premissas: Record<string, CampoComProveniencia<unknown> | string | number>;
  origens: OrigemInformacao[];
  origemCalculo?: OrigemCalculo;
  status: StatusInformacao;
  severidadeTecnica?: SeveridadeTecnica;
}

export interface CoberturaAuditoria {
  fiscal: "disponivel" | "indisponivel" | "parcial";
  creditos: "disponivel" | "indisponivel" | "parcial";
  margem: "disponivel" | "indisponivel" | "parcial";
  caixa: "disponivel" | "indisponivel" | "parcial";
  cenarios: "disponivel" | "indisponivel" | "parcial";
  pontosVirada: "disponivel" | "indisponivel" | "parcial";
  setorial: "disponivel" | "indisponivel" | "parcial";
}

export interface RelatorioAuditoriaEstrategica {
  cenarioId: string;
  periodo: { anoInicio: number; anoFim: number };
  perfilSetorial?: string;
  achados: AchadoEstrategico[];
  qualidade: QualidadeAchado;
  /** Determinístico — sempre gerado por template a partir dos achados, nunca por um LLM (seção 49/50/57). */
  resumoTecnico: string;
  cobertura: CoberturaAuditoria;
  premissas: Record<string, CampoComProveniencia<unknown> | string | number>;
}
