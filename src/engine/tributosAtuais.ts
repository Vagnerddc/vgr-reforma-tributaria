import tributosJson from "../../config/tributosAtuais.json";
import type { Regime, AnexoSimples } from "./types";
import type { PerfilAtividade } from "./atividades";

interface AliquotaReferencia {
  aliquota: number;
  descricao: string;
}

interface TributosAtuaisConfig {
  pisCofinsPorRegime: {
    lucro_real: AliquotaReferencia;
    lucro_presumido: AliquotaReferencia;
    simplesPorAnexo: Record<string, AliquotaReferencia>;
  };
  icmsPorUf: Record<string, number>;
  observacoesIcmsPorPerfil: Record<string, string>;
}

const tributos = tributosJson as unknown as TributosAtuaisConfig;

/** Sugere a alíquota de PIS/Cofins conforme o regime tributário — ponto de partida editável, não apuração definitiva. */
export function pisCofinsAutomatico(regime: Regime, anexo?: AnexoSimples): AliquotaReferencia {
  switch (regime) {
    case "lucro_real":
      return tributos.pisCofinsPorRegime.lucro_real;
    case "lucro_presumido":
      return tributos.pisCofinsPorRegime.lucro_presumido;
    case "simples_unificado":
    case "simples_hibrido": {
      const chave = anexo ?? "anexoIII";
      return (
        tributos.pisCofinsPorRegime.simplesPorAnexo[chave] ?? tributos.pisCofinsPorRegime.simplesPorAnexo.anexoIII
      );
    }
  }
}

/** Sugere a alíquota de ICMS conforme a UF — SEMPRE deve ser confirmada com a contabilidade (varia por CFOP, produto/serviço e benefícios fiscais estaduais). */
export function icmsAutomatico(
  uf: string,
  perfil: PerfilAtividade | null
): { aliquota: number; observacao: string } {
  const ufNormalizada = uf.trim().toUpperCase();
  const aliquota = tributos.icmsPorUf[ufNormalizada] ?? 0;
  const observacaoPerfil = perfil ? tributos.observacoesIcmsPorPerfil[perfil] : undefined;
  const base = aliquota
    ? `Alíquota interna estimada de ICMS para ${ufNormalizada}: ${(aliquota * 100).toLocaleString("pt-BR")}%.`
    : `UF não reconhecida — informe a alíquota manualmente.`;
  const observacao = [base, observacaoPerfil, "Confirme sempre com sua contabilidade antes de decidir com base neste número."]
    .filter(Boolean)
    .join(" ");
  return { aliquota, observacao };
}
