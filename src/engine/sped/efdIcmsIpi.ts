import { tokenizarSped, numeroSped } from "./parser";
import type { ArquivoSpedProcessado, MovimentoNota, NaturezaMovimento, Participante } from "./tipos";
import { processarRegistro0200, classificarPorTipoItem, type ItemCadastrado } from "./tabelaItens";

/**
 * Classifica a natureza do lançamento pelos 3 últimos dígitos do CFOP —
 * cobre os grupos mais comuns (Guia Prático EFD ICMS/IPI, tabela de CFOP).
 * Qualquer CFOP fora dessa lista cai em "outros", nunca é descartado do
 * total, apenas não é detalhado por natureza — ver avisos do arquivo.
 */
export function classificarPorCfopIcms(cfop: string, indOper: "entrada" | "saida"): NaturezaMovimento {
  const sufixo = cfop.slice(-3);
  if (indOper === "saida") {
    // vendas (produção própria, mercadoria adquirida, e suas variações interestaduais/exterior)
    if (["101", "102", "104", "105", "106", "109", "111", "112", "113", "114", "115", "116", "117", "118"].includes(sufixo)) {
      return "faturamento";
    }
    return "outros";
  }
  // entradas
  if (["101", "102", "111", "116", "117", "118", "120", "125", "128"].includes(sufixo)) {
    return "custoMercadoriaInsumo";
  }
  if (sufixo === "551") return "imobilizado";
  if (sufixo === "556") return "usoConsumo";
  return "outros";
}

export function processarEfdIcmsIpi(nomeArquivo: string, conteudo: string): ArquivoSpedProcessado {
  const registros = tokenizarSped(conteudo);
  const avisos: string[] = [];
  const participantes: Participante[] = [];
  const movimentos: MovimentoNota[] = [];
  const apuracoes: ArquivoSpedProcessado["apuracoes"] = [];
  let periodoInicio: string | undefined;
  let periodoFim: string | undefined;

  let codPartNotaAtual = "";
  let indOperNotaAtual: "entrada" | "saida" = "entrada";
  const itensCadastrados = new Map<string, ItemCadastrado>();

  for (const { reg, campos } of registros) {
    switch (reg) {
      case "0000": {
        // COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|IM|SUFRAMA|IND_PERFIL|IND_ATIV
        periodoInicio = campos[2];
        periodoFim = campos[3];
        break;
      }
      case "0200": {
        const item = processarRegistro0200(campos);
        itensCadastrados.set(item.codItem, item);
        break;
      }
      case "0150": {
        // COD_PART|NOME|COD_PAIS|CNPJ|CPF|IE|COD_MUN|SUFRAMA|END|NUM|COMPL|BAIRRO
        const [codPart, nome, , cnpj, cpf] = campos;
        participantes.push({
          codPart,
          nome,
          cnpj: cnpj || undefined,
          cpf: cpf || undefined,
          regime: "desconhecido",
          restringeCreditoDoCliente: false,
        });
        break;
      }
      case "C100": {
        // IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|...
        indOperNotaAtual = campos[0] === "1" ? "saida" : "entrada";
        codPartNotaAtual = campos[2] ?? "";
        break;
      }
      case "C170": {
        // NUM_ITEM|COD_ITEM|DESCR_COMPL|QTD|UNID|VL_ITEM|VL_DESC|IND_MOV|CST_ICMS|CFOP|...
        const codItem = campos[1] ?? "";
        const cfop = campos[9] ?? "";
        const valorItem = numeroSped(campos[5]);
        const itemCadastrado = itensCadastrados.get(codItem);
        // TIPO_ITEM (registro 0200) é a fonte estrutural primária de classificação — só
        // recorre ao CFOP quando o item não está cadastrado, ou quando TIPO_ITEM é
        // "serviços"/"outras" (sem sinal confiável, ver classificarPorTipoItem).
        const natureza =
          (itemCadastrado && classificarPorTipoItem(itemCadastrado.tipoItem, indOperNotaAtual)) ??
          classificarPorCfopIcms(cfop, indOperNotaAtual);
        movimentos.push({
          origem: "efd_icms_ipi",
          indOper: indOperNotaAtual,
          codPart: codPartNotaAtual,
          cfop,
          valorItem,
          natureza,
          ncm: itemCadastrado?.ncm,
        });
        break;
      }
      case "E110": {
        // VL_TOT_DEBITOS|VL_AJ_DEBITOS|VL_TOT_AJ_DEBITOS|VL_ESTORNOS_CRED|VL_TOT_CREDITOS|VL_AJ_CREDITOS|VL_TOT_AJ_CREDITOS|VL_ESTORNOS_DEB|VL_SLD_CREDOR_ANT|VL_SLD_APURADO|VL_TOT_DED|VL_ICMS_RECOLHER|...
        const valorRecolher = numeroSped(campos[11]);
        apuracoes.push({ tributo: "icms", periodo: periodoFim ?? "", valorRecolher });
        break;
      }
    }
  }

  if (apuracoes.length === 0) {
    avisos.push("Registro E110 (apuração do ICMS) não encontrado neste arquivo — carga atual de ICMS não pôde ser extraída automaticamente.");
  }

  return {
    tipo: "efd_icms_ipi",
    nomeArquivo,
    periodoInicio,
    periodoFim,
    participantes,
    movimentos,
    apuracoes,
    saldosContabeis: [],
    avisos,
  };
}
