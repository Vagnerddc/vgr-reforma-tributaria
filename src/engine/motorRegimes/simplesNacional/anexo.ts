/**
 * Classificação de anexo para o Simples — camada intermediária obrigatória
 * (seção 11 do pedido): `PerfilSetorial` nunca contém o anexo diretamente.
 * Só resolve Anexos I/II/III (núcleo geral, sem Fator R). Qualquer
 * atividade cuja definição de anexo dependa de Fator R (a maioria dos
 * serviços em geral) retorna `"indeterminado_fator_r"` — nunca um
 * palpite entre III e V.
 */

import type { PerfilSetorial } from "../../setores/tipos";
import type { AnexoSimplesNucleo } from "./normativa";

export type ResultadoClassificacaoAnexo = { anexo: AnexoSimplesNucleo } | { anexo: "indeterminado_fator_r"; motivo: string } | { anexo: "indeterminado"; motivo: string };

/**
 * Atividades que a LC 123/2006, art. 18, §5º-C, já classifica no Anexo
 * III SEMPRE, independentemente do Fator R (lista legal fechada — não
 * "todo serviço", só as exceções expressas). Transporte de cargas é uma
 * delas (inciso VI). Só incluímos aqui o que temos alta confiança
 * normativa; qualquer dúvida cai em indeterminado, nunca no anexo por
 * aproximação.
 */
const PERFIS_ANEXO_III_SEM_FATOR_R = new Set(["transporte_rodoviario_cargas"]);

export function classificarAnexo(perfil: PerfilSetorial): ResultadoClassificacaoAnexo {
  if (PERFIS_ANEXO_III_SEM_FATOR_R.has(perfil.id)) return { anexo: "anexo_iii" };

  const temComercio = perfil.arquetipos.includes("comercio");
  const temIndustria = perfil.arquetipos.includes("industria");

  if (temComercio && temIndustria) {
    return { anexo: "indeterminado", motivo: `Perfil "${perfil.segmento}" combina comércio e indústria — Anexo I e II têm tabelas diferentes; sem receita segregada por natureza dentro da própria atividade, não é seguro escolher um dos dois.` };
  }
  if (temComercio) return { anexo: "anexo_i" };
  if (temIndustria) return { anexo: "anexo_ii" };

  if (perfil.arquetipos.includes("financeiro")) {
    return { anexo: "indeterminado", motivo: `Perfil "${perfil.segmento}" tem arquétipo financeiro — pode envolver impedimento ao Simples ou regra de anexo não modelada nesta fase.` };
  }
  if (perfil.arquetipos.includes("servico") || perfil.arquetipos.includes("digital")) {
    return { anexo: "indeterminado_fator_r", motivo: `Perfil "${perfil.segmento}" é prestação de serviços — a definição entre Anexo III e V depende do Fator R (fora de escopo nesta fase, ver LC 123/2006, art. 18, §5º-J).` };
  }

  return { anexo: "indeterminado", motivo: `Perfil "${perfil.segmento}" não tem regra de anexo modelada nesta fase (agro/construção/locação e outros regimes diferenciados ficam fora do núcleo geral).` };
}
