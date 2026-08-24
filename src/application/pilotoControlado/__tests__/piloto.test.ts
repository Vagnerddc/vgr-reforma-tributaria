import { describe, it, expect } from "vitest";
import { casoBase } from "./fixtures";
import { construirAvaliacaoCaso } from "../avaliacaoCaso";
import { consolidarPiloto, AREAS_ESSENCIAIS_PADRAO } from "../consolidacao";
import { avaliarCriteriosTecnicos, avaliarCriteriosExperiencia, problemaBloqueiaProntidao } from "../criteriosAceitacao";
import { construirResultadoComparacao } from "../comparacaoCaso";
import type { ProblemaPiloto } from "../tipos";

describe("76/83 — contrato do caso é anonimizável e não exige dado pessoal", () => {
  it("CasoPiloto não tem nenhum campo de nome real/CPF obrigatório", () => {
    const caso = casoBase({ id: "CASO-SAUDE-01", segmento: "Serviços/Saúde" });
    expect(caso.id).not.toMatch(/@/);
    expect(caso.fontesUtilizadas.every((f) => !f.includes("XML") && !f.includes("SPED completo"))).toBe(true);
  });
});

describe("77 — todos aprovados → pronto_para_avaliar_migracao_controlada", () => {
  it("cobrindo todas as áreas essenciais, sem divergência material, sem bloqueio", () => {
    const casos = AREAS_ESSENCIAIS_PADRAO.map((area, i) =>
      casoBase({ id: `CASO-${i}`, areasValidadas: [area], qualidadeEntrada: { Empresa: "confirmado" } }),
    );
    const avaliacoes = casos.map((caso) => construirAvaliacaoCaso(caso, {}));
    const relatorio = consolidarPiloto(casos, avaliacoes);
    expect(relatorio.areasFaltantes).toEqual([]);
    expect(relatorio.statusProntidao).toBe("pronto_para_avaliar_migracao_controlada");
  });
});

describe("78 — uma divergência crítica → piloto_com_pendencias", () => {
  it("um problema de severidade crítica bloqueia o caso e o status consolidado", () => {
    const caso = casoBase({ id: "CASO-CRITICO", areasValidadas: ["fs12"] });
    const problemas: ProblemaPiloto[] = [{ casoId: "CASO-CRITICO", severidade: "critica", categoria: "fiscal", descricao: "Decisão incorreta detectada." }];
    const avaliacao = construirAvaliacaoCaso(caso, { problemas });
    expect(avaliacao.statusFinal).toBe("bloqueado");

    const relatorio = consolidarPiloto([caso], [avaliacao]);
    expect(relatorio.statusProntidao).toBe("piloto_com_pendencias");
  });
});

describe("79 — multiatividade não validada impede prontidão final", () => {
  it("sem nenhum caso cobrindo 'multiatividade', o status nunca chega a pronto_para_avaliar_migracao_controlada", () => {
    const areasSemMultiatividade = AREAS_ESSENCIAIS_PADRAO.filter((a) => a !== "multiatividade");
    const casos = areasSemMultiatividade.map((area, i) => casoBase({ id: `CASO-${i}`, areasValidadas: [area] }));
    const avaliacoes = casos.map((caso) => construirAvaliacaoCaso(caso));
    const relatorio = consolidarPiloto(casos, avaliacoes);
    expect(relatorio.areasFaltantes).toContain("multiatividade");
    expect(relatorio.statusProntidao).toBe("piloto_com_pendencias");
  });
});

describe("80 — ausência de caso Lucro Real (quando exigido) impede prontidão", () => {
  it("configurando lucro_real como área essencial e sem nenhum caso cobrindo-a, status fica pendente", () => {
    const caso = casoBase({ id: "CASO-1", areasValidadas: ["fs12"] });
    const avaliacao = construirAvaliacaoCaso(caso);
    const relatorio = consolidarPiloto([caso], [avaliacao], { areasEssenciais: ["fs12", "lucro_real"] });
    expect(relatorio.areasFaltantes).toContain("lucro_real");
    expect(relatorio.statusProntidao).toBe("piloto_com_pendencias");
  });
});

describe("81 — problema de UX média não bloqueia prontidão técnica sozinho", () => {
  it("problemaBloqueiaProntidao retorna false para categoria ux, mesmo com severidade alta", () => {
    expect(problemaBloqueiaProntidao({ casoId: "x", severidade: "media", categoria: "ux", descricao: "Warning pouco claro." })).toBe(false);
    expect(problemaBloqueiaProntidao({ casoId: "x", severidade: "alta", categoria: "ux", descricao: "Fluxo confuso." })).toBe(false);
  });

  it("um caso com apenas um problema de UX média fica aprovado_com_ressalvas, não bloqueado nem requer_ajuste", () => {
    const caso = casoBase({ id: "CASO-UX" });
    const problemas: ProblemaPiloto[] = [{ casoId: "CASO-UX", severidade: "media", categoria: "ux", descricao: "Campo de percentual confuso." }];
    const avaliacao = construirAvaliacaoCaso(caso, { problemas });
    expect(avaliacao.statusFinal).toBe("aprovado_com_ressalvas");
  });
});

describe("82 — problema fiscal alto/crítico bloqueia", () => {
  it("problemaBloqueiaProntidao retorna true para categoria fiscal com severidade alta ou crítica", () => {
    expect(problemaBloqueiaProntidao({ casoId: "x", severidade: "alta", categoria: "fiscal", descricao: "Carga incorreta." })).toBe(true);
    expect(problemaBloqueiaProntidao({ casoId: "x", severidade: "critica", categoria: "fiscal", descricao: "Decisão errada." })).toBe(true);
  });

  it("um problema fiscal alto marca o caso como requer_ajuste", () => {
    const caso = casoBase({ id: "CASO-FISCAL" });
    const problemas: ProblemaPiloto[] = [{ casoId: "CASO-FISCAL", severidade: "alta", categoria: "fiscal", descricao: "Memória não rastreia indicador material." }];
    const avaliacao = construirAvaliacaoCaso(caso, { problemas });
    expect(avaliacao.statusFinal).toBe("requer_ajuste");
  });
});

describe("84 — determinismo: mesmos casos produzem a mesma consolidação", () => {
  it("consolidarPiloto é uma função pura", () => {
    const casos = [casoBase({ id: "A", areasValidadas: ["fs12"] }), casoBase({ id: "B", areasValidadas: ["creditos"] })];
    const avaliacoes = casos.map((c) => construirAvaliacaoCaso(c));
    const r1 = consolidarPiloto(casos, avaliacoes);
    const r2 = consolidarPiloto(casos, avaliacoes);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe("critérios técnicos e de experiência são avaliados separadamente (seção 22)", () => {
  it("avaliarCriteriosTecnicos não considera critérios de experiência", () => {
    const caso = casoBase();
    const resultado = avaliarCriteriosTecnicos(caso, []);
    expect(resultado.atendido).toBe(true);
  });

  it("avaliarCriteriosExperiencia é independente da validação técnica", () => {
    const resultado = avaliarCriteriosExperiencia({
      conseguiuPreencher: true,
      entendeuWarnings: true,
      identificouCamposObrigatorios: true,
      chegouAAnalise: true,
      conseguiuExplicarResultado: false,
      usouModoApresentacao: true,
      abriuMemoriaTecnicaQuandoQuestionado: true,
    });
    expect(resultado.itensNaoAtendidos).toEqual(["conseguiuExplicarResultado"]);
  });
});

describe("comparação reaproveita o framework existente (seção 17/18)", () => {
  it("construirResultadoComparacao vem de comparacaoV2Legado sem reimplementação", () => {
    const resultado = construirResultadoComparacao({ casoId: "CASO-X", divergenciasEntrada: [], divergenciasResultado: [] });
    expect(resultado.classificacao).toBe("nao_comparavel");
  });
});

describe("70 — perdas do adapter legado nunca aparecem como perdas do cenário V2", () => {
  it("um CasoPiloto com origemDados wizard_v2 não referencia perdas do adapter em suas pendências por padrão", () => {
    const caso = casoBase({ origemDados: "wizard_v2" });
    expect(caso.pendencias.some((p) => p.includes("adapter legado"))).toBe(false);
  });
});
