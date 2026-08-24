/**
 * Modelo normalizado VGR para a arquitetura híbrida (Motor Oficial + Motor
 * VGR) — ver docs/arquitetura-motor-hibrido.md para o desenho completo.
 *
 * Este módulo é ADITIVO: não altera nem é importado por calculo.ts, pelo
 * agregador SPED atual, ou por qualquer componente de UI existente. É a
 * fundação de um pipeline paralelo (ver sped/granular.ts) que coexiste com o
 * pipeline de agregação já em produção.
 */

/** De onde uma INFORMAÇÃO (um dado de entrada) veio. Nunca usado para resultado de cálculo — ver OrigemCalculo. */
export type OrigemInformacao =
  | "xml"
  | "sped"
  | "informado_usuario"
  | "classificacao_vgr";

/** Quão confiável é essa informação — dimensão independente de onde ela veio. */
export type StatusInformacao = "confirmado" | "estimado" | "herdado" | "importado";

export interface CampoComProveniencia<T> {
  valor: T;
  origem: OrigemInformacao;
  status: StatusInformacao;
  /** Nota curta sobre a proveniência, quando o dado exige contexto (ex.: "município da empresa, não da operação"). */
  observacao?: string;
}

function campo<T>(valor: T, origem: OrigemInformacao, status: StatusInformacao, observacao?: string): CampoComProveniencia<T> {
  return { valor, origem, status, observacao };
}
export { campo as campoComProveniencia };

/**
 * Domínio próprio da VGR para representar uma operação tributária — não é
 * cópia do DTO da Calculadora Oficial (ver contrato real mapeado no spike,
 * docs/arquitetura-motor-hibrido.md §2.2). Nenhum campo é obrigatório: uma
 * operação incompleta ainda é uma OperacaoTributariaNormalizada válida —
 * a completude é avaliada separadamente (ver avaliarCompletudeOperacao).
 */
export interface OperacaoTributariaNormalizada {
  /** Identidade estável — ver gerarIdEstavelOperacao. Não depende de índice/posição temporária. */
  id: string;

  identificacao: {
    empresaId?: CampoComProveniencia<string>;
    documentoId?: CampoComProveniencia<string>;
    itemId?: CampoComProveniencia<string>;
    data?: CampoComProveniencia<string>;
    tipoOperacao?: CampoComProveniencia<"entrada" | "saida">;
  };

  produtoServico: {
    descricao?: CampoComProveniencia<string>;
    ncm?: CampoComProveniencia<string>;
    nbs?: CampoComProveniencia<string>;
    unidade?: CampoComProveniencia<string>;
    quantidade?: CampoComProveniencia<number>;
  };

  classificacaoTributaria: {
    cst?: CampoComProveniencia<string>;
    cClassTrib?: CampoComProveniencia<string>;
    cfop?: CampoComProveniencia<string>;
  };

  valores: {
    valorOperacao?: CampoComProveniencia<number>;
    baseCalculo?: CampoComProveniencia<number>;
    descontos?: CampoComProveniencia<number>;
  };

  localidade: {
    uf?: CampoComProveniencia<string>;
    municipio?: CampoComProveniencia<string>;
  };

  participantes?: {
    fornecedor?: { identificacao?: CampoComProveniencia<string> };
    cliente?: { identificacao?: CampoComProveniencia<string> };
  };

  /** Propriedade da extração, não do formato de origem — ver docs/arquitetura-motor-hibrido.md §3. Um SPED pode produzir "item" quando o registro permite; um XML malformado pode cair em "agregado". */
  granularidade: "item" | "agregado";
}

/** Só existem dois motores capazes de produzir um RESULTADO — dimensão separada de OrigemInformacao (dado de entrada). */
export type OrigemCalculo = "motor_oficial" | "motor_vgr";

export interface ResultadoCalculoNormalizado {
  operacaoId: string;

  valores: {
    debito?: number;
    credito?: number;
    cbs?: number;
    ibs?: number;
    is?: number;
    baseCalculo: number;
    aliquotaEfetiva?: number;
    reducoes?: { descricao: string; percentual: number }[];
    cargaTributaria: number;
  };

  memoriaCalculo?: {
    narrativa?: string;
    fundamentoLegal?: string;
    regrasAplicadas?: string[];
  };

  alertas?: string[];

  proveniencia: {
    origemCalculo: OrigemCalculo;
    versaoMotor: string;
    executadoEm: string;
    qualidade: "confirmado" | "estimativa";
    /** Obrigatório quando qualidade === "estimativa" — nunca fallback silencioso (docs/arquitetura-motor-hibrido.md §6/§8 do pedido original). */
    motivoEstimativa?: string;
  };
}

/** Campos mínimos exigidos pelo contrato real do Motor Oficial (confirmado no spike — "Regime Geral"). */
const CAMPOS_EXIGIDOS_MOTOR_OFICIAL = [
  "municipio",
  "uf",
  "ncm",
  "cst",
  "cClassTrib",
  "quantidade",
  "unidade",
  "valorOperacao",
] as const;

export interface ResultadoCompletude {
  /** Temos os campos que o Motor Oficial exige? Independe de os valores serem confirmados ou estimados. */
  completudeEntrada: "completa" | "parcial" | "insuficiente";
  camposFaltantes: string[];
  /** Dos campos presentes, qual a pior confiabilidade — não confundir com completude (uma operação pode ter todos os campos e ainda assim ser majoritariamente estimada). */
  qualidadeClassificacao: "confirmada" | "herdada" | "estimada" | "importada" | "sem_dados";
}

function valorPresente(op: OperacaoTributariaNormalizada, campo: (typeof CAMPOS_EXIGIDOS_MOTOR_OFICIAL)[number]): CampoComProveniencia<unknown> | undefined {
  switch (campo) {
    case "municipio": return op.localidade.municipio;
    case "uf": return op.localidade.uf;
    case "ncm": return op.produtoServico.ncm;
    case "cst": return op.classificacaoTributaria.cst;
    case "cClassTrib": return op.classificacaoTributaria.cClassTrib;
    case "quantidade": return op.produtoServico.quantidade;
    case "unidade": return op.produtoServico.unidade;
    case "valorOperacao": return op.valores.valorOperacao;
  }
}

/**
 * Avalia o que a operação POSSUI e o que FALTA para o cálculo normativo por
 * operação — não decide se ela deve ser enviada ao Motor Oficial (isso é
 * avaliarElegibilidadeMotorOficial, fase futura, não implementada aqui) e
 * não confunde completude (quantos campos existem) com qualidade (quão
 * confiáveis são os campos que existem) — são avaliações independentes,
 * como pedido.
 */
export function avaliarCompletudeOperacao(op: OperacaoTributariaNormalizada): ResultadoCompletude {
  const faltantes: string[] = [];
  const statusPresentes: StatusInformacao[] = [];

  for (const nomeCampo of CAMPOS_EXIGIDOS_MOTOR_OFICIAL) {
    const c = valorPresente(op, nomeCampo);
    if (c === undefined || c.valor === undefined || c.valor === "") {
      faltantes.push(nomeCampo);
    } else {
      statusPresentes.push(c.status);
    }
  }

  const completudeEntrada: ResultadoCompletude["completudeEntrada"] =
    faltantes.length === 0 ? "completa" : faltantes.length === CAMPOS_EXIGIDOS_MOTOR_OFICIAL.length ? "insuficiente" : "parcial";

  const qualidadeClassificacao: ResultadoCompletude["qualidadeClassificacao"] =
    statusPresentes.length === 0
      ? "sem_dados"
      : statusPresentes.includes("estimado")
        ? "estimada"
        : statusPresentes.includes("herdado")
          ? "herdada"
          : statusPresentes.includes("importado")
            ? "importada"
            : "confirmada";

  return { completudeEntrada, camposFaltantes: faltantes, qualidadeClassificacao };
}

export interface ResultadoCompletudeGerencial {
  completa: boolean;
  camposFaltantes: string[];
}

/**
 * Completude para uso GERENCIAL (Motor VGR) — dimensão independente da
 * completude normativa (avaliarCompletudeOperacao). Uma operação pode ser
 * gerencialmente completa (temos valor e direção) e normativamente
 * incompleta (falta cClassTrib) ao mesmo tempo — nenhuma das duas decide a
 * outra.
 */
export function avaliarCompletudeGerencial(op: OperacaoTributariaNormalizada): ResultadoCompletudeGerencial {
  const faltantes: string[] = [];
  if (op.valores.valorOperacao?.valor === undefined) faltantes.push("valorOperacao");
  if (op.identificacao.tipoOperacao?.valor === undefined) faltantes.push("tipoOperacao");
  return { completa: faltantes.length === 0, camposFaltantes: faltantes };
}

export interface CompletudeDupla {
  gerencial: ResultadoCompletudeGerencial;
  normativa: ResultadoCompletude;
}

/** Avalia as duas dimensões de completude juntas — conveniência de relatório, sem misturar os critérios. */
export function avaliarCompletudeDupla(op: OperacaoTributariaNormalizada): CompletudeDupla {
  return { gerencial: avaliarCompletudeGerencial(op), normativa: avaliarCompletudeOperacao(op) };
}

/**
 * Identidade estável para rastreamento/cache/reprocessamento futuro — nunca
 * derivada de índice de array ou posição temporária. Usa a chave documental
 * natural (chave de acesso de NF-e/NFS-e) quando existe; cai numa chave
 * determinística (arquivo + documento + item) quando não existe — mas nunca
 * um índice que mudaria se a ordem de leitura mudasse.
 */
export function gerarIdEstavelOperacao(partes: { chaveDocumental?: string; nomeArquivo: string; numeroDocumento: string; numeroItem: string }): string {
  if (partes.chaveDocumental) return `${partes.chaveDocumental}-${partes.numeroItem}`;
  return `${partes.nomeArquivo}:${partes.numeroDocumento}:${partes.numeroItem}`;
}
