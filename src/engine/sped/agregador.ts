import { tokenizarSped, identificarTipoArquivo } from "./parser";
import { processarEfdIcmsIpi } from "./efdIcmsIpi";
import { processarEfdContribuicoes } from "./efdContribuicoes";
import { processarEcd } from "./ecd";
import { processarEcf } from "./ecf";
import type { ArquivoSpedProcessado, MovimentoNota, NaturezaMovimento, Participante, SaldoContaContabil } from "./tipos";
import { buscarDadosCnpj } from "../../lib/cnpj";
import { identificarRegimeProdutoPorNcm } from "../produtoRegimeEspecial";

export interface ItemFaturamentoRegimeProduto {
  ncm: string;
  anexo: string;
  artigo: string;
  reducao: number;
  valor: number;
}

export interface FaturamentoPorRegimeProduto {
  /** Faturamento de itens com alíquota zero identificada por NCM (Anexos I/XV) */
  faturamentoZero: number;
  /** Faturamento de itens com redução de 60% identificada por NCM (Anexos IV/V/VII/IX) */
  faturamentoReduzido60: number;
  /** Faturamento de itens sem NCM cadastrado (0200) ou sem regime especial identificado — alíquota cheia por padrão, nunca assumido reduzido sem confirmação */
  faturamentoAliquotaCheia: number;
  itensIdentificados: ItemFaturamentoRegimeProduto[];
}

export interface DadosApuradosCliente {
  periodoInicio?: string;
  periodoFim?: string;
  participantes: Participante[];
  faturamento: number;
  custoMercadoriaInsumo: number;
  despesaOperacional: number;
  despesaAdministrativa: number;
  usoConsumo: number;
  imobilizado: number;
  outros: number;
  tributosRecolhidos: { icms: number; pis: number; cofins: number };
  /** "ecd" = ECD importada (fonte contábil completa); "efd_parcial" = despesas só das EFDs (cobertura parcial); "dre_pdf" = despesas vindas de um DRE em PDF importado (sem ECD/ECF disponível ainda) */
  fonteDespesas: "ecd" | "efd_parcial" | "dre_pdf";
  avisos: string[];
  arquivosProcessados: { tipo: string; nomeArquivo: string }[];
  /** Exposição financeira por parceiro, com o papel comercial (cliente/fornecedor/ambos) inferido pelo sentido dos lançamentos em que aparece — usado para o panorama de risco de crédito. */
  parceirosComExposicao: { participante: Participante; papel: "cliente" | "fornecedor" | "ambos"; valorTotal: number }[];
  /** Saldos por conta contábil individual (pré-soma), só populado quando há ECD — necessário para a reclassificação por segmento, que precisa da descrição conta a conta, não apenas do total já somado. */
  saldosContabeisDetalhados: SaldoContaContabil[];
  /** Faturamento (das EFDs, nota a nota) segmentado por regime especial de alíquota identificado via NCM (registro 0200) — ver produtoRegimeEspecial.ts. Todo zero quando não há NCM cadastrado nas notas (ex.: faturamento veio do fallback F500/F550 consolidado, ou de serviço sem NCM aplicável). */
  faturamentoPorRegimeProduto: FaturamentoPorRegimeProduto;
  /** Confere o faturamento apurado pelas EFDs (nota a nota / F500-F550) contra o que a própria ECD classificou como receita (via COD_NAT + hierarquia do plano de contas) — só populado quando há ECD. Ajuda a pegar SPEDs incompletos (ex.: faltou importar algum mês de EFD) antes de simular. */
  conferenciaEfdEcd?: { faturamentoEfd: number; faturamentoEcd: number; diferencaPercentual: number };
}

function somarPorNatureza(itens: { natureza: NaturezaMovimento; valor: number }[], natureza: NaturezaMovimento): number {
  return itens.filter((i) => i.natureza === natureza).reduce((soma, i) => soma + i.valor, 0);
}

/**
 * Segmenta o faturamento (movimentos de venda, nota a nota) por regime especial
 * de alíquota identificado via NCM — cada item vendido é cruzado contra os
 * Anexos da LC 214/2025 (ver produtoRegimeEspecial.ts). Sem NCM cadastrado no
 * item (registro 0200 não encontrado, ou faturamento vindo do fallback
 * consolidado F500/F550), cai em alíquota cheia por padrão — nunca assume
 * redução sem o dado estrutural que a confirme.
 */
function calcularFaturamentoPorRegimeProduto(movimentosFaturamento: MovimentoNota[]): FaturamentoPorRegimeProduto {
  let faturamentoZero = 0;
  let faturamentoReduzido60 = 0;
  let faturamentoAliquotaCheia = 0;
  const itensIdentificados: ItemFaturamentoRegimeProduto[] = [];

  for (const mov of movimentosFaturamento) {
    const regime = mov.ncm ? identificarRegimeProdutoPorNcm(mov.ncm) : null;
    if (!regime) {
      faturamentoAliquotaCheia += mov.valorItem;
      continue;
    }
    if (regime.reducao === 1) faturamentoZero += mov.valorItem;
    else faturamentoReduzido60 += mov.valorItem;
    itensIdentificados.push({ ncm: mov.ncm!, anexo: regime.anexo, artigo: regime.artigo, reducao: regime.reducao, valor: mov.valorItem });
  }

  return { faturamentoZero, faturamentoReduzido60, faturamentoAliquotaCheia, itensIdentificados };
}

/** Processa e agrega todos os arquivos SPED decodificados de um cliente num único panorama de dados apurados. */
export function agregarDadosCliente(
  arquivos: { nomeArquivo: string; conteudo: string }[]
): DadosApuradosCliente {
  const processados: ArquivoSpedProcessado[] = [];
  const avisosGerais: string[] = [];

  for (const { nomeArquivo, conteudo } of arquivos) {
    const registros = tokenizarSped(conteudo);
    const tipo = identificarTipoArquivo(registros);
    if (!tipo) {
      avisosGerais.push(
        `Não foi possível identificar o tipo do arquivo "${nomeArquivo}" — verifique se é um SPED válido (EFD ICMS/IPI, EFD Contribuições, ECD ou ECF).`
      );
      continue;
    }
    if (tipo === "efd_icms_ipi") processados.push(processarEfdIcmsIpi(nomeArquivo, conteudo));
    else if (tipo === "efd_contribuicoes") processados.push(processarEfdContribuicoes(nomeArquivo, conteudo));
    else if (tipo === "ecd") processados.push(processarEcd(nomeArquivo, conteudo));
    else processados.push(processarEcf(nomeArquivo, conteudo));
  }

  const participantesMap = new Map<string, Participante>();
  for (const processado of processados) {
    for (const participante of processado.participantes) {
      const chave = participante.cnpj || participante.cpf || `${processado.nomeArquivo}:${participante.codPart}`;
      if (!participantesMap.has(chave)) {
        const cpfSemCnpj = Boolean(participante.cpf && !participante.cnpj);
        participantesMap.set(chave, {
          ...participante,
          regime: cpfSemCnpj ? "pessoa_fisica" : "desconhecido",
          restringeCreditoDoCliente: cpfSemCnpj,
        });
      }
    }
  }
  const participantes = Array.from(participantesMap.values());

  const todosMovimentosCompletos: MovimentoNota[] = processados.flatMap((p) => p.movimentos);
  const todosMovimentos: { natureza: NaturezaMovimento; valor: number }[] = todosMovimentosCompletos.map((m) => ({
    natureza: m.natureza,
    valor: m.valorItem,
  }));
  const faturamentoPorRegimeProduto = calcularFaturamentoPorRegimeProduto(
    todosMovimentosCompletos.filter((m) => m.natureza === "faturamento")
  );
  const saldosContabeisDetalhados: SaldoContaContabil[] = processados.flatMap((p) => p.saldosContabeis);
  const todosSaldosContabeis: { natureza: NaturezaMovimento; valor: number }[] = saldosContabeisDetalhados.map((s) => ({
    natureza: s.natureza,
    valor: s.valorPeriodo,
  }));

  const temEcd = todosSaldosContabeis.length > 0;
  const faturamentoPorNotas = somarPorNatureza(todosMovimentos, "faturamento");
  // Fallback estrutural: sem nota a nota (A100/C170) de faturamento, mas com o
  // demonstrativo consolidado de receita (F500/F550 da EFD Contribuições) — comum
  // em prestadoras de serviço que declaram só o consolidado, não nota a nota.
  const receitaConsolidada = processados.reduce((soma, p) => soma + (p.receitaConsolidada ?? 0), 0);
  const faturamento = faturamentoPorNotas > 0 ? faturamentoPorNotas : receitaConsolidada;
  if (faturamentoPorNotas === 0 && receitaConsolidada > 0) {
    avisosGerais.push(
      `Faturamento de ${receitaConsolidada.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} veio do demonstrativo consolidado de receita (registro F500/F550 da EFD Contribuições) — não há notas fiscais de venda (C170/A100) detalhadas nos arquivos importados.`
    );
  }

  // Conferência EFD x ECD: a ECD também classifica receita (via COD_NAT + hierarquia,
  // ver ecd.ts) — cruzar contra o faturamento apurado pelas EFDs pega SPED incompleto
  // (ex.: esqueceu de importar algum mês) antes de simular com número errado.
  let conferenciaEfdEcd: DadosApuradosCliente["conferenciaEfdEcd"];
  if (temEcd) {
    const faturamentoEcd = somarPorNatureza(todosSaldosContabeis, "faturamento");
    if (faturamentoEcd > 0 && faturamento > 0) {
      const diferencaPercentual = (faturamento - faturamentoEcd) / faturamentoEcd;
      conferenciaEfdEcd = { faturamentoEfd: faturamento, faturamentoEcd, diferencaPercentual };
      if (Math.abs(diferencaPercentual) > 0.05) {
        avisosGerais.push(
          `Conferência EFD x ECD: o faturamento apurado pelas EFDs (${faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}) difere em ${(diferencaPercentual * 100).toFixed(0)}% do que a ECD registrou como receita (${faturamentoEcd.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}) — confira se todos os meses de EFD do período foram importados antes de simular.`
        );
      }
    }
  }

  let custoMercadoriaInsumo: number;
  let despesaOperacional: number;
  let despesaAdministrativa: number;
  let usoConsumo: number;
  let imobilizado: number;
  let outros: number;

  if (temEcd) {
    custoMercadoriaInsumo = somarPorNatureza(todosSaldosContabeis, "custoMercadoriaInsumo");
    despesaOperacional = somarPorNatureza(todosSaldosContabeis, "despesaOperacional");
    despesaAdministrativa = somarPorNatureza(todosSaldosContabeis, "despesaAdministrativa");
    usoConsumo = somarPorNatureza(todosSaldosContabeis, "usoConsumo");
    imobilizado = somarPorNatureza(todosSaldosContabeis, "imobilizado");
    outros = somarPorNatureza(todosSaldosContabeis, "outros");
  } else {
    custoMercadoriaInsumo = somarPorNatureza(todosMovimentos, "custoMercadoriaInsumo");
    despesaOperacional = somarPorNatureza(todosMovimentos, "despesaOperacional");
    despesaAdministrativa = somarPorNatureza(todosMovimentos, "despesaAdministrativa");
    usoConsumo = somarPorNatureza(todosMovimentos, "usoConsumo");
    imobilizado = somarPorNatureza(todosMovimentos, "imobilizado");
    outros = somarPorNatureza(todosMovimentos, "outros");
    if (processados.length > 0) {
      avisosGerais.push(
        "Sem ECD importada: despesas foram estimadas só a partir das notas fiscais das EFDs (Bloco A/C) — não capturam folha de pagamento, aluguel sem nota fiscal, etc. Importe a ECD para uma apuração mais completa das despesas operacionais/administrativas."
      );
    }
  }

  // P0 aprovado (item 10 da modelagem de crédito): despesaAdministrativa aqui é
  // um bloco agregado (soma de contas por natureza, sem granularidade categoria
  // a categoria) — hoje entra 100% na base de crédito (ver despesasFixasCreditaveis
  // em projecao.ts), por PREMISSA HERDADA do sistema anterior, não por confirmação
  // tributária. Não mudamos esse número aqui (preserva simulações existentes),
  // só tornamos essa premissa explícita para quem for interpretar o resultado —
  // ver engine/creditoTributario.ts (tratamento "indeterminado"/status "herdado").
  if (despesaAdministrativa > 0) {
    avisosGerais.push(
      `Despesa administrativa (${despesaAdministrativa.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}) considerada 100% na base de crédito por premissa herdada do sistema anterior — o tratamento tributário real pode variar por conta contábil e ainda não foi validado com essa granularidade. Pode ser refinado detalhando a composição no passo "Custos e despesas" do simulador.`
    );
  }

  const exposicaoPorParceiro = new Map<string, { entrada: number; saida: number }>();
  for (const mov of todosMovimentosCompletos) {
    const atual = exposicaoPorParceiro.get(mov.codPart) ?? { entrada: 0, saida: 0 };
    if (mov.indOper === "entrada") atual.entrada += mov.valorItem;
    else atual.saida += mov.valorItem;
    exposicaoPorParceiro.set(mov.codPart, atual);
  }
  const parceirosComExposicao: DadosApuradosCliente["parceirosComExposicao"] = [];
  for (const participante of participantes) {
    const exposicao = exposicaoPorParceiro.get(participante.codPart);
    if (!exposicao) continue;
    const papel = exposicao.entrada > 0 && exposicao.saida > 0 ? "ambos" : exposicao.saida > 0 ? "cliente" : "fornecedor";
    parceirosComExposicao.push({ participante, papel, valorTotal: exposicao.entrada + exposicao.saida });
  }

  const todasApuracoes = processados.flatMap((p) => p.apuracoes);
  const tributosRecolhidos = {
    icms: todasApuracoes.filter((a) => a.tributo === "icms").reduce((s, a) => s + a.valorRecolher, 0),
    pis: todasApuracoes.filter((a) => a.tributo === "pis").reduce((s, a) => s + a.valorRecolher, 0),
    cofins: todasApuracoes.filter((a) => a.tributo === "cofins").reduce((s, a) => s + a.valorRecolher, 0),
  };

  return {
    periodoInicio: processados.find((p) => p.periodoInicio)?.periodoInicio,
    periodoFim: processados.find((p) => p.periodoFim)?.periodoFim,
    participantes,
    faturamento,
    custoMercadoriaInsumo,
    despesaOperacional,
    despesaAdministrativa,
    usoConsumo,
    imobilizado,
    outros,
    tributosRecolhidos,
    fonteDespesas: temEcd ? "ecd" : "efd_parcial",
    avisos: [...avisosGerais, ...processados.flatMap((p) => p.avisos)],
    arquivosProcessados: processados.map((p) => ({ tipo: p.tipo, nomeArquivo: p.nomeArquivo })),
    parceirosComExposicao,
    saldosContabeisDetalhados,
    faturamentoPorRegimeProduto,
    conferenciaEfdEcd,
  };
}

/**
 * Consulta a Receita Federal (via /api/cnpj) para cada participante com CNPJ
 * único, e marca se ele restringe o crédito de CBS/IBS do cliente (Simples
 * Nacional unificado — presumimos unificado por padrão, já que o SPED não diz
 * se o parceiro optou pelo híbrido). Processa sequencialmente com um pequeno
 * intervalo entre chamadas para não estourar o rate limit da BrasilAPI.
 */
export async function enriquecerRegimeParceiros(
  participantes: Participante[],
  onProgresso?: (feitos: number, total: number) => void
): Promise<Participante[]> {
  const resultado = [...participantes];
  const pendentes = resultado.filter((p) => p.cnpj && p.regime === "desconhecido");

  for (let i = 0; i < pendentes.length; i++) {
    const participante = pendentes[i];
    try {
      const dados = await buscarDadosCnpj(participante.cnpj!);
      const ehSimples = dados.opcaoPeloSimples === true;
      participante.regime = ehSimples ? "simples_nacional" : "normal";
      participante.restringeCreditoDoCliente = ehSimples;
      participante.cnaePrincipal = dados.cnaePrincipalCodigo;
    } catch {
      participante.regime = "desconhecido";
    }
    onProgresso?.(i + 1, pendentes.length);
    if (i < pendentes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  return resultado;
}

function chaveParticipante(p: Participante): string {
  return p.cnpj || p.cpf || p.codPart;
}

/**
 * Aplica o regime/CNAE já consultado na Receita Federal (enriquecerRegimeParceiros)
 * de volta em cima de um DadosApuradosCliente — em AMBOS os lugares onde o
 * participante aparece: a lista plana (participantes) e cada entrada de
 * parceirosComExposicao (que guarda sua própria referência ao participante,
 * usada pelo PainelParceiros). Atualizar só a lista plana deixa o painel de
 * fornecedores/clientes sempre com "regime não confirmado", mesmo depois da
 * consulta — bug real encontrado ao corrigir o acumulador de EFDs por ano.
 */
export function aplicarEnriquecimentoParticipantes(
  dados: DadosApuradosCliente,
  enriquecidosPorChave: Map<string, Participante>
): DadosApuradosCliente {
  const resolver = (p: Participante) => enriquecidosPorChave.get(chaveParticipante(p)) ?? p;
  return {
    ...dados,
    participantes: dados.participantes.map(resolver),
    parceirosComExposicao: dados.parceirosComExposicao.map((pce) => ({ ...pce, participante: resolver(pce.participante) })),
  };
}
