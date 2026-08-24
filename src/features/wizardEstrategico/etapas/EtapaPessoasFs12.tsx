import { Alert, Card, CampoMoeda } from "../../../design-system";
import { campoManualOuIndefinido } from "../components/campoManual";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

export function fatorRAplicavel(rascunho: RascunhoCenarioEmpresa): boolean {
  return rascunho.regimesSelecionados.includes("simples_unificado") || rascunho.regimesSelecionados.includes("simples_hibrido");
}

export function EtapaPessoasFs12({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const pessoas = rascunho.pessoas;
  const aplicavel = fatorRAplicavel(rascunho);

  return (
    <Card title="Pessoas / FS12">
      <CampoMoeda label="Número de empregados" value={pessoas.numeroEmpregados?.valor ?? 0} onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { numeroEmpregados: campoManualOuIndefinido(v || undefined) } })} />
      <CampoMoeda label="Número de sócios" value={pessoas.numeroSocios?.valor ?? 0} onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { numeroSocios: campoManualOuIndefinido(v || undefined) } })} />

      {!aplicavel && <Alert tone="info">Fator R não é aplicável à seleção atual de regimes (nenhum Simples selecionado na etapa Fiscal) — os campos abaixo não são necessários agora.</Alert>}

      {aplicavel && (
        <>
          <p>Componentes usados pelo motor para compor o FS12 — sempre valores anuais; se não houver 12 meses completos, a regra de empresa nova é aplicada automaticamente no motor, nunca aqui.</p>
          <CampoMoeda label="Folha de pagamento anual (FS12)" value={pessoas.folhaAnual?.valor ?? 0} onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { folhaAnual: campoManualOuIndefinido(v || undefined) } })} />
          <CampoMoeda label="Encargos anuais (FS12)" value={pessoas.encargosAnual?.valor ?? 0} onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { encargosAnual: campoManualOuIndefinido(v || undefined) } })} />
          <CampoMoeda label="Pró-labore anual (FS12)" value={pessoas.proLaboreAnual?.valor ?? 0} onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { proLaboreAnual: campoManualOuIndefinido(v || undefined) } })} />
          <CampoMoeda
            label="Terceiros/autônomos anual (informativo — não compõe o FS12)"
            value={pessoas.terceirosAutonomosAnual?.valor ?? 0}
            onChange={(v) => dispatch({ tipo: "atualizarPessoas", valores: { terceirosAutonomosAnual: campoManualOuIndefinido(v || undefined) } })}
          />
        </>
      )}

      {aplicavel && pessoas.folhaAnual === undefined && pessoas.encargosAnual === undefined && pessoas.proLaboreAnual === undefined && (
        <Alert tone="warn">FS12 não informada — o Fator R poderá ficar indeterminado na análise. Isso não bloqueia a simulação.</Alert>
      )}
    </Card>
  );
}
