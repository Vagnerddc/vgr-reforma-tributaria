/**
 * Roteador documental — recomenda quais documentos importar por regime,
 * conforme docs/ingestao-documental-v2.md. NUNCA bloqueia: mesmo o Simples
 * sem nenhum SPED (que não é exigível para o regime) continua com o pipeline
 * funcional só com CNPJ+PGDAS+XML+Folha. Tabela estática — não deriva de
 * `calculo.ts`/motores de regime (nenhuma regra tributária nova aqui).
 */
import type { Regime } from "../../engine/types";
import type { TipoDocumento } from "./tipos";

export type ObrigatoriedadeDocumento = "recomendado" | "opcional" | "nao_aplicavel";

export interface ItemChecklistDocumental {
  tipoDocumento: TipoDocumento;
  obrigatoriedade: ObrigatoriedadeDocumento;
  motivo: string;
}

export interface ChecklistDocumentalRegime {
  regime: Regime;
  itens: ItemChecklistDocumental[];
}

export interface ContextoRoteamento {
  /** Fator R é relevante para o anexo/alíquota efetiva do Simples — quando true, Folha/FS12 passa de opcional a recomendado. */
  fatorRRelevante?: boolean;
  /** Empresa tem circulação de mercadoria sujeita a ICMS/IPI — quando false, EFD ICMS/IPI não é recomendado mesmo fora do Simples (ex.: prestador de serviço puro). */
  icmsIpiAplicavel?: boolean;
}

function itemBase(tipoDocumento: TipoDocumento, obrigatoriedade: ObrigatoriedadeDocumento, motivo: string): ItemChecklistDocumental {
  return { tipoDocumento, obrigatoriedade, motivo };
}

function checklistSimples(ctx: ContextoRoteamento): ItemChecklistDocumental[] {
  return [
    itemBase("cnpj", "recomendado", "Preenche cadastro (razão social, CNAE, porte, opção pelo Simples) automaticamente."),
    itemBase("contrato_social", "opcional", "Complementa objeto social e atividades quando o CNAE não é suficiente."),
    itemBase("pgdas", "recomendado", "Fonte nativa do Simples: RBT12, receita segregada, anexo, alíquota efetiva, DAS apurado."),
    itemBase("defis", "opcional", "Complementa o PGDAS-D com a visão anual — nunca substitui."),
    itemBase("xml_nfe", "opcional", "Detalha operações por item quando disponível — não é exigido do Simples."),
    itemBase("nfse", "opcional", "Detalha prestação de serviço por item quando disponível."),
    itemBase("folha_fs12", ctx.fatorRRelevante ? "recomendado" : "opcional", ctx.fatorRRelevante ? "Fator R depende de FS12 para definir o anexo/alíquota efetiva." : "Só necessário quando o Fator R for relevante para o enquadramento."),
    itemBase("efd_icms_ipi", ctx.icmsIpiAplicavel ? "opcional" : "nao_aplicavel", ctx.icmsIpiAplicavel ? "Pode complementar a apuração de ICMS/IPI quando o Simples optante mantiver a escrituração." : "Não exigível do Simples Nacional."),
    itemBase("efd_contribuicoes", "nao_aplicavel", "Não exigível do Simples Nacional — tributos unificados no DAS."),
    itemBase("ecd", "nao_aplicavel", "Não exigível do Simples Nacional."),
    itemBase("ecf", "nao_aplicavel", "Não exigível do Simples Nacional."),
  ];
}

function checklistPresumido(ctx: ContextoRoteamento): ItemChecklistDocumental[] {
  return [
    itemBase("cnpj", "recomendado", "Preenche cadastro automaticamente."),
    itemBase("contrato_social", "opcional", "Complementa objeto social e atividades."),
    itemBase("xml_nfe", "recomendado", "Base de receita e operações por item."),
    itemBase("nfse", "recomendado", "Base de receita de serviços por item."),
    itemBase("efd_icms_ipi", ctx.icmsIpiAplicavel ? "recomendado" : "nao_aplicavel", ctx.icmsIpiAplicavel ? "Apuração de ICMS/IPI." : "Não aplicável a prestador de serviço sem circulação de mercadoria."),
    itemBase("efd_contribuicoes", "recomendado", "Apuração de PIS/COFINS e créditos."),
    itemBase("ecd", "opcional", "Balancete/contabilidade, quando disponível — melhora a qualidade dos dados econômico-financeiros."),
    itemBase("ecf", "recomendado", "Apuração de IRPJ/CSLL do Presumido."),
    itemBase("folha_fs12", ctx.fatorRRelevante ? "recomendado" : "opcional", "Necessário quando a folha influencia a análise (ex.: comparação com Simples)."),
    itemBase("pgdas", "nao_aplicavel", "Documento exclusivo do Simples Nacional."),
    itemBase("defis", "nao_aplicavel", "Documento exclusivo do Simples Nacional."),
  ];
}

function checklistReal(ctx: ContextoRoteamento): ItemChecklistDocumental[] {
  return [
    itemBase("cnpj", "recomendado", "Preenche cadastro automaticamente."),
    itemBase("contrato_social", "opcional", "Complementa objeto social e atividades."),
    itemBase("xml_nfe", "recomendado", "Base de receita e operações por item."),
    itemBase("nfse", "recomendado", "Base de receita de serviços por item."),
    itemBase("efd_icms_ipi", ctx.icmsIpiAplicavel ? "recomendado" : "nao_aplicavel", ctx.icmsIpiAplicavel ? "Apuração de ICMS/IPI." : "Não aplicável a prestador de serviço sem circulação de mercadoria."),
    itemBase("efd_contribuicoes", "recomendado", "Apuração de PIS/COFINS e créditos — regra não cumulativa do Lucro Real depende disso."),
    itemBase("ecd", "recomendado", "Contabilidade completa — base do resultado contábil do Lucro Real."),
    itemBase("ecf", "recomendado", "Apuração de IRPJ/CSLL, ajustes e prejuízo fiscal do Lucro Real."),
    itemBase("folha_fs12", "recomendado", "Folha integra custos/despesas dedutíveis do Lucro Real."),
    itemBase("pgdas", "nao_aplicavel", "Documento exclusivo do Simples Nacional."),
    itemBase("defis", "nao_aplicavel", "Documento exclusivo do Simples Nacional."),
  ];
}

/** Recomenda, nunca bloqueia — a análise segue funcional mesmo sem os documentos "recomendado". */
export function recomendarDocumentosPorRegime(regime: Regime, contexto: ContextoRoteamento = {}): ChecklistDocumentalRegime {
  const itens = regime === "lucro_presumido" ? checklistPresumido(contexto) : regime === "lucro_real" ? checklistReal(contexto) : checklistSimples(contexto);
  return { regime, itens };
}
