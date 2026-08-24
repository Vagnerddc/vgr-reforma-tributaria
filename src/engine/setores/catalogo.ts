import taxonomiaJson from "../../../config/setores/taxonomia.json";
import type { MacroSetor, PerfilSetorial } from "./tipos";

interface TaxonomiaConfig {
  macroSetores: MacroSetor[];
  perfis: PerfilSetorial[];
}

const taxonomia = taxonomiaJson as unknown as TaxonomiaConfig;

export function listarMacroSetores(): MacroSetor[] {
  return taxonomia.macroSetores;
}

export function listarPerfis(): PerfilSetorial[] {
  return taxonomia.perfis;
}

export function buscarPerfil(id: string): PerfilSetorial | undefined {
  return taxonomia.perfis.find((p) => p.id === id);
}

export function listarPerfisDoMacroSetor(macroSetorId: string): PerfilSetorial[] {
  return taxonomia.perfis.filter((p) => p.macroSetor === macroSetorId);
}

export interface SugestaoPerfil {
  perfil: PerfilSetorial;
  /** Só "sugerido" — o CNAE nunca determina o perfil por si só (ver tipos.ts e o pedido que originou este catálogo). */
  confianca: "sugerido";
  motivo: string;
  /** Comprimento do prefixo de CNAE que gerou a sugestão — usado só para ordenar do mais específico ao mais genérico, não exposto como "força" da sugestão. */
  especificidade: number;
}

/**
 * Sugere candidatos a PerfilSetorial a partir de um CNAE — NUNCA decide
 * por conta própria. Compara o CNAE (normalizado, dígitos apenas) contra
 * `cnaesSugeridos` de cada perfil por prefixo, do prefixo mais específico
 * para o mais genérico (ex.: "0161-0/03" bate tanto com um prefixo "0161"
 * quanto, se existisse, um prefixo "01" mais genérico — o mais específico
 * vem primeiro na lista de sugestões).
 */
export function sugerirPerfisPorCnae(cnae: string | number): SugestaoPerfil[] {
  const digitos = String(cnae).replace(/[^\d]/g, "");
  const candidatos: SugestaoPerfil[] = [];
  for (const perfil of taxonomia.perfis) {
    for (const prefixo of perfil.cnaesSugeridos ?? []) {
      if (digitos.startsWith(prefixo)) {
        candidatos.push({ perfil, confianca: "sugerido", motivo: `CNAE ${digitos} corresponde ao prefixo ${prefixo} associado a este perfil`, especificidade: prefixo.length });
        break;
      }
    }
  }
  return candidatos.sort((a, b) => b.especificidade - a.especificidade);
}
