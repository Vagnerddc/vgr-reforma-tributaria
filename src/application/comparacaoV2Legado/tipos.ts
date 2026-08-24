/**
 * Comparação estruturada V2 × Legado — nunca chama toda diferença de
 * erro: quando o V2 captura informação que o legado não tem
 * (FS12, créditos por categoria, split, ajustes de Lucro Real), a
 * divergência resultante é ESPERADA, não uma regressão.
 */

export type ClassificacaoDivergencia = "equivalente" | "esperada_por_maior_cobertura_v2" | "divergencia_material" | "nao_comparavel";

export interface DivergenciaCampo {
  campo: string;
  valorLegado: unknown;
  valorV2: unknown;
  classificacao: ClassificacaoDivergencia;
  explicacao?: string;
}

export interface ResultadoComparacaoFluxos {
  casoId: string;
  classificacao: ClassificacaoDivergencia;
  divergenciasEntrada: DivergenciaCampo[];
  divergenciasResultado: DivergenciaCampo[];
  perdasLegado: string[];
  ganhosCoberturaV2: string[];
  impactosMateriais: string[];
  conclusaoComparativa: string;
}
