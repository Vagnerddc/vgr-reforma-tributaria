import type { DadosApuradosCliente } from "./sped/agregador";

export interface AnoApurado {
  ano: number;
  dados: DadosApuradosCliente;
  /** Faturamento real informado pelo contador (corrige a sonegação — o SPED só declara o que foi emitido em nota) */
  faturamentoReal: number;
}

export interface MetodologiaMultiAno {
  custoMercadoriaInsumo: number;
  despesaOperacional: number;
  despesaAdministrativa: number;
  usoConsumo: number;
  imobilizado: number;
  outros: number;
  /** Faturamento real do ano mais recente informado — base para a projeção */
  faturamentoRealBase: number;
  /** Taxa de crescimento real ano a ano, derivada do faturamento real informado (só quando há 2 anos) */
  taxaCrescimentoReal: number | null;
  /** Média das cargas efetivas (tributo recolhido ÷ faturamento real) de cada ano informado */
  cargaTributariaAtualMedia: number;
  /** Média da alíquota efetiva de cada tributo (recolhido ÷ faturamento real) — preserva o detalhamento ICMS x PIS/Cofins */
  tributosEfetivos: { icms: number; pis: number; cofins: number };
  avisos: string[];
}

function tributosTotais(dados: DadosApuradosCliente): number {
  return dados.tributosRecolhidos.icms + dados.tributosRecolhidos.pis + dados.tributosRecolhidos.cofins;
}

function media(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

/**
 * Consolida um ou dois anos de dados apurados (SPED/DRE) usando o faturamento real
 * informado pelo contador em vez do faturamento declarado no SPED, que costuma estar
 * subdeclarado. Com dois anos, despesas e carga tributária atual entram como média
 * simples, e a taxa de crescimento é derivada da variação real de faturamento entre eles.
 */
export function apurarMetodologiaMultiAno(anos: AnoApurado[]): MetodologiaMultiAno {
  if (anos.length === 0) throw new Error("apurarMetodologiaMultiAno precisa de ao menos um ano de dados.");
  if (anos.length > 2) throw new Error("apurarMetodologiaMultiAno aceita no máximo dois anos (ex.: 2025 e 2026).");

  const ordenados = [...anos].sort((a, b) => a.ano - b.ano);
  const avisos: string[] = [];

  for (const { ano, faturamentoReal } of ordenados) {
    if (faturamentoReal <= 0) {
      avisos.push(`Faturamento real de ${ano} não informado (ou zero) — os cálculos vão usar o faturamento declarado no SPED, que pode estar subdeclarado.`);
    }
  }

  const faturamentoEfetivo = ordenados.map((a) => (a.faturamentoReal > 0 ? a.faturamentoReal : a.dados.faturamento));

  const custoMercadoriaInsumo = media(ordenados.map((a) => a.dados.custoMercadoriaInsumo));
  const despesaOperacional = media(ordenados.map((a) => a.dados.despesaOperacional));
  const despesaAdministrativa = media(ordenados.map((a) => a.dados.despesaAdministrativa));
  const usoConsumo = media(ordenados.map((a) => a.dados.usoConsumo));
  const imobilizado = media(ordenados.map((a) => a.dados.imobilizado));
  const outros = media(ordenados.map((a) => a.dados.outros));

  // Ano com faturamento zero (ex.: só ECD importada, sem nenhuma EFD daquele
  // ano) não entra na média de carga efetiva — dividir por zero geraria NaN,
  // que se propagaria pro resto do painel ("Imposto pago hoje: R$ NaN"),
  // achado num teste com dado real (ECD 2025 sem EFD do mesmo ano).
  const indicesComFaturamento = faturamentoEfetivo.map((_, i) => i).filter((i) => faturamentoEfetivo[i] > 0);
  if (indicesComFaturamento.length < ordenados.length && indicesComFaturamento.length > 0) {
    const anosExcluidos = ordenados.filter((_, i) => !indicesComFaturamento.includes(i)).map((a) => a.ano);
    avisos.push(
      `Carga tributária de ${anosExcluidos.join(", ")} não pôde ser calculada (faturamento zero nesse ano — provavelmente só a ECD foi importada, sem nenhuma EFD do mesmo ano) — a média usa só o(s) ano(s) com faturamento apurado.`
    );
  }

  function mediaPonderadaPorAnoComFaturamento(valores: (i: number) => number): number {
    if (indicesComFaturamento.length === 0) return 0;
    return media(indicesComFaturamento.map(valores));
  }

  const cargaTributariaAtualMedia = mediaPonderadaPorAnoComFaturamento(
    (i) => tributosTotais(ordenados[i].dados) / faturamentoEfetivo[i]
  );

  const tributosEfetivos = {
    icms: mediaPonderadaPorAnoComFaturamento((i) => ordenados[i].dados.tributosRecolhidos.icms / faturamentoEfetivo[i]),
    pis: mediaPonderadaPorAnoComFaturamento((i) => ordenados[i].dados.tributosRecolhidos.pis / faturamentoEfetivo[i]),
    cofins: mediaPonderadaPorAnoComFaturamento((i) => ordenados[i].dados.tributosRecolhidos.cofins / faturamentoEfetivo[i]),
  };
  if (indicesComFaturamento.length === 0) {
    avisos.push("Nenhum dos anos informados tem faturamento apurado (nem real, nem declarado no SPED) — carga tributária atual ficou zerada por falta de dado, não representa a realidade.");
  }

  const faturamentoRealBase = faturamentoEfetivo[faturamentoEfetivo.length - 1];

  let taxaCrescimentoReal: number | null = null;
  if (ordenados.length === 2) {
    const [anterior, atual] = faturamentoEfetivo;
    if (anterior > 0) {
      taxaCrescimentoReal = (atual - anterior) / anterior;
    } else {
      avisos.push("Não foi possível calcular a taxa de crescimento real: faturamento do primeiro ano é zero.");
    }
  }

  return {
    custoMercadoriaInsumo,
    despesaOperacional,
    despesaAdministrativa,
    usoConsumo,
    imobilizado,
    outros,
    faturamentoRealBase,
    taxaCrescimentoReal,
    cargaTributariaAtualMedia,
    tributosEfetivos,
    avisos,
  };
}

/**
 * Reconstrói um DadosApuradosCliente sintético, usando o faturamento real e as
 * médias apuradas por apurarMetodologiaMultiAno, para alimentar sem alterações
 * faturamentoParaMargemAlvo/projetarInputDoSped (que só conhecem um único
 * "ano" de dados apurados). Participantes e avisos técnicos vêm do ano mais
 * recente informado — a metodologia multi-ano é só sobre os valores agregados.
 */
export function sintetizarDadosParaProjecao(anos: AnoApurado[], resultado: MetodologiaMultiAno): DadosApuradosCliente {
  const maisRecente = [...anos].sort((a, b) => a.ano - b.ano)[anos.length - 1].dados;
  return {
    ...maisRecente,
    faturamento: resultado.faturamentoRealBase,
    custoMercadoriaInsumo: resultado.custoMercadoriaInsumo,
    despesaOperacional: resultado.despesaOperacional,
    despesaAdministrativa: resultado.despesaAdministrativa,
    usoConsumo: resultado.usoConsumo,
    imobilizado: resultado.imobilizado,
    outros: resultado.outros,
    tributosRecolhidos: {
      icms: resultado.tributosEfetivos.icms * resultado.faturamentoRealBase,
      pis: resultado.tributosEfetivos.pis * resultado.faturamentoRealBase,
      cofins: resultado.tributosEfetivos.cofins * resultado.faturamentoRealBase,
    },
    avisos: [...resultado.avisos, ...maisRecente.avisos],
  };
}
