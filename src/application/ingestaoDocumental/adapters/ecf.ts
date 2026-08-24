import { processarEcf } from "../../../engine/sped/ecf";
import { empacotarArquivoSped } from "./spedComum";
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento } from "../tipos";

/**
 * Wrapper fino de `sped/ecf.ts`. Nesta fase, sem fixture real de ECF
 * validada, `resumoEcf` normalmente só traz `blocosDetectadosNaoExtraidos`
 * (ver `ResumoEcf`) — nenhum valor de receita/resultado/IRPJ/CSLL é fabricado.
 * Quando `processarEcf` evoluir (fixture real disponível), os campos
 * numéricos de `resumoEcf` aparecem aqui automaticamente, sem mudar este
 * contrato.
 */
export function ingerirEcf(nomeArquivo: string, conteudo: string, documentoId: string): ResultadoIngestaoDocumento {
  const arquivo = processarEcf(nomeArquivo, conteudo);
  const resultado = empacotarArquivoSped(arquivo, documentoId);
  const resumo = arquivo.resumoEcf;
  if (!resumo) return resultado;

  const ctx = { documentoId, tipoDocumento: "ecf" as const, periodo: resultado.periodo };
  const campos = [...resultado.camposExtraidos];
  if (resumo.regime !== undefined) campos.push(campoExtraido(resumo.regime, "confirmado", { ...ctx, evidencia: "registro 0000 da ECF", observacao: "regimeDeclaradoEcf" }));
  if (resumo.receitaBruta !== undefined) campos.push(campoExtraido(resumo.receitaBruta, "confirmado", { ...ctx, evidencia: "Bloco M/Y da ECF", observacao: "receitaBrutaEcf" }));
  if (resumo.resultadoAntesIr !== undefined) campos.push(campoExtraido(resumo.resultadoAntesIr, "confirmado", { ...ctx, evidencia: "Bloco M/Y da ECF", observacao: "resultadoAntesIrEcf" }));
  if (resumo.baseIrpj !== undefined) campos.push(campoExtraido(resumo.baseIrpj, "confirmado", { ...ctx, evidencia: "Bloco M da ECF", observacao: "baseIrpjEcf" }));
  if (resumo.baseCsll !== undefined) campos.push(campoExtraido(resumo.baseCsll, "confirmado", { ...ctx, evidencia: "Bloco M da ECF", observacao: "baseCsllEcf" }));
  if (resumo.prejuizoFiscalAcumulado !== undefined) campos.push(campoExtraido(resumo.prejuizoFiscalAcumulado, "confirmado", { ...ctx, evidencia: "Bloco M da ECF", observacao: "prejuizoFiscalAcumulado" }));
  if (resumo.baseNegativaCsllAcumulada !== undefined) campos.push(campoExtraido(resumo.baseNegativaCsllAcumulada, "confirmado", { ...ctx, evidencia: "Bloco M da ECF", observacao: "baseNegativaCsllAcumulada" }));

  const limitacoes = [...resultado.limitacoes];
  if (resumo.blocosDetectadosNaoExtraidos && resumo.blocosDetectadosNaoExtraidos.length > 0) {
    limitacoes.push({ descricao: `Registros detectados sem extração de valor (indeterminado): ${resumo.blocosDetectadosNaoExtraidos.join(", ")}.` });
  }

  return { ...resultado, camposExtraidos: campos, limitacoes };
}
