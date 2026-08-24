import { tokenizarSped, numeroSped } from "./parser";
import type { ArquivoSpedProcessado, NaturezaMovimento, SaldoContaContabil } from "./tipos";

/**
 * Classificação por PALAVRA-CHAVE no nome da conta contábil — heurística, não
 * uma leitura do plano de contas referencial oficial (que varia por empresa).
 * Serve para refinar a separação despesaOperacional x despesaAdministrativa
 * quando o cliente tem ECD; na ausência de ECD, o simulador usa só o que vier
 * das EFDs (que não distinguem operacional de administrativa com a mesma
 * granularidade). Resultado sempre visível na tela para o contador confirmar.
 */
function classificarPorDescricaoConta(descricao: string): NaturezaMovimento {
  const d = descricao
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (d.includes("ADMINISTRATIV")) return "despesaAdministrativa";
  if (d.includes("IMOBILIZADO")) return "imobilizado";
  // "material(is) para construcao/obra" é custo direto de obra — checado antes do
  // "CUSTO" literal porque contas reais (visto em ECD de cliente real) usam esse
  // termo sem a palavra "custo" na descrição.
  if (d.includes("MATERIAL PARA CONSTRUCAO") || d.includes("MATERIAIS PARA CONSTRUCAO") || d.includes("MATERIAL DE OBRA")) {
    return "custoMercadoriaInsumo";
  }
  if (d.includes("CUSTO")) return "custoMercadoriaInsumo";
  if (d.includes("USO E CONSUMO") || d.includes("USO/CONSUMO")) return "usoConsumo";
  // "Despesas bancárias" é serviço de terceiro (o banco) sujeito a CBS/IBS,
  // logo creditável — achado em auditoria de ECD real (caía em "outros" por
  // não bater nenhuma palavra-chave). Checagem ESPECÍFICA, não um catch-all
  // genérico de "DESPESA": um catch-all pegaria "Salários e Ordenados"/folha
  // de pagamento, que é custo de mão de obra própria, NÃO gera crédito de
  // CBS/IBS (não é compra de terceiro) — teria inflado o crédito indevidamente.
  if (d.includes("DESPESA BANCARIA") || d.includes("DESPESAS BANCARIA")) return "despesaOperacional";
  // RECEITA/serviço prestado é checado ANTES de "VENDA" — contas reais como
  // "RECEITA DE VENDAS" contêm a palavra "VENDA" e caiam erradas em despesa
  // operacional se essa checagem viesse depois (achado em teste de conferência
  // EFD x ECD). "servico prestado" (receita de serviço) é o padrão de conta de
  // faturamento mais comum em empresas de serviço/construção civil, que não
  // usam a palavra "receita". Cuidado: NÃO usar a forma plural "SERVICOS
  // PRESTADOS" — colide com "SERVIÇOS PRESTADOS POR TERCEIROS", que é despesa
  // (mão de obra subcontratada comprada pela empresa), não receita própria.
  if (d.includes("RECEITA") || d.includes("SERVICO PRESTADO")) return "faturamento";
  if (d.includes("OPERACIONAL") || d.includes("COMERCIAL") || d.includes("VENDA")) return "despesaOperacional";
  return "outros";
}

interface ContaPlano {
  descricao: string;
  analitica: boolean;
  /** COD_NAT — 01 Ativo, 02 Passivo (inclui Patrimônio Líquido), 04 Resultado. Estrutural, direto do SPED — não é interpretação de texto. */
  codNat: string;
  /** COD_CTA_SUP — conta sintética pai na hierarquia do plano de contas, usada para subir e herdar a classificação de um grupo mais alto quando a própria conta não dá um sinal confiável. */
  codCtaSup: string;
}

const LIMITE_ALTURA_HIERARQUIA = 12;

/**
 * Classifica uma conta em 3 passos, na ordem que dá o sinal mais confiável
 * primeiro — igual à forma como o próprio SPED estrutura a informação:
 *
 * 1) COD_NAT (estrutural, direto do registro I050): contas de Ativo/Passivo
 *    (que inclui Patrimônio Líquido) NUNCA são despesa/custo/receita — mesmo
 *    que o texto contenha palavras como "despesa" (ex.: "DESPESAS PAGAS
 *    ANTECIPADAMENTE" é um ativo, não uma despesa do período). Cortar aqui
 *    evita que o keyword-matching abaixo erre por causa do texto da conta.
 * 2) Palavra-chave na própria conta (rápido, mais específico).
 * 3) Palavra-chave subindo pela hierarquia do plano de contas (COD_CTA_SUP)
 *    até achar um grupo com sinal confiável — contas de resultado costumam
 *    ficar agrupadas sob um rótulo padrão ("RECEITAS", "CUSTOS...",
 *    "DESPESAS OPERACIONAIS" etc.) mesmo quando a conta-folha em si usa uma
 *    descrição sem essas palavras (ex.: "SERVIÇO PRESTADO" sob um grupo
 *    "CONTAS DE RESULTADO - RECEITAS").
 *
 * O que sobra sem match em nenhum dos 3 passos é o que realmente precisa de
 * estudo manual por descrição — não é mais "genérico por padrão".
 */
function classificarConta(codCta: string, planoContas: Map<string, ContaPlano>): NaturezaMovimento {
  const conta = planoContas.get(codCta);
  if (!conta) return "outros";
  if (conta.codNat === "01" || conta.codNat === "02") return "outros"; // ativo/passivo/PL — nunca é conta de resultado

  const direto = classificarPorDescricaoConta(conta.descricao);
  if (direto !== "outros") return direto;

  let atual = conta;
  for (let i = 0; i < LIMITE_ALTURA_HIERARQUIA && atual.codCtaSup; i++) {
    const pai = planoContas.get(atual.codCtaSup);
    if (!pai) break;
    const classificacaoPai = classificarPorDescricaoConta(pai.descricao);
    if (classificacaoPai !== "outros") return classificacaoPai;
    atual = pai;
  }
  return "outros";
}

export function processarEcd(nomeArquivo: string, conteudo: string): ArquivoSpedProcessado {
  const registros = tokenizarSped(conteudo);
  const avisos: string[] = [];
  const saldosContabeis: SaldoContaContabil[] = [];
  let periodoInicio: string | undefined;
  let periodoFim: string | undefined;

  const planoContas = new Map<string, ContaPlano>();

  for (const { reg, campos } of registros) {
    switch (reg) {
      case "0000": {
        periodoInicio = campos[3];
        periodoFim = campos[4];
        break;
      }
      case "I050": {
        // DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|DESCR_CTA — o campo
        // CTA (código hierárquico externo) é opcional e alguns exportadores (ex.:
        // Domínio Sistemas, visto em ECD real) o omitem inteiramente em vez de
        // deixá-lo em branco entre pipes. CTA é sempre o penúltimo campo antes de
        // DESCR_CTA quando presente, então usamos posições estáveis (NAT, IND,
        // CODCTA, CODCTASUP nunca mudam) e o ÚLTIMO campo para a descrição.
        const [, codNat, indCta, , codCta, codCtaSup] = campos;
        const descrCta = campos[campos.length - 1];
        planoContas.set(codCta, { descricao: descrCta ?? "", analitica: indCta === "A", codNat, codCtaSup });
        break;
      }
      case "I155": {
        // COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN
        const codCta = campos[0];
        const valorDebito = numeroSped(campos[4]);
        const valorCredito = numeroSped(campos[5]);
        const conta = planoContas.get(codCta);
        if (!conta || !conta.analitica) break; // ignora contas sintéticas (totalizadoras), evita duplicar valores
        const natureza = classificarConta(codCta, planoContas);
        const valorPeriodo = Math.abs(valorDebito - valorCredito);
        if (valorPeriodo > 0) {
          saldosContabeis.push({ codCta, descricao: conta.descricao, natureza, valorPeriodo });
        }
        break;
      }
    }
  }

  if (planoContas.size === 0) {
    avisos.push("Registro I050 (plano de contas) não encontrado — não foi possível classificar despesas por conta contábil neste arquivo de ECD.");
  }
  if (saldosContabeis.length === 0) {
    avisos.push("Registro I155 (saldos periódicos) não encontrado ou sem movimento — despesas por conta contábil não extraídas.");
  }

  return {
    tipo: "ecd",
    nomeArquivo,
    periodoInicio,
    periodoFim,
    participantes: [],
    movimentos: [],
    apuracoes: [],
    saldosContabeis,
    avisos,
  };
}
