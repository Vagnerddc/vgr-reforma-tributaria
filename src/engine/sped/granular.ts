import { tokenizarSped, numeroSped } from "./parser";
import { processarRegistro0200, type ItemCadastrado } from "./tabelaItens";
import { campoComProveniencia as campo, gerarIdEstavelOperacao, type OperacaoTributariaNormalizada } from "../operacaoTributaria";

/**
 * Pipeline granular PARALELO ao pipeline de agregação existente
 * (efdIcmsIpi.ts/efdContribuicoes.ts → agregador.ts). Lê os mesmos registros
 * SPED tokenizados, mas produz OperacaoTributariaNormalizada por item, sem
 * agregar e sem descartar nenhum campo granular disponível no layout.
 *
 * Regra da fase: preservar primeiro, agregar depois. Nada aqui substitui ou
 * altera processarEfdIcmsIpi/processarEfdContribuicoes/agregarDadosCliente —
 * este módulo não é chamado por eles nem pelo restante do produto ainda.
 *
 * Não inventa dados ausentes: um campo que o layout SPED não carrega
 * (cClassTrib, NBS — nenhum dos dois existe no leiaute EFD legado) fica
 * simplesmente ausente na operação normalizada, nunca preenchido com um
 * valor fictício.
 */

interface CabecalhoArquivo {
  uf?: string;
  municipioEmpresa?: string;
}

function extrairCabecalho0000(campos: string[], layout: "icms_ipi" | "contribuicoes"): CabecalhoArquivo {
  // EFD ICMS/IPI: COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|...
  // EFD Contribuições: COD_VER|TIPO_ESCRIT|IND_SIT_ESP|NUM_REC_ANTERIOR|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|... (sem COD_MUN nesse registro)
  if (layout === "icms_ipi") {
    return { uf: campos[7] || undefined, municipioEmpresa: campos[9] || undefined };
  }
  return { uf: campos[9] || undefined, municipioEmpresa: undefined };
}

/**
 * Extrai operações granulares de um arquivo EFD ICMS/IPI já tokenizado —
 * mesma fonte de dados que processarEfdIcmsIpi, lida de forma independente.
 */
export function extrairOperacoesGranularesEfdIcmsIpi(nomeArquivo: string, conteudo: string): OperacaoTributariaNormalizada[] {
  const registros = tokenizarSped(conteudo);
  const operacoes: OperacaoTributariaNormalizada[] = [];
  const itensCadastrados = new Map<string, ItemCadastrado>();
  let cabecalho: CabecalhoArquivo = {};

  let docAtual: { numDoc: string; chaveNfe?: string; dtDoc?: string; indOper: "entrada" | "saida"; codPart: string } | null = null;

  for (const { reg, campos } of registros) {
    if (reg === "0000") {
      cabecalho = extrairCabecalho0000(campos, "icms_ipi");
    } else if (reg === "0200") {
      const item = processarRegistro0200(campos);
      itensCadastrados.set(item.codItem, item);
    } else if (reg === "C100") {
      // IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|...
      docAtual = {
        indOper: campos[0] === "1" ? "saida" : "entrada",
        codPart: campos[2] ?? "",
        numDoc: campos[5] ?? "",
        chaveNfe: campos[6] || undefined,
        dtDoc: campos[7] || undefined,
      };
    } else if (reg === "C170" && docAtual) {
      // NUM_ITEM|COD_ITEM|DESCR_COMPL|QTD|UNID|VL_ITEM|VL_DESC|IND_MOV|CST_ICMS|CFOP|...
      const numItem = campos[0] ?? "";
      const codItem = campos[1] ?? "";
      const descricao = campos[2];
      const qtd = campos[3];
      const unidade = campos[4];
      const valorItem = campos[5];
      const cstIcms = campos[8];
      const cfop = campos[9];
      const itemCadastrado = itensCadastrados.get(codItem);

      const id = gerarIdEstavelOperacao({ chaveDocumental: docAtual.chaveNfe, nomeArquivo, numeroDocumento: docAtual.numDoc, numeroItem: numItem });

      const op: OperacaoTributariaNormalizada = {
        id,
        identificacao: {
          documentoId: docAtual.numDoc ? campo(docAtual.numDoc, "sped", "confirmado") : undefined,
          itemId: numItem ? campo(numItem, "sped", "confirmado") : undefined,
          data: docAtual.dtDoc ? campo(docAtual.dtDoc, "sped", "confirmado") : undefined,
          tipoOperacao: campo(docAtual.indOper, "sped", "confirmado"),
        },
        produtoServico: {
          descricao: descricao ? campo(descricao, "sped", "confirmado") : undefined,
          ncm: itemCadastrado?.ncm ? campo(itemCadastrado.ncm, "sped", "confirmado") : undefined,
          // NBS não existe no leiaute EFD ICMS/IPI — nunca inventado, permanece ausente.
          unidade: unidade ? campo(unidade, "sped", "confirmado") : undefined,
          quantidade: qtd ? campo(numeroSped(qtd), "sped", "confirmado") : undefined,
        },
        classificacaoTributaria: {
          // CST_ICMS é a classificação do sistema atual (ICMS), não o cClassTrib do sistema
          // novo — preservado sob a chave "cst" porque é conceitualmente o campo mais próximo
          // disponível hoje, mas não deve ser tratado como equivalente ao cClassTrib da RTC.
          cst: cstIcms ? campo(cstIcms, "sped", "confirmado") : undefined,
          // cClassTrib não existe no leiaute EFD legado — estruturalmente ausente, não estimado.
          cfop: cfop ? campo(cfop, "sped", "confirmado") : undefined,
        },
        valores: {
          valorOperacao: valorItem ? campo(numeroSped(valorItem), "sped", "confirmado") : undefined,
        },
        localidade: {
          uf: cabecalho.uf ? campo(cabecalho.uf, "sped", "confirmado") : undefined,
          // Município é o da EMPRESA (registro 0000), não necessariamente o da operação —
          // sinalizado via observacao, para não ser lido como dado da operação em si.
          municipio: cabecalho.municipioEmpresa
            ? campo(cabecalho.municipioEmpresa, "sped", "estimado", "Município da empresa (registro 0000) — o SPED não carrega município por operação; usado como aproximação até confirmação.")
            : undefined,
        },
        participantes: { [docAtual.indOper === "saida" ? "cliente" : "fornecedor"]: { identificacao: campo(docAtual.codPart, "sped", "confirmado") } },
        granularidade: "item",
      };
      operacoes.push(op);
    }
  }

  return operacoes;
}

/**
 * Extrai operações granulares de um arquivo EFD Contribuições — mesmos
 * registros C100/C170 (quando presentes); A100 (documentos de serviço) fica
 * de fora nesta primeira fase porque não tem granularidade de item (é um
 * documento consolidado), permanecendo no pipeline de agregação existente.
 */
export function extrairOperacoesGranularesEfdContribuicoes(nomeArquivo: string, conteudo: string): OperacaoTributariaNormalizada[] {
  const registros = tokenizarSped(conteudo);
  const operacoes: OperacaoTributariaNormalizada[] = [];
  const itensCadastrados = new Map<string, ItemCadastrado>();
  let cabecalho: CabecalhoArquivo = {};
  let docAtual: { numDoc: string; chaveNfe?: string; dtDoc?: string; indOper: "entrada" | "saida"; codPart: string } | null = null;

  for (const { reg, campos } of registros) {
    if (reg === "0000") {
      cabecalho = extrairCabecalho0000(campos, "contribuicoes");
    } else if (reg === "0200") {
      const item = processarRegistro0200(campos);
      itensCadastrados.set(item.codItem, item);
    } else if (reg === "C100") {
      docAtual = {
        indOper: campos[0] === "1" ? "saida" : "entrada",
        codPart: campos[2] ?? "",
        numDoc: campos[5] ?? "",
        chaveNfe: campos[6] || undefined,
        dtDoc: campos[7] || undefined,
      };
    } else if (reg === "C170" && docAtual) {
      const numItem = campos[0] ?? "";
      const codItem = campos[1] ?? "";
      const qtd = campos[3];
      const unidade = campos[4];
      const valorItem = campos[5];
      const cstIcms = campos[8];
      const cfop = campos[9];
      const itemCadastrado = itensCadastrados.get(codItem);
      const id = gerarIdEstavelOperacao({ chaveDocumental: docAtual.chaveNfe, nomeArquivo, numeroDocumento: docAtual.numDoc, numeroItem: numItem });

      operacoes.push({
        id,
        identificacao: {
          documentoId: docAtual.numDoc ? campo(docAtual.numDoc, "sped", "confirmado") : undefined,
          itemId: numItem ? campo(numItem, "sped", "confirmado") : undefined,
          data: docAtual.dtDoc ? campo(docAtual.dtDoc, "sped", "confirmado") : undefined,
          tipoOperacao: campo(docAtual.indOper, "sped", "confirmado"),
        },
        produtoServico: {
          ncm: itemCadastrado?.ncm ? campo(itemCadastrado.ncm, "sped", "confirmado") : undefined,
          unidade: unidade ? campo(unidade, "sped", "confirmado") : undefined,
          quantidade: qtd ? campo(numeroSped(qtd), "sped", "confirmado") : undefined,
        },
        classificacaoTributaria: {
          cst: cstIcms ? campo(cstIcms, "sped", "confirmado") : undefined,
          cfop: cfop ? campo(cfop, "sped", "confirmado") : undefined,
        },
        valores: {
          valorOperacao: valorItem ? campo(numeroSped(valorItem), "sped", "confirmado") : undefined,
        },
        localidade: {
          uf: cabecalho.uf ? campo(cabecalho.uf, "sped", "confirmado") : undefined,
        },
        participantes: { [docAtual.indOper === "saida" ? "cliente" : "fornecedor"]: { identificacao: campo(docAtual.codPart, "sped", "confirmado") } },
        granularidade: "item",
      });
    }
  }

  return operacoes;
}
