/**
 * Infraestrutura do Piloto Controlado — contratos para registrar e
 * avaliar casos reais anonimizados. Nenhum dado pessoal, documento
 * bruto (XML/SPED/ECD/ECF/folha completa) ou nome real deve aparecer
 * aqui — apenas fonte utilizada, período, qualidade, cobertura e
 * resultado (seção 5 do pedido).
 */
import type { ClassificacaoDivergencia, DivergenciaCampo } from "../comparacaoV2Legado/tipos";

export type OrigemDadosCaso = "wizard_v2" | "wizard_v2_e_legado";
export type StatusExecucaoCaso = "executado" | "erro" | "nao_executado";
export type QualidadeAreaPiloto = "confirmado" | "estimado" | "indeterminado" | "parcial" | "nao_informado" | "nao_aplicavel";

/** Tags explícitas do que o caso valida — nunca inferidas do texto do segmento (seção 8/9). */
export type AreaValidacaoPiloto = "multiatividade" | "fs12" | "fator_r" | "creditos" | "split" | "lucro_real" | "otimizacao" | "pontos_virada" | "agro_sazonalidade";

export interface CasoPiloto {
  /** Identificador anonimizado — ex.: "CASO-SAUDE-01" (seção 4). Nunca o nome real da empresa. */
  id: string;
  segmento: string;
  perfilSetorial?: string;
  periodo: { ano: number };
  objetivo: string;
  areasValidadas: AreaValidacaoPiloto[];
  origemDados: OrigemDadosCaso;
  /** Só a fonte, nunca o documento — ex.: "Wizard V2 (consultor)", "Wizard legado (comparação)" (seção 5). */
  fontesUtilizadas: string[];

  statusExecucaoV2: StatusExecucaoCaso;
  statusExecucaoLegado?: StatusExecucaoCaso;

  qualidadeEntrada: Record<string, QualidadeAreaPiloto>;

  tempoPreenchimentoMinutos?: number;
  dificuldadesEntrada: string[];
  camposConfusos: string[];
  dadosDificeisObter: string[];
  ajudasInsuficientes: string[];

  reloadValidado?: boolean;
  contextHashConsistenteAposReload?: boolean;

  observacoesTecnicas: string[];
  observacoesUso: string[];
  pendencias: string[];
}

export type SeveridadeProblema = "critica" | "alta" | "media" | "baixa" | "informativa";
export type CategoriaProblema = "tecnica" | "fiscal" | "dados" | "ux" | "apresentacao";

export interface ProblemaPiloto {
  casoId: string;
  severidade: SeveridadeProblema;
  categoria: CategoriaProblema;
  descricao: string;
}

export type StatusOperacionalCaso = "aprovado" | "aprovado_com_ressalvas" | "requer_ajuste" | "bloqueado";

export interface AvaliacaoCasoPiloto {
  casoId: string;
  validacaoTecnica: boolean;
  validacaoEntrada: boolean;
  validacaoComparativa: ClassificacaoDivergencia | "nao_avaliada";
  validacaoApresentacao: "passou" | "ressalva" | "nao_avaliada";
  validacaoAuditabilidade: "passou" | "ressalva" | "nao_avaliada";
  divergencias: DivergenciaCampo[];
  problemas: ProblemaPiloto[];
  ressalvas: string[];
  ganhosV2: string[];
  statusFinal: StatusOperacionalCaso;
}

export type StatusProntidaoPiloto = "piloto_em_andamento" | "piloto_com_pendencias" | "pronto_para_avaliar_migracao_controlada";

export interface RelatorioPilotoControlado {
  casos: CasoPiloto[];
  totalCasos: number;
  casosAprovados: number;
  casosComRessalvas: number;
  casosBloqueados: number;
  casosRequerAjuste: number;

  divergenciasMateriais: DivergenciaCampo[];
  ganhosCoberturaV2: string[];
  problemasRecorrentes: string[];
  limitacoesRecorrentes: string[];

  areasValidadas: AreaValidacaoPiloto[];
  areasFaltantes: AreaValidacaoPiloto[];

  statusProntidao: StatusProntidaoPiloto;
  justificativaStatus: string;
}
