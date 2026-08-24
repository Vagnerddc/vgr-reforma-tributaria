import type { CasoPiloto } from "../tipos";

/** Sempre sintética/anonimizada — nenhum dado real (seção 45). */
export function casoBase(overrides: Partial<CasoPiloto> = {}): CasoPiloto {
  return {
    id: "CASO-TESTE-01",
    segmento: "Segmento genérico",
    periodo: { ano: 2028 },
    objetivo: "Validar infraestrutura de teste do piloto.",
    areasValidadas: [],
    origemDados: "wizard_v2",
    fontesUtilizadas: ["Wizard V2 (consultor)"],
    statusExecucaoV2: "executado",
    qualidadeEntrada: { Empresa: "confirmado", Receita: "confirmado" },
    dificuldadesEntrada: [],
    camposConfusos: [],
    dadosDificeisObter: [],
    ajudasInsuficientes: [],
    observacoesTecnicas: [],
    observacoesUso: [],
    pendencias: [],
    ...overrides,
  };
}
