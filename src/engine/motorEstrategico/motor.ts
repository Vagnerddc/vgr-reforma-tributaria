/**
 * Motor Estratégico — orquestra as regras acima sobre um
 * `RelatorioAuditoriaEstrategica` (Motor de Achados) já produzido.
 * Nenhum cálculo fiscal/financeiro/caixa/cenário/ponto-de-virada próprio
 * (seção 2). Determinístico (seção 40): mesmos achados/cenário/perfil/
 * pontos → mesmo `PlanoAlternativasEstrategicas`.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { RelatorioAuditoriaEstrategica } from "../motorAchados/tipos";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import { buscarPerfil } from "../setores/catalogo";
import { classificarAnexo } from "../motorRegimes/simplesNacional/anexo";
import { ANOS_SIMULACAO } from "../parametros";
import type { ContextoEstrategico } from "./contexto";
import { gerarAvaliarRecomposicaoPreco } from "./regras/preco";
import { gerarAvaliarEstruturaCreditos } from "./regras/creditos";
import { gerarAvaliarFatorR } from "./regras/fatorR";
import { gerarAvaliarRegimeTributario } from "./regras/regime";
import { gerarAvaliarCapitalGiro } from "./regras/capitalGiro";
import { gerarAvaliarCustoFinanceiro } from "./regras/custoFinanceiro";
import { gerarValidacoesDeDados } from "./regras/validacaoDados";
import { gerarConflitosAdicionais } from "./conflitos";
import { avaliarCoberturaEstrategica } from "./cobertura";
import type { AlternativaEstrategica, Bloqueio, PlanoAlternativasEstrategicas, QualidadeAchado, ValidacaoNecessaria } from "./tipos";

const ORDEM_CATEGORIAS: AlternativaEstrategica["categoria"][] = ["qualidade_dados", "regime", "fator_r", "creditos", "preco", "capital_giro", "custo_financeiro", "estrutura_custos", "mix_receitas", "folha"];

function ordenarAlternativas(alternativas: AlternativaEstrategica[]): AlternativaEstrategica[] {
  return [...alternativas].sort((a, b) => {
    const bloqueioA = a.bloqueios.length > 0 ? 0 : 1;
    const bloqueioB = b.bloqueios.length > 0 ? 0 : 1;
    if (bloqueioA !== bloqueioB) return bloqueioA - bloqueioB;
    return ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria);
  });
}

function piorQualidadeGeral(alternativas: AlternativaEstrategica[]): QualidadeAchado {
  if (alternativas.length === 0) return "insuficiente";
  const ordem: Record<QualidadeAchado, number> = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
  return alternativas.reduce((pior, a) => (ordem[a.qualidade] < ordem[pior] ? a.qualidade : pior), "alta" as QualidadeAchado);
}

function aplicavelFatorR(cenario: CenarioEmpresa): boolean {
  const perfilId = cenario.identificacao.atividadePrincipal?.perfilId;
  if (!perfilId) return false;
  const perfil = buscarPerfil(perfilId);
  if (!perfil) return false;
  return classificarAnexo(perfil).anexo === "indeterminado_fator_r";
}

export interface OpcoesGerarPlano {
  ano?: number;
  cenario: CenarioEmpresa;
  relatorio: RelatorioAuditoriaEstrategica;
  resultado: ResultadoCenario;
  pontosVirada?: ResultadoPontoVirada[];
}

export function gerarPlanoAlternativasEstrategicas(opcoes: OpcoesGerarPlano): PlanoAlternativasEstrategicas {
  const ano = opcoes.ano ?? ANOS_SIMULACAO[0];
  const ctx: ContextoEstrategico = { relatorio: opcoes.relatorio, resultado: opcoes.resultado, ano, pontosVirada: opcoes.pontosVirada ?? [] };

  const alternativas: AlternativaEstrategica[] = [];
  alternativas.push(...gerarAvaliarRecomposicaoPreco(ctx));
  alternativas.push(...gerarAvaliarEstruturaCreditos(ctx));
  if (aplicavelFatorR(opcoes.cenario)) alternativas.push(...gerarAvaliarFatorR(ctx));
  alternativas.push(...gerarAvaliarCapitalGiro(ctx));
  alternativas.push(...gerarAvaliarCustoFinanceiro(ctx));
  alternativas.push(...gerarValidacoesDeDados(ctx));

  const { alternativas: alternativasRegime, conflitos: conflitosRegime } = gerarAvaliarRegimeTributario(ctx);
  alternativas.push(...alternativasRegime);

  const conflitos = [...conflitosRegime, ...gerarConflitosAdicionais(ctx, alternativasRegime.map((a) => a.id))];

  const bloqueiosGlobais: Bloqueio[] = alternativas.flatMap((a) => a.bloqueios).filter((b, i, arr) => arr.findIndex((x) => x.tipo === b.tipo && x.descricao === b.descricao) === i);
  const validacoesNecessarias: ValidacaoNecessaria[] = alternativas.flatMap((a) => a.validacoesNecessarias).filter((v, i, arr) => arr.findIndex((x) => x.tipo === v.tipo && x.descricao === v.descricao) === i);

  return {
    cenarioId: opcoes.resultado.cenarioId,
    perfilSetorial: opcoes.cenario.identificacao.atividadePrincipal?.perfilId,
    alternativas: ordenarAlternativas(alternativas),
    conflitos,
    bloqueiosGlobais,
    validacoesNecessarias,
    qualidade: piorQualidadeGeral(alternativas),
    cobertura: avaliarCoberturaEstrategica(ctx, aplicavelFatorR(opcoes.cenario)),
  };
}
