/**
 * Taxonomia setorial — núcleo tributário-financeiro universal + perfis
 * setoriais especializados (docs/auditoria-visao-estrategica.md, seção J,
 * fase inicial). Nenhuma regra tributária vive aqui: um PerfilSetorial
 * declara CONTEXTO (o que é essa atividade, quais características ela
 * pode ter, quais módulos são potencialmente relevantes) — quem decide o
 * EFEITO tributário de qualquer característica é o motor fiscal/de
 * regimes, nunca este módulo.
 */

/**
 * Classificação transversal, independente do setor cadastral — uma mesma
 * empresa pode ter mais de um arquétipo (ex.: frigorífico = industria +
 * comercio). Usado para inferir estrutura econômica/perguntas/indicadores
 * comuns entre setores diferentes que operam de forma parecida.
 */
export type ArquetipoEconomico =
  | "servico"
  | "comercio"
  | "industria"
  | "agro"
  | "construcao"
  | "transporte"
  | "locacao"
  | "financeiro"
  | "digital"
  | "misto";

export type TipoCaracteristica = "booleano" | "numero" | "percentual" | "texto" | "enum";

/** Um traço operacional que pode ou não se aplicar a uma empresa dentro de um segmento — ex.: "abate_proprio" no frigorífico. Nunca carrega efeito tributário. */
export interface CaracteristicaSetorial {
  id: string;
  label: string;
  tipo: TipoCaracteristica;
  /** Só quando tipo === "enum". */
  opcoes?: string[];
}

/** Pergunta que a UI (futura, não implementada nesta fase) poderia fazer para preencher uma característica — produz dado estruturado, nunca calcula imposto na camada do formulário. */
export interface PerguntaSetorial {
  id: string;
  pergunta: string;
  tipo: TipoCaracteristica;
  opcoes?: string[];
  /** Id da CaracteristicaSetorial que essa pergunta preenche, quando aplicável — permite religar pergunta → dado sem duplicar o campo. */
  preencheCaracteristica?: string;
}

export interface MacroSetor {
  id: string;
  nome: string;
}

/**
 * Nó da taxonomia Macrosetor → Setor → Segmento → Subsegmento. O catálogo
 * inicial (config/setores/taxonomia.json) só popula alguns níveis para
 * cada entrada — a hierarquia é representável mesmo quando não totalmente
 * preenchida (ex.: um segmento pode não ter "setor" intermediário
 * nomeado, e subsegmentos são rótulos livres, não objetos completos,
 * porque essa fase não cataloga o Brasil inteiro — ver seção 8 do pedido).
 */
export interface PerfilSetorial {
  /** Slug estável — nunca reaproveitado para outro segmento, mesmo se o catálogo for reorganizado. */
  id: string;
  macroSetor: string;
  /** Agrupamento intermediário opcional, só um rótulo (ex.: "Serviços médicos" dentro de "Saúde"). */
  setor?: string;
  segmento: string;
  subsegmentos?: string[];
  descricao: string;
  /** Nunca um único arquétipo obrigatório — uma empresa real pode combinar mais de um. */
  arquetipos: ArquetipoEconomico[];
  caracteristicasDisponiveis: CaracteristicaSetorial[];
  /** Chaves de módulo cujo cálculo/regra ainda não existe (fase futura) — aqui só declara DISPONIBILIDADE conceitual, nunca calcula. */
  modulosAplicaveis: string[];
  perguntasEspecificas: PerguntaSetorial[];
  /** CNAEs que costumam sugerir este perfil — nunca o determinam sozinhos, ver avaliarSugestaoPerfilPorCnae em catalogo.ts. */
  cnaesSugeridos?: string[];
}
