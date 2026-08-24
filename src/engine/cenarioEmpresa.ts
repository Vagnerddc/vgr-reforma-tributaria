/**
 * CenarioEmpresa — contrato universal para representar a empresa e o
 * cenário sendo analisado, independente de setor (docs/auditoria-visao-
 * estrategica.md; ver também docs/cenario-empresa-setores.md para o
 * desenho completo desta fase).
 *
 * Não substitui nada existente: `OperacaoTributariaNormalizada` continua
 * representando a OPERAÇÃO fiscal granular; `SimulacaoInput`/`ResultadoAno`
 * continuam sendo a entrada/saída do Motor VGR (calculo.ts, intocado
 * nesta fase). CenarioEmpresa é a camada acima — a empresa como um todo,
 * da qual operações e simulações são derivadas ou para a qual convergem.
 *
 *   CenarioEmpresa
 *       ├── dados empresariais / receita / custos / pessoas
 *       ├── dados econômico-financeiros (placeholders — Motor Financeiro é fase futura)
 *       ├── perfil(is) setorial(is) (setores/tipos.ts)
 *       └── operacoesTributarias?: OperacaoTributariaNormalizada[]
 *
 * Nenhuma regra tributária vive aqui — só representação e completude.
 */

import type { CampoComProveniencia, OperacaoTributariaNormalizada } from "./operacaoTributaria";
import type { GastoInformado } from "./creditoTributario";
import type { Regime, MeioPagamento } from "./types";
import type { CaracteristicaSetorial, PerfilSetorial } from "./setores/tipos";

/** Referência a um perfil setorial aplicado à empresa — nunca embute o perfil inteiro, só aponta para o catálogo (setores/catalogo.ts), e carrega proveniência (CNAE sugeriu vs. usuário confirmou). */
export interface ReferenciaPerfilSetorial {
  perfilId: string;
  status: CampoComProveniencia<string>["status"];
  origem: CampoComProveniencia<string>["origem"];
}

export interface IdentificacaoEmpresa {
  nomeEmpresa?: CampoComProveniencia<string>;
  cnaes?: CampoComProveniencia<string>[];
  uf?: CampoComProveniencia<string>;
  municipio?: CampoComProveniencia<string>;
  periodo?: { inicio: string; fim: string };
  /**
   * Data de abertura (AAAA-MM-DD) — ÚNICA extensão do contrato nesta fase
   * (Motor de Simples Nacional), documentada aqui pelo mesmo motivo do
   * "adicional_irpj" na fase do Presumido: sem ela, é impossível
   * distinguir "empresa em início de atividade" (RBT12 proporcionalizada,
   * LC 123/2006, art. 3º, §2º) de "empresa com 12 meses completos" — a
   * diferença de regra é real, não estética. Extensão aditiva e opcional;
   * nenhum campo existente mudou. Teste de regressão:
   * motorRegimes/simplesNacional/__tests__/rbt12.test.ts.
   */
  dataAberturaEmpresa?: CampoComProveniencia<string>;
  /** Atividade que define a maior parte da receita/estrutura — obrigatória para a empresa ser representável; empresa mono-atividade só preenche esta. */
  atividadePrincipal?: ReferenciaPerfilSetorial;
  /** Empresas multiatividade (seção 10 do pedido) — ex.: frigorífico + distribuição atacadista — sem precisar de um tipo especial "FrigorificoComDistribuicao". */
  atividadesSecundarias?: ReferenciaPerfilSetorial[];
}

export interface ReceitaEmpresa {
  faturamentoAnual?: CampoComProveniencia<number>;
  /** Receita por natureza declarada livremente pelo perfil (ex.: "consultas", "procedimentos") — chave normalmente corresponde a uma pergunta/característica do PerfilSetorial, mas não é validado contra ela aqui (a validação de dados setoriais é responsabilidade de `dadosSetoriais`, não deste bloco). */
  receitasPorNatureza?: Record<string, CampoComProveniencia<number>>;
  /** Para multiatividade: receita atribuída a cada perfilId (atividadePrincipal ou uma das atividadesSecundarias). Soma não é validada contra faturamentoAnual nesta fase — é informação declarada, não derivada. */
  receitaPorAtividade?: Record<string, CampoComProveniencia<number>>;
  crescimentoAnualEstimado?: CampoComProveniencia<number>;
  mixMercado?: {
    mercadoInterno?: CampoComProveniencia<number>;
    exportacao?: CampoComProveniencia<number>;
    b2b?: CampoComProveniencia<number>;
    b2c?: CampoComProveniencia<number>;
  };
}

export interface CustosEmpresa {
  /** Reaproveita o modelo já existente (creditoTributario.ts) — natureza econômica e tratamento tributário continuam separados, nunca duplicados aqui. */
  itens: GastoInformado[];
}

export interface PessoasEmpresa {
  numeroEmpregados?: CampoComProveniencia<number>;
  folhaAnual?: CampoComProveniencia<number>;
  encargosAnual?: CampoComProveniencia<number>;
  numeroSocios?: CampoComProveniencia<number>;
  proLaboreAnual?: CampoComProveniencia<number>;
  terceirosAutonomosAnual?: CampoComProveniencia<number>;
}

/**
 * Ajuste fiscal (adição/exclusão) para apuração do Lucro Real — ÚNICA
 * extensão de contrato desta fase (Motor de Lucro Real), pelo mesmo
 * motivo já documentado para `adicional_irpj` (Presumido) e
 * `dataAberturaEmpresa` (Simples): sem uma estrutura própria, é
 * impossível representar "lucro contábil ≠ lucro tributável" — o
 * princípio central desta fase. Não modela nenhum ajuste específico
 * (isso é fora de escopo, seção 8 do pedido) — só o CONTRATO para
 * receber ajustes já identificados por quem informa o cenário.
 */
export interface AjusteFiscal {
  tipo: "adicao" | "exclusao";
  tributoAplicavel: "irpj" | "csll" | "ambos";
  valor: number;
  descricao: string;
  fundamento?: string;
  origem: CampoComProveniencia<string>["origem"];
  status: CampoComProveniencia<string>["status"];
}

export interface TributarioEmpresa {
  regimeAtual?: CampoComProveniencia<Regime>;
  /** Flags de contexto (ex.: "equiparacao_hospitalar") — nunca um valor de alíquota/crédito. Quem avalia o EFEITO é o motor fiscal/de regimes, não este bloco. */
  tratamentosEspeciais?: string[];
  beneficiosDeclarados?: string[];
  /** Operações granulares já normalizadas, quando existirem (XML/SPED) — reaproveitado, nunca duplicado. */
  operacoes?: OperacaoTributariaNormalizada[];
  /** Premissas livres declaradas para a simulação (ex.: "percentualCustosCreditaveis" quando não derivável de `custos.itens`) — sempre com proveniência, nunca um valor "solto". */
  premissas?: Record<string, CampoComProveniencia<unknown>>;
  /** Adições/exclusões já identificadas para o Lucro Real — ausência NÃO significa ausência real de ajustes (ver motorRegimes/lucroReal, qualidade da base fiscal). */
  ajustesFiscais?: AjusteFiscal[];
  /** Saldo de prejuízo fiscal (IRPJ) e base negativa (CSLL) acumulados ANTES do primeiro ano simulado — trava de 30% aplicada a partir daqui (Lei 9.065/1995, arts. 15/16). */
  saldosPrejuizoAnteriores?: { irpj?: CampoComProveniencia<number>; csll?: CampoComProveniencia<number> };
}

/**
 * Placeholders para o futuro Motor Econômico-Financeiro (não implementado
 * nesta fase) — a estrutura só precisa EXISTIR para que o cenário consiga
 * receber esses dados quando o motor existir; nenhum cálculo é feito aqui.
 */
export interface EconomicoFinanceiroEmpresa {
  margemAtual?: CampoComProveniencia<number>;
  lucroAtual?: CampoComProveniencia<number>;
  caixaDisponivel?: CampoComProveniencia<number>;
  capitalGiroNecessario?: CampoComProveniencia<number>;
  prazoMedioRecebimentoDias?: CampoComProveniencia<number>;
  prazoMedioPagamentoDias?: CampoComProveniencia<number>;
  precoMedioPraticado?: CampoComProveniencia<number>;
  meioPagamentoPredominante?: CampoComProveniencia<MeioPagamento>;
}

export type ValorCaracteristicaSetorial = boolean | number | string;

/**
 * Dados setoriais tipados — NÃO é `dados: any`. Cada valor é sempre
 * relativo a uma `CaracteristicaSetorial.id` declarada no PerfilSetorial
 * correspondente; `validarDadosSetoriais` confirma isso em runtime (não há
 * como impedir 100% em tempo de compilação sem gerar um tipo por
 * segmento, o que contrariaria a extensibilidade pedida — ver seção 6/18
 * do pedido). Uma empresa multiatividade tem um `DadosSetoriais` por
 * perfil (principal + cada secundária), nunca um objeto único misturando
 * características de perfis diferentes.
 */
export interface DadosSetoriais {
  perfilId: string;
  valores: Record<string, CampoComProveniencia<ValorCaracteristicaSetorial>>;
}

export interface ResultadoValidacaoDadosSetoriais {
  validos: boolean;
  /** Campos presentes em `valores` cujo tipo não corresponde ao declarado no perfil (ex.: string onde se esperava número). */
  camposComTipoInvalido: string[];
  /** Campos presentes em `valores` que não correspondem a nenhuma CaracteristicaSetorial do perfil — não é erro fatal (dado extra é preservado, não descartado), mas é sinalizado. */
  camposDesconhecidos: string[];
}

function tipoCompativel(caracteristica: CaracteristicaSetorial, valor: ValorCaracteristicaSetorial): boolean {
  switch (caracteristica.tipo) {
    case "booleano":
      return typeof valor === "boolean";
    case "numero":
    case "percentual":
      return typeof valor === "number";
    case "texto":
      return typeof valor === "string";
    case "enum":
      return typeof valor === "string" && (caracteristica.opcoes ?? []).includes(valor);
  }
}

/** Valida um DadosSetoriais contra o PerfilSetorial declarado — nunca lança, só reporta, porque dado setorial é sempre opcional (ver seção 17 do pedido: completude parcial é esperada, não erro). */
export function validarDadosSetoriais(perfil: PerfilSetorial, dados: DadosSetoriais): ResultadoValidacaoDadosSetoriais {
  const porId = new Map(perfil.caracteristicasDisponiveis.map((c) => [c.id, c]));
  const camposComTipoInvalido: string[] = [];
  const camposDesconhecidos: string[] = [];

  for (const [chave, campo] of Object.entries(dados.valores)) {
    const caracteristica = porId.get(chave);
    if (!caracteristica) {
      camposDesconhecidos.push(chave);
      continue;
    }
    if (!tipoCompativel(caracteristica, campo.valor)) camposComTipoInvalido.push(chave);
  }

  return { validos: camposComTipoInvalido.length === 0, camposComTipoInvalido, camposDesconhecidos };
}

export interface CenarioEmpresa {
  id: string;
  identificacao: IdentificacaoEmpresa;
  receita: ReceitaEmpresa;
  custos: CustosEmpresa;
  pessoas: PessoasEmpresa;
  tributario: TributarioEmpresa;
  economicoFinanceiro: EconomicoFinanceiroEmpresa;
  /** Um item por atividade (principal + cada secundária) — multiatividade sem tipo especial, ver seção 10 do pedido. */
  dadosSetoriais: DadosSetoriais[];
}

/**
 * Completude por eixo (0–100), estrutura preparada agora (seção 17 do
 * pedido) com uma medição simples de presença de campo — não é um score
 * de qualidade sofisticado, é só "quanto do bloco está preenchido". Um
 * Score Estratégico (fase futura, não implementada) pode compor sobre
 * isso, mas esta função não decide nada por conta própria.
 */
export interface CompletudeCenario {
  fiscal: number;
  economica: number;
  financeira: number;
  setorial: number;
}

function percentualPresente(campos: (unknown | undefined)[]): number {
  if (campos.length === 0) return 0;
  const presentes = campos.filter((c) => c !== undefined).length;
  return (presentes / campos.length) * 100;
}

export function avaliarCompletudeCenario(cenario: CenarioEmpresa): CompletudeCenario {
  const fiscal = percentualPresente([cenario.tributario.regimeAtual, cenario.identificacao.uf, cenario.identificacao.municipio, cenario.identificacao.cnaes?.length ? true : undefined]);

  const economica = percentualPresente([cenario.receita.faturamentoAnual, cenario.custos.itens.length > 0 ? true : undefined, cenario.receita.crescimentoAnualEstimado]);

  const financeira = percentualPresente([
    cenario.economicoFinanceiro.margemAtual,
    cenario.economicoFinanceiro.caixaDisponivel,
    cenario.economicoFinanceiro.capitalGiroNecessario,
    cenario.economicoFinanceiro.precoMedioPraticado,
  ]);

  const setorial = cenario.dadosSetoriais.length === 0 ? 0 : percentualPresente(cenario.dadosSetoriais.flatMap((d) => Object.values(d.valores)));

  return { fiscal, economica, financeira, setorial };
}
