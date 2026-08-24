/**
 * Catálogo central — evita texto espalhado pelas regras (seção 48).
 * Cada entrada é só metadado (categoria/tipo/responsabilidade/título) —
 * nenhuma regra de ativação vive aqui (isso é `regras.ts`).
 */

import type { CategoriaAcao, CodigoAcao, ResponsabilidadeSugerida, TipoAcao } from "./tipos";

export interface MetadadoAcao {
  categoria: CategoriaAcao;
  tipo: TipoAcao;
  titulo: string;
  responsabilidadeSugerida: ResponsabilidadeSugerida[];
}

export const CATALOGO_ACOES: Record<CodigoAcao, MetadadoAcao> = {
  VALIDAR_COBERTURA_TRIBUTARIA: { categoria: "fiscal", tipo: "validacao", titulo: "Validar cobertura tributária entre regimes", responsabilidadeSugerida: ["fiscal", "contabil"] },
  VALIDAR_BASE_LUCRO_REAL: { categoria: "fiscal", tipo: "validacao", titulo: "Validar base do Lucro Real", responsabilidadeSugerida: ["contabil", "fiscal"] },
  VALIDAR_PIS_COFINS: { categoria: "fiscal", tipo: "validacao", titulo: "Validar cobertura de PIS/COFINS", responsabilidadeSugerida: ["fiscal"] },
  VALIDAR_PREMISSAS_SPLIT: { categoria: "capital_giro", tipo: "validacao", titulo: "Validar premissas de split payment", responsabilidadeSugerida: ["financeiro"] },
  VALIDAR_CUSTO_CAPITAL: { categoria: "custo_financeiro", tipo: "validacao", titulo: "Validar custo de capital atual", responsabilidadeSugerida: ["financeiro"] },
  VALIDAR_COMPOSICAO_FS12: { categoria: "fator_r", tipo: "validacao", titulo: "Validar composição da FS12", responsabilidadeSugerida: ["contabil", "fiscal"] },
  VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE: { categoria: "preco", tipo: "validacao", titulo: "Validar viabilidade comercial do reajuste", responsabilidadeSugerida: ["comercial"] },
  VALIDAR_CLASSIFICACAO_CREDITOS: { categoria: "creditos", tipo: "validacao", titulo: "Validar classificação de créditos", responsabilidadeSugerida: ["fiscal", "contabil"] },
  VALIDAR_PREMISSAS_FLUXO: { categoria: "capital_giro", tipo: "validacao", titulo: "Validar premissas de fluxo de caixa", responsabilidadeSugerida: ["financeiro"] },
  VALIDAR_ENQUADRAMENTO_JURIDICO: { categoria: "regime", tipo: "validacao", titulo: "Validar enquadramento jurídico do regime obrigatório", responsabilidadeSugerida: ["juridico", "contabil"] },
  VALIDAR_CRITERIOS_NAO_MENSURADOS: { categoria: "regime", tipo: "validacao", titulo: "Validar critérios ainda não mensurados entre alternativas equivalentes", responsabilidadeSugerida: ["gestao"] },
  VALIDAR_PREMISSAS_CAIXA: { categoria: "capital_giro", tipo: "validacao", titulo: "Validar premissas de caixa relacionadas ao conflito identificado", responsabilidadeSugerida: ["financeiro"] },
  REVISAR_ITENS_INDETERMINADOS: { categoria: "creditos", tipo: "analise", titulo: "Revisar itens de custo com crédito indeterminado", responsabilidadeSugerida: ["fiscal", "contabil"] },
  SIMULAR_CENARIO_FINAL: { categoria: "regime", tipo: "simulacao", titulo: "Simular cenário final com premissas confirmadas", responsabilidadeSugerida: ["gestao"] },
  SIMULAR_FATOR_R_COM_DADOS_VALIDOS: { categoria: "fator_r", tipo: "simulacao", titulo: "Simular Fator R com dados validados", responsabilidadeSugerida: ["fiscal"] },
  SIMULAR_REPASSE_FINAL: { categoria: "preco", tipo: "simulacao", titulo: "Simular repasse final de preço", responsabilidadeSugerida: ["comercial", "financeiro"] },
  SIMULAR_CREDITOS_CONFIRMADOS: { categoria: "creditos", tipo: "simulacao", titulo: "Simular cenário com créditos confirmados", responsabilidadeSugerida: ["fiscal"] },
  SIMULAR_PICO_CAPITAL_GIRO: { categoria: "capital_giro", tipo: "simulacao", titulo: "Simular pico de capital de giro com premissas confirmadas", responsabilidadeSugerida: ["financeiro"] },
  EXECUTAR_CENARIO_ADICIONAL: { categoria: "regime", tipo: "simulacao", titulo: "Executar cenário adicional para resolver lacuna identificada", responsabilidadeSugerida: ["gestao"] },
  FORMALIZAR_DECISAO_TRIBUTARIA: { categoria: "regime", tipo: "formalizacao", titulo: "Formalizar decisão tributária", responsabilidadeSugerida: ["gestao", "contabil"] },
  FORMALIZAR_PLANEJAMENTO_NO_REGIME_OBRIGATORIO: { categoria: "regime", tipo: "formalizacao", titulo: "Formalizar planejamento no regime juridicamente obrigatório", responsabilidadeSugerida: ["contabil", "juridico"] },
  ACOMPANHAR_PONTO_VIRADA: { categoria: "monitoramento", tipo: "monitoramento", titulo: "Acompanhar ponto de virada relacionado à decisão", responsabilidadeSugerida: ["gestao"] },
  MONITORAR_FATOR_R: { categoria: "monitoramento", tipo: "monitoramento", titulo: "Monitorar Fator R", responsabilidadeSugerida: ["contabil", "fiscal"] },
  MONITORAR_CAPITAL_GIRO: { categoria: "monitoramento", tipo: "monitoramento", titulo: "Monitorar capital de giro adicional", responsabilidadeSugerida: ["financeiro"] },
  REAVALIAR_REGIME_NO_HORIZONTE: { categoria: "monitoramento", tipo: "monitoramento", titulo: "Reavaliar regime tributário em ano futuro do horizonte", responsabilidadeSugerida: ["gestao"] },
  ATUALIZAR_PREMISSAS: { categoria: "monitoramento", tipo: "monitoramento", titulo: "Atualizar premissas utilizadas na análise", responsabilidadeSugerida: ["gestao"] },
};
