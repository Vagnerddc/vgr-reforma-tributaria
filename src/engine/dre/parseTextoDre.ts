import type { DadosApuradosCliente } from "../sped/agregador";

export interface DadosDrePdf {
  receitaLiquida: number;
  lucroBruto: number;
  /** Total já inclusivo das despesas administrativas (subgrupo) — NUNCA somar despesasAdministrativas em cima deste valor. */
  despesasOperacionais: number;
  /** Só informativo/para reclassificação por segmento — é subgrupo de despesasOperacionais, não some os dois. */
  despesasAdministrativas: number;
  resultadoOperacional: number;
  resultadoAntesIrCsl: number;
  lucroLiquidoExercicio: number;
  deducoes: { iss: number; cofins: number; pis: number; contribuicaoSocial: number; impostoDeRenda: number };
  /** Faturamento bruto DERIVADO (receitaLiquida + soma das deduções) — mais robusto que extrair a "RECEITA BRUTA" diretamente, cujo valor fica anexado ao último sub-item, não ao rótulo da seção. */
  faturamentoBrutoDerivado: number;
  avisos: string[];
}

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Último número em formato brasileiro (1.234.567,89 ou 123,45) encontrado na linha — os DREs colocam o valor ao final da linha do rótulo. */
function extrairValorDaLinha(linha: string): number | null {
  const matches = linha.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g);
  if (!matches || matches.length === 0) return null;
  const ultimo = matches[matches.length - 1];
  return Number(ultimo.replace(/\./g, "").replace(",", "."));
}

function encontrarValor(linhas: string[], rotulo: string): number | null {
  const rotuloNormalizado = normalizar(rotulo);
  const linha = linhas.find((l) => normalizar(l).includes(rotuloNormalizado));
  if (!linha) return null;
  return extrairValorDaLinha(linha);
}

/**
 * Extrai os totais de um DRE (texto já extraído do PDF, ex.: via pdfjs) por
 * RÓTULO — não por posição fixa, já que o layout varia entre exportações do
 * Domínio Sistemas. Cada total ausente gera um aviso em vez de assumir zero
 * silenciosamente, para que o contador saiba exatamente o que confirmar
 * manualmente antes de usar os valores na simulação.
 */
export function parseTextoDre(texto: string): DadosDrePdf {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const avisos: string[] = [];

  function obrigatorio(rotulo: string): number {
    const valor = encontrarValor(linhas, rotulo);
    if (valor === null) {
      avisos.push(`Não foi possível localizar "${rotulo}" no PDF — confirme e informe manualmente.`);
      return 0;
    }
    return valor;
  }

  const receitaLiquida = obrigatorio("RECEITA LIQUIDA");
  const lucroBruto = obrigatorio("LUCRO BRUTO");
  const despesasOperacionais = obrigatorio("DESPESAS OPERACIONAIS");
  const resultadoOperacional = obrigatorio("RESULTADO OPERACIONAL");
  const resultadoAntesIrCsl = encontrarValor(linhas, "RESULTADO ANTES DO IR") ?? encontrarValor(linhas, "RESULTADO ANTES DO IRCSL") ?? 0;
  const lucroLiquidoExercicio = obrigatorio("LUCRO LIQUIDO DO EXERCICIO");

  const despesasAdministrativas = encontrarValor(linhas, "DESPESAS ADMINISTRATIVAS") ?? 0;
  if (despesasAdministrativas > 0 && Math.abs(despesasAdministrativas - despesasOperacionais) < 0.01) {
    avisos.push(
      'Despesas administrativas têm o mesmo valor do total de despesas operacionais — indício de que este DRE não detalha custo separadamente (ex.: custo pode estar zerado ou embutido em outra linha). Confirme com o contador antes de usar; NÃO some despesas administrativas em cima de despesas operacionais, o total já as inclui.'
    );
  }

  const deducoes = {
    iss: encontrarValor(linhas, "(-) ISS") ?? 0,
    cofins: encontrarValor(linhas, "(-) COFINS") ?? 0,
    pis: encontrarValor(linhas, "(-) PIS") ?? 0,
    contribuicaoSocial: encontrarValor(linhas, "(-) CONTRIBUICAO SOCIAL") ?? 0,
    impostoDeRenda: encontrarValor(linhas, "(-) IMPOSTO DE RENDA") ?? 0,
  };
  const somaDeducoes = Object.values(deducoes).reduce((s, v) => s + v, 0);
  const faturamentoBrutoDerivado = receitaLiquida + somaDeducoes;

  if (somaDeducoes === 0) {
    avisos.push("Nenhuma dedução (ISS/PIS/COFINS/CSLL/IR) foi localizada — o faturamento bruto derivado pode estar igual à receita líquida. Confirme manualmente.");
  }

  return {
    receitaLiquida,
    lucroBruto,
    despesasOperacionais,
    despesasAdministrativas,
    resultadoOperacional,
    resultadoAntesIrCsl,
    lucroLiquidoExercicio,
    deducoes,
    faturamentoBrutoDerivado,
    avisos,
  };
}

/**
 * Mescla as despesas extraídas do DRE em PDF num DadosApuradosCliente já
 * existente (vindo das EFDs, que já trazem faturamento e tributos — o DRE só
 * cobre a lacuna de despesas quando não há ECD/ECF ainda). despesaOperacional
 * recebe o TOTAL do DRE (já inclusivo de despesa administrativa) e
 * despesaAdministrativa fica zerada aqui para não contar em dobro — o
 * detalhamento administrativo do DRE é só informativo, sem conta a conta
 * (por isso não alimenta saldosContabeisDetalhados nem a reclassificação por
 * segmento, que dependem da granularidade da ECD).
 */
export function mesclarDespesasDoDre(dados: DadosApuradosCliente, dre: DadosDrePdf): DadosApuradosCliente {
  return {
    ...dados,
    despesaOperacional: dre.despesasOperacionais,
    despesaAdministrativa: 0,
    custoMercadoriaInsumo: 0,
    usoConsumo: 0,
    imobilizado: 0,
    outros: 0,
    fonteDespesas: "dre_pdf",
    avisos: [
      ...dados.avisos,
      `Despesas de ${dados.periodoFim ?? "este período"} vieram do DRE em PDF (despesas operacionais totais, já inclusive de despesas administrativas) — sem ECD/ECF, não é possível separar por conta contábil nem aplicar a reclassificação por segmento.`,
      ...dre.avisos,
    ],
  };
}

/**
 * Aplica o DRE em PDF só quando ainda não há ECD/ECF para o ano — se uma ECD
 * já foi importada (mesmo que o DRE tenha sido carregado antes dela), a ECD
 * tem precedência por ser mais granular (conta a conta), e o DRE não deve
 * sobrescrever silenciosamente as despesas já classificadas. Em vez de
 * aplicar o merge, avisa explicitamente qual fonte está valendo — essa
 * ordem (ECD importada depois de um DRE já carregado) é justamente o caso
 * que motivou este guard (P0.3).
 */
export function mesclarDespesasDoDreComPrecedencia(dados: DadosApuradosCliente, dre: DadosDrePdf): DadosApuradosCliente {
  if (dados.fonteDespesas === "ecd") {
    return {
      ...dados,
      avisos: [
        ...dados.avisos,
        `Um DRE em PDF foi carregado para ${dados.periodoFim ?? "este período"}, mas a ECD/ECF importada tem precedência: as despesas usadas na simulação vêm da ECD (classificadas conta a conta), não do DRE.`,
      ],
    };
  }
  return mesclarDespesasDoDre(dados, dre);
}
