import { describe, it, expect } from "vitest";
import { criarRascunhoVazio } from "../tipos";
import { validarRascunho, converterRascunhoParaCenario } from "../validacao";
import { construirOpcoesExecucao } from "../execucao";
import { executarAnaliseEstrategica } from "../../../application/analiseEstrategica/motor";
import { construirPaginaAnaliseEstrategicaViewModel } from "../../../presentation/viewModels/analiseEstrategica";
import { construirMemoriaTecnicaAnalise } from "../../../application/memoriaTecnica/motor";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";

describe("115 — integração completa: Wizard V2 → CenarioEmpresa → executarAnaliseEstrategica → ViewModels", () => {
  it("um rascunho completo produz uma análise consumível pelos ViewModels da rota estratégica", () => {
    const rascunho = criarRascunhoVazio("integracao-1");
    rascunho.identificacao.nomeEmpresa = campo("Empresa Integração", "informado_usuario", "confirmado");
    rascunho.identificacao.uf = campo("SP", "informado_usuario", "confirmado");
    rascunho.identificacao.atividadePrincipal = { perfilId: "varejo_generico", origem: "informado_usuario", status: "confirmado" };
    rascunho.receita.faturamentoAnual = campo(2_000_000, "informado_usuario", "confirmado");
    rascunho.regimesSelecionados = ["lucro_presumido", "lucro_real"];
    rascunho.analisarCaixa = true;
    rascunho.premissasSplit = {
      percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"),
      percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"),
      taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado"),
    };

    const validacao = validarRascunho(rascunho);
    expect(validacao.valido).toBe(true);

    const { cenario, origemCenario } = converterRascunhoParaCenario(rascunho);
    expect(origemCenario).toBe("wizard_v2");

    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(rascunho));
    expect(analise.statusRegimesComparador.status).not.toBe("erro");

    const vm = construirPaginaAnaliseEstrategicaViewModel(analise, rascunho.identificacao.nomeEmpresa?.valor);
    expect(vm.comparacaoRegimes.length).toBeGreaterThan(0);
    expect(vm.caixa.status).toBe("disponivel");

    // A Memória Técnica (fase anterior) continua funcionando normalmente com um cenário produzido pelo Wizard V2 — apenas consome, nunca recalcula.
    const memoria = construirMemoriaTecnicaAnalise(analise);
    expect(memoria.itens.length).toBeGreaterThan(0);
  });

  it("um rascunho mínimo (só receita e um regime) também produz análise válida", () => {
    const rascunho = criarRascunhoVazio("integracao-2");
    rascunho.receita.faturamentoAnual = campo(800_000, "informado_usuario", "confirmado");
    rascunho.regimesSelecionados = ["lucro_presumido"];

    const { cenario } = converterRascunhoParaCenario(rascunho);
    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(rascunho));
    const vm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    expect(vm.caixa.status).toBe("indisponivel");
  });
});
