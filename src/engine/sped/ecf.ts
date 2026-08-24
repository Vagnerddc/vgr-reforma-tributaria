import { tokenizarSped } from "./parser";
import type { ArquivoSpedProcessado, ResumoEcf } from "./tipos";

/**
 * Registros do Bloco M/Y cuja PRESENÇA é seguro detectar (é só verificar se o
 * registro existe no arquivo — não depende de saber a posição de nenhum campo
 * dentro dele) — mas cujo CONTEÚDO não extraímos sem uma fixture real validada
 * (ver `ResumoEcf.blocosDetectadosNaoExtraidos`, docs/ingestao-documental-v2.md
 * §L). Detectar presença sem extrair valor não é "indeterminado" — é um dado
 * verdadeiro (o bloco existe) que ainda não vira número.
 */
const REGISTROS_BLOCO_M_Y_DE_INTERESSE = ["M300", "M350", "M300a", "N500", "N600", "N620", "N630", "Y540"];

/**
 * Extração MÍNIMA da ECF, deliberadamente. O leiaute do registro 0000 da ECF
 * é diferente do 0000 usado por EFD/ECD (mistura campos de identificação do
 * arquivo com dados do Bloco 0 de forma que não reproduzimos aqui com
 * confiança suficiente para não arriscar um índice errado). Em vez de
 * inventar posições de campo, este extrator só confirma que o arquivo é uma
 * ECF e detecta QUAIS blocos de apuração (M/Y) estão presentes — sem
 * extrair nenhum valor deles (receita bruta, resultado, bases de IRPJ/CSLL,
 * prejuízo fiscal continuam ausentes/"indeterminado" até existir uma fixture
 * real para validar as posições de campo com confiança; ver `ResumoEcf`).
 */
export function processarEcf(nomeArquivo: string, conteudo: string): ArquivoSpedProcessado {
  const registros = tokenizarSped(conteudo);
  const tiposPresentes = new Set(registros.map((r) => r.reg));
  const blocosDetectados = REGISTROS_BLOCO_M_Y_DE_INTERESSE.filter((reg) => tiposPresentes.has(reg));

  const resumoEcf: ResumoEcf = { blocosDetectadosNaoExtraidos: blocosDetectados };

  return {
    tipo: "ecf",
    nomeArquivo,
    participantes: [],
    movimentos: [],
    apuracoes: [],
    saldosContabeis: [],
    resumoEcf,
    avisos: [
      `ECF (${nomeArquivo}, ${registros.length} registros lidos): extração detalhada de receita bruta, resultado, bases de IRPJ/CSLL e prejuízo fiscal ainda não implementada — o layout do Bloco M/Y da ECF exige validação pontual contra um arquivo real antes de extrair valores automaticamente, para não arriscar apurar um número incorreto sem que o contador perceba.` +
        (blocosDetectados.length > 0
          ? ` Registros de apuração detectados neste arquivo (presença confirmada, conteúdo NÃO extraído): ${blocosDetectados.join(", ")}.`
          : ` Nenhum dos registros de apuração usuais (${REGISTROS_BLOCO_M_Y_DE_INTERESSE.join(", ")}) foi encontrado.`) +
        ` Use os valores de faturamento das EFDs, ou informe manualmente.`,
    ],
  };
}
