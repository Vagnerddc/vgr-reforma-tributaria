/**
 * Adapter de Contrato Social — opera sobre TEXTO já extraído (colado ou
 * pré-processado; não há parser de PDF de contrato social nesta fase —
 * extração de bytes fica fora do escopo, análogo a NFS-e). Parser por
 * RÓTULO, no mesmo estilo de `engine/dre/parseTextoDre.ts` — nunca por
 * posição fixa, já que o layout varia entre cartórios/juntas comerciais.
 *
 * PRIVACIDADE (docs/ingestao-documental-v2.md §R): nunca propaga CPF, RG,
 * endereço pessoal ou estado civil de sócios para o resultado — qualquer
 * trecho extraído passa por `removerDadosPessoais` antes de virar
 * `CampoExtraido`. Objeto social/atividades descritas complementam o CNAE,
 * nunca determinam tributação sozinhos.
 */
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento } from "../tipos";

const PADROES_DADOS_PESSOAIS: { regex: RegExp; rotulo: string }[] = [
  { regex: /CPF[\s.:n°ºoO]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}/gi, rotulo: "CPF" },
  { regex: /\d{3}\.\d{3}\.\d{3}-\d{2}/g, rotulo: "CPF" },
  { regex: /RG[\s.:n°ºoO]*[\d.Xx-]{5,}/gi, rotulo: "RG" },
  { regex: /carteira de identidade[^,;.]*/gi, rotulo: "RG" },
  { regex: /(solteiro|casado|divorciado|separado judicialmente|viúvo|viuvo|uniao estavel|união estável)[a-z()\s]*/gi, rotulo: "estado civil" },
  { regex: /residente e domiciliad[oa][^,;.]*/gi, rotulo: "endereço pessoal" },
]

function removerDadosPessoais(texto: string): string {
  let limpo = texto;
  for (const { regex, rotulo } of PADROES_DADOS_PESSOAIS) {
    limpo = limpo.replace(regex, `[${rotulo} removido]`);
  }
  return limpo;
}

function normalizar(texto: string): string {
  return texto.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Extrai o texto entre o rótulo e o próximo marcador de cláusula/seção (ou fim do texto) — não assume posição fixa. */
function extrairSecao(texto: string, rotulos: string[]): string | null {
  const normalizado = normalizar(texto);
  for (const rotulo of rotulos) {
    const rotuloNormalizado = normalizar(rotulo);
    const inicio = normalizado.indexOf(rotuloNormalizado);
    if (inicio === -1) continue;
    const restoOriginal = texto.slice(inicio);
    const restoNormalizado = normalizado.slice(inicio + rotuloNormalizado.length);
    const proximaClausula = restoNormalizado.search(/CL[ÁA]USULA\s+(SEGUNDA|TERCEIRA|QUARTA|QUINTA|SEXTA|S[ÉE]TIMA|OITAVA|NONA|D[ÉE]CIMA)|par[áa]grafo/);
    const fim = proximaClausula === -1 ? restoOriginal.length : rotuloNormalizado.length + proximaClausula;
    return restoOriginal.slice(rotuloNormalizado.length, fim).trim().replace(/^[:\-\s]+/, "");
  }
  return null;
}

function extrairValorMonetario(texto: string, rotulos: string[]): number | null {
  const secao = extrairSecao(texto, rotulos);
  if (!secao) return null;
  const match = secao.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!match) return null;
  return Number(match[1].replace(/\./g, "").replace(",", "."));
}

export function ingerirContratoSocial(texto: string, documentoId: string): ResultadoIngestaoDocumento {
  const ctx = { documentoId, tipoDocumento: "contrato_social" as const };
  const campos = [];
  const alertas: ResultadoIngestaoDocumento["alertas"] = [];

  const objetoSocial = extrairSecao(texto, ["OBJETO SOCIAL", "OBJETO DA SOCIEDADE"]);
  if (objetoSocial) {
    campos.push(campoExtraido(removerDadosPessoais(objetoSocial), "confirmado", { ...ctx, observacao: "objetoSocial", evidencia: "cláusula de objeto social" }));
    alertas.push({ codigo: "objeto_social_nao_determina_tributacao", mensagem: "O objeto social complementa o CNAE e ajuda a identificar multiatividade, mas não determina tributação sozinho.", gravidade: "info" });
  }

  const capitalSocial = extrairValorMonetario(texto, ["CAPITAL SOCIAL"]);
  if (capitalSocial !== null) {
    campos.push(campoExtraido(capitalSocial, "confirmado", { ...ctx, observacao: "capitalSocial", evidencia: "cláusula de capital social" }));
  }

  const administracao = extrairSecao(texto, ["ADMINISTRAÇÃO DA SOCIEDADE", "ADMINISTRACAO DA SOCIEDADE", "ADMINISTRAÇÃO"]);
  if (administracao) {
    campos.push(campoExtraido(removerDadosPessoais(administracao), "confirmado", { ...ctx, observacao: "administracao", evidencia: "cláusula de administração" }));
  }

  if (campos.length === 0) {
    alertas.push({ codigo: "nenhuma_secao_localizada", mensagem: "Nenhuma seção reconhecida (objeto social, capital social, administração) foi localizada no texto informado.", gravidade: "atencao" });
  }

  return {
    documentoId,
    tipoDocumento: "contrato_social",
    status: campos.length > 0 ? "processado_com_ressalvas" : "falhou",
    camposExtraidos: campos,
    alertas,
    inconsistencias: [],
    limitacoes: [
      { descricao: "Quadro societário (sócios/percentuais) não é extraído nesta fase — apenas objeto social, capital social e administração." },
      { descricao: "Dados pessoais de sócios (CPF, RG, endereço pessoal, estado civil) são deliberadamente removidos e nunca chegam ao CenarioEmpresa." },
    ],
    metadados: { nomeArquivo: `contrato-social-${documentoId}`, processadoEm: new Date().toISOString() },
  };
}
