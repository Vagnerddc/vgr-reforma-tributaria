import type { EtapaWizardId, RascunhoCenarioEmpresa, StatusEtapaWizard } from "../tipos";

/** Status deriva sempre dos dados do rascunho — nunca do fato de a etapa ter sido visitada (seção 53). */
export function calcularStatusEtapa(rascunho: RascunhoCenarioEmpresa, etapa: EtapaWizardId): StatusEtapaWizard {
  switch (etapa) {
    case "documentos": {
      const processados = rascunho.ingestao?.documentosProcessados.length ?? 0;
      const conflitosPendentes = rascunho.ingestao?.conflitos.some((c) => c.status === "pendente" || c.status === "desatualizado") ?? false;
      if (processados === 0) return "nao_aplicavel"; // etapa sempre pulável — fluxo manual continua válido sem nenhum documento importado.
      return conflitosPendentes ? "com_ressalvas" : "completa";
    }

    case "empresa": {
      const completa = Boolean(rascunho.identificacao.nomeEmpresa && rascunho.identificacao.uf && rascunho.identificacao.atividadePrincipal);
      return completa ? "completa" : "incompleta";
    }

    case "atividades":
      return rascunho.identificacao.atividadePrincipal ? "completa" : "incompleta";

    case "receita": {
      if (rascunho.receita.faturamentoAnual === undefined) return "incompleta";
      const entradas = Object.values(rascunho.receita.receitaPorAtividade ?? {});
      if (entradas.length > 0) {
        const soma = entradas.reduce((acc, c) => acc + c.valor, 0);
        const faturamento = rascunho.receita.faturamentoAnual.valor;
        const divergente = faturamento === 0 ? soma !== 0 : Math.abs(soma - faturamento) / faturamento > 0.01;
        if (divergente) return "com_ressalvas";
      }
      return "completa";
    }

    case "custosCreditos": {
      if (rascunho.custos.itens.length === 0) return "incompleta";
      const temIndeterminado = rascunho.custos.itens.some((item) => [item.categoria.creditoPisCofins, item.categoria.creditoIcmsIpi, item.categoria.creditoIbsCbs].some((t) => t.tratamento === "indeterminado"));
      return temIndeterminado ? "com_ressalvas" : "completa";
    }

    case "pessoasFs12": {
      const temAlgum = rascunho.pessoas.folhaAnual !== undefined || rascunho.pessoas.encargosAnual !== undefined || rascunho.pessoas.proLaboreAnual !== undefined;
      return temAlgum ? "completa" : "com_ressalvas";
    }

    case "fiscal": {
      if (rascunho.regimesSelecionados.length === 0) return "incompleta";
      if (rascunho.regimesSelecionados.includes("lucro_real")) {
        const semDados = !rascunho.tributario.ajustesFiscais?.length && !rascunho.tributario.saldosPrejuizoAnteriores;
        if (semDados) return "com_ressalvas";
      }
      return "completa";
    }

    case "caixaSplit":
      if (!rascunho.analisarCaixa) return "nao_aplicavel";
      return rascunho.premissasSplit ? "completa" : "com_ressalvas";

    case "premissasEstrategicas": {
      const otimizacaoUsada = rascunho.otimizacao.habilitada;
      const pontosUsados = rascunho.pontosVirada.length > 0;
      if (!otimizacaoUsada && !pontosUsados) return "nao_aplicavel";
      if (otimizacaoUsada && rascunho.otimizacao.variaveis.length === 0) return "com_ressalvas";
      return "completa";
    }

    case "revisao":
      return "incompleta";
  }
}
