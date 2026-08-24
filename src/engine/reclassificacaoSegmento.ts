import type { NaturezaMovimento, SaldoContaContabil } from "./sped/tipos";
import type { PerfilAtividade } from "./atividades";
import type { DadosApuradosCliente } from "./sped/agregador";

export interface RegraReclassificacao {
  /** Substring (maiúscula, sem acento) procurada na descrição da conta contábil */
  palavraChave: string;
  categoriaCorrigida: NaturezaMovimento;
  motivo: string;
}

/**
 * A classificação contábil genérica (classificarPorDescricaoConta, em ecd.ts)
 * usa só palavras como "ADMINISTRATIV"/"OPERACIONAL" — o que é comumente
 * lançado como despesa administrativa muitas vezes é, economicamente, custo
 * direto da atividade-fim do segmento. Estas regras corrigem os casos mais
 * frequentes de má classificação por segmento, aprovadas em revisão com o
 * contador responsável antes de irem para produção.
 */
export const REGRAS_RECLASSIFICACAO: Record<PerfilAtividade, RegraReclassificacao[]> = {
  aviacao_agricola: [
    { palavraChave: "COMBUSTIVEL", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Combustível de aeronave é insumo direto da pulverização, não despesa administrativa." },
    { palavraChave: "MANUTENCAO DE AERONAVE", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Manutenção da aeronave é custo direto da atividade-fim." },
    { palavraChave: "PILOTO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Mão de obra do piloto está diretamente ligada à prestação do serviço de pulverização." },
    { palavraChave: "HANGAR", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Custo de hangaragem da aeronave é diretamente ligado à operação, não estrutura administrativa geral." },
  ],
  produtor_rural: [
    { palavraChave: "INSUMO AGRICOLA", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Insumo agrícola é custo direto da produção rural." },
    { palavraChave: "SEMENTE", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Semente é insumo direto da lavoura." },
    { palavraChave: "FERTILIZANTE", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Fertilizante é insumo direto da produção." },
    { palavraChave: "DEFENSIVO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Defensivo agrícola é insumo direto da produção." },
    { palavraChave: "MAO DE OBRA RURAL", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Mão de obra da lavoura é custo direto de produção, não despesa administrativa." },
  ],
  transporte_rodoviario_cargas: [
    { palavraChave: "COMBUSTIVEL", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Combustível da frota é custo direto do frete, não despesa administrativa." },
    { palavraChave: "PEDAGIO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Pedágio é custo direto da viagem/frete." },
    { palavraChave: "MOTORISTA", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Mão de obra do motorista está diretamente ligada à prestação do frete." },
    { palavraChave: "MANUTENCAO DE VEICULO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Manutenção da frota é custo direto da atividade-fim." },
    { palavraChave: "FRETE CONTRATADO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Frete subcontratado/agregado é custo direto do serviço prestado ao cliente final." },
  ],
  construcao_civil: [
    { palavraChave: "SERVICO PRESTADO POR TERCEIRO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Mão de obra subcontratada na obra é custo direto de execução — o caso de má classificação mais comum nesse segmento, normalmente lançado como despesa administrativa." },
    { palavraChave: "MATERIAL DE CONSTRUCAO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Material de construção aplicado na obra é custo direto, não despesa administrativa." },
    { palavraChave: "LOCACAO DE EQUIPAMENTO", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Locação de equipamento usado na obra é custo direto de execução." },
    { palavraChave: "MAO DE OBRA", categoriaCorrigida: "custoMercadoriaInsumo", motivo: "Mão de obra direta de execução da obra é custo, não despesa administrativa." },
  ],
};

function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface ResultadoReclassificacao {
  saldos: SaldoContaContabil[];
  avisos: string[];
}

/**
 * Aplica as regras de reclassificação do segmento aos saldos contábeis
 * detalhados (conta a conta). Só reclassifica quando a descrição da conta
 * contém a palavra-chave da regra — não força reclassificação onde não há
 * evidência textual, para não mascarar lançamentos que já estão corretos.
 */
export function reclassificarSaldosPorSegmento(
  saldos: SaldoContaContabil[],
  perfil: PerfilAtividade
): ResultadoReclassificacao {
  const regras = REGRAS_RECLASSIFICACAO[perfil] ?? [];
  const avisos: string[] = [];

  const saldosReclassificados = saldos.map((saldo) => {
    const descricaoNormalizada = normalizar(saldo.descricao);
    const regra = regras.find((r) => descricaoNormalizada.includes(normalizar(r.palavraChave)));
    if (!regra || regra.categoriaCorrigida === saldo.natureza) return saldo;
    avisos.push(
      `Reclassificado "${saldo.descricao}" de ${saldo.natureza} para ${regra.categoriaCorrigida}: ${regra.motivo}`
    );
    return { ...saldo, natureza: regra.categoriaCorrigida };
  });

  return { saldos: saldosReclassificados, avisos };
}

function somarPorNatureza(saldos: SaldoContaContabil[], natureza: NaturezaMovimento): number {
  return saldos.filter((s) => s.natureza === natureza).reduce((soma, s) => soma + s.valorPeriodo, 0);
}

/**
 * Recalcula os totais de despesa de um DadosApuradosCliente aplicando a
 * reclassificação por segmento aos saldos contábeis detalhados. Sem ECD
 * importada (saldosContabeisDetalhados vazio) devolve os dados sem alteração
 * — a reclassificação por conta contábil só é possível com ECD.
 */
export function aplicarReclassificacaoSegmento(
  dados: DadosApuradosCliente,
  perfil: PerfilAtividade
): DadosApuradosCliente {
  if (dados.saldosContabeisDetalhados.length === 0) return dados;

  const { saldos, avisos } = reclassificarSaldosPorSegmento(dados.saldosContabeisDetalhados, perfil);
  if (avisos.length === 0) return dados;

  return {
    ...dados,
    custoMercadoriaInsumo: somarPorNatureza(saldos, "custoMercadoriaInsumo"),
    despesaOperacional: somarPorNatureza(saldos, "despesaOperacional"),
    despesaAdministrativa: somarPorNatureza(saldos, "despesaAdministrativa"),
    usoConsumo: somarPorNatureza(saldos, "usoConsumo"),
    imobilizado: somarPorNatureza(saldos, "imobilizado"),
    outros: somarPorNatureza(saldos, "outros"),
    saldosContabeisDetalhados: saldos,
    avisos: [...dados.avisos, ...avisos],
  };
}
