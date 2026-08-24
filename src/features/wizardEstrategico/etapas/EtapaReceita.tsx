import { Alert, Card, CampoMoeda, CampoPercentual, formatarReais } from "../../../design-system";
import { campoManual } from "../components/campoManual";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

export function EtapaReceita({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const receita = rascunho.receita;
  const faturamento = receita.faturamentoAnual?.valor;
  const entradasAtividade = Object.values(receita.receitaPorAtividade ?? {});
  const temAtividades = entradasAtividade.length > 0;
  const soma = entradasAtividade.reduce((acc, c) => acc + c.valor, 0);
  const divergente = temAtividades && faturamento !== undefined && (faturamento === 0 ? soma !== 0 : Math.abs(soma - faturamento) / faturamento > 0.01);

  return (
    <Card title="Receita">
      <CampoMoeda label="Faturamento anual" value={faturamento ?? 0} onChange={(v) => dispatch({ tipo: "atualizarReceita", valores: { faturamentoAnual: campoManual(v) } })} />

      {temAtividades && (
        <Alert tone={divergente ? "warn" : "info"}>
          Receita total informada: {formatarReais(faturamento ?? 0)} · Soma das atividades: {formatarReais(soma)}
          {divergente && " — a divergência precisa ser resolvida antes de simular (não é corrigida automaticamente)."}
        </Alert>
      )}

      <CampoPercentual
        label="Crescimento anual estimado (opcional)"
        value={(receita.crescimentoAnualEstimado?.valor ?? 0) * 100}
        onChange={(v) => dispatch({ tipo: "atualizarReceita", valores: { crescimentoAnualEstimado: campoManual(v / 100) } })}
      />

      <CampoPercentual
        label="Mix de mercado — B2B"
        value={(receita.mixMercado?.b2b?.valor ?? 0) * 100}
        onChange={(v) => dispatch({ tipo: "atualizarReceita", valores: { mixMercado: { ...receita.mixMercado, b2b: campoManual(v / 100) } } })}
      />
      <CampoPercentual
        label="Mix de mercado — B2C"
        value={(receita.mixMercado?.b2c?.valor ?? 0) * 100}
        onChange={(v) => dispatch({ tipo: "atualizarReceita", valores: { mixMercado: { ...receita.mixMercado, b2c: campoManual(v / 100) } } })}
      />
    </Card>
  );
}
