import { tokenizarSped, numeroSped } from "./parser";
import type { ArquivoSpedProcessado, MovimentoNota, Participante } from "./tipos";
import { classificarPorCfopIcms } from "./efdIcmsIpi";
import { processarRegistro0200, classificarPorTipoItem, type ItemCadastrado } from "./tabelaItens";

export function processarEfdContribuicoes(nomeArquivo: string, conteudo: string): ArquivoSpedProcessado {
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
  let receitaConsolidada = 0;

  for (const { reg, campos } of registros) {
    switch (reg) {
      case "0000": {
        // Guia Prático EFD-Contribuições, registro 0000: COD_VER|TIPO_ESCRIT|IND_SIT_ESP|
        // NUM_REC_ANTERIOR|DT_INI|DT_FIN|NOME|CNPJ|... — layout DIFERENTE do 0000 da EFD
        // ICMS/IPI (onde DT_INI vem no índice 2); aqui DT_INI/DT_FIM vêm nos índices 4/5.
        // Confirmado contra EFD real de produção em 07/08/2026 — o índice errado (copiado
        // do layout da ICMS/IPI) fazia periodoInicio/periodoFim ficarem sempre vazios.
        periodoInicio = campos[4];
        periodoFim = campos[5];
        break;
      }
      case "0200": {
        const item = processarRegistro0200(campos);
        itensCadastrados.set(item.codItem, item);
        break;
      }
      case "0150": {
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
      case "A100": {
        // IND_OPER|IND_EMIT|COD_PART|COD_SIT|SER|SUB|NUM_DOC|CHV_NFSE|DT_DOC|DT_EXE_SERV|VL_DOC|IND_PGTO|VL_DESC|...
        const indOper = campos[0] === "1" ? "saida" : "entrada";
        const codPart = campos[2] ?? "";
        const valorDoc = numeroSped(campos[10]);
        movimentos.push({
          origem: "efd_contribuicoes",
          indOper,
          codPart,
          cfop: "",
          valorItem: valorDoc,
          natureza: indOper === "saida" ? "faturamento" : "despesaOperacional",
        });
        break;
      }
      case "C100": {
        indOperNotaAtual = campos[0] === "1" ? "saida" : "entrada";
        codPartNotaAtual = campos[2] ?? "";
        break;
      }
      case "C170": {
        const codItem = campos[1] ?? "";
        const cfop = campos[9] ?? "";
        const valorItem = numeroSped(campos[5]);
        const itemCadastrado = itensCadastrados.get(codItem);
        const natureza =
          (itemCadastrado && classificarPorTipoItem(itemCadastrado.tipoItem, indOperNotaAtual)) ??
          classificarPorCfopIcms(cfop, indOperNotaAtual);
        movimentos.push({
          origem: "efd_contribuicoes",
          indOper: indOperNotaAtual,
          codPart: codPartNotaAtual,
          cfop,
          valorItem,
          natureza,
          ncm: itemCadastrado?.ncm,
        });
        break;
      }
      case "F500":
      case "F550": {
        // Demonstrativo de Apuração de Contribuição Social sobre Receita (regime
        // cumulativo=F500 / não-cumulativo=F550) — VL_REC_COMP (receita bruta do
        // período) é sempre o PRIMEIRO campo do registro. É a fonte estrutural de
        // faturamento quando a empresa declara só o consolidado, sem nota a nota
        // (A100/C170) — comum em prestadoras de serviço de construção civil.
        receitaConsolidada += numeroSped(campos[0]);
        break;
      }
      case "M200": {
        // Guia Prático EFD-Contribuições, Registro M200 — VL_TOT_CONT_REC (total PIS a
        // recolher no período) é o ÚLTIMO campo do registro (12 campos oficiais, índice
        // 0-11). Usar o índice fixo 12 (visto num fixture sintético com um campo extra)
        // ficava fora dos limites em arquivo real de produção, sempre lendo undefined/0 —
        // por isso sempre o último campo, não uma posição fixa.
        const valorRecolher = numeroSped(campos[campos.length - 1]);
        apuracoes.push({ tributo: "pis", periodo: periodoFim ?? "", valorRecolher });
        break;
      }
      case "M600": {
        // Espelha o M200 para a Cofins (Registro M600).
        const valorRecolher = numeroSped(campos[campos.length - 1]);
        apuracoes.push({ tributo: "cofins", periodo: periodoFim ?? "", valorRecolher });
        break;
      }
    }
  }

  if (!apuracoes.some((a) => a.tributo === "pis")) {
    avisos.push("Registro M200 (apuração do PIS) não encontrado — carga atual de PIS não pôde ser extraída automaticamente.");
  }
  if (!apuracoes.some((a) => a.tributo === "cofins")) {
    avisos.push("Registro M600 (apuração da Cofins) não encontrado — carga atual de Cofins não pôde ser extraída automaticamente.");
  }

  return {
    tipo: "efd_contribuicoes",
    nomeArquivo,
    periodoInicio,
    periodoFim,
    participantes,
    movimentos,
    apuracoes,
    saldosContabeis: [],
    receitaConsolidada: receitaConsolidada > 0 ? receitaConsolidada : undefined,
    avisos,
  };
}
