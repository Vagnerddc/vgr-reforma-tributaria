import { Alert, Card, CampoMoeda, CampoPercentual } from "../../../design-system";
import { campoManual } from "../components/campoManual";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

export function EtapaCaixaSplit({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const premissas = rascunho.premissasSplit;

  function atualizarPremissas(parcial: Partial<NonNullable<typeof premissas>>) {
    dispatch({ tipo: "definirPremissasSplit", premissas: { ...premissas, ...parcial } });
  }

  return (
    <Card title="Caixa / Split Payment">
      <label style={{ display: "block", marginBottom: 12 }}>
        <input type="checkbox" checked={rascunho.analisarCaixa} onChange={(e) => dispatch({ tipo: "definirAnalisarCaixa", valor: e.target.checked })} /> Analisar impacto no caixa e Split Payment
      </label>

      {!rascunho.analisarCaixa && <Alert tone="info">Sem esta etapa, a análise segue normalmente — o impacto de caixa ficará indisponível, nunca zero.</Alert>}

      {rascunho.analisarCaixa && (
        <>
          <p>Somente os campos que o motor de Split Payment realmente aceita. Nenhum percentual é presumido — preencha apenas o que você souber.</p>

          <CampoPercentual
            label="Percentual de recebimentos sujeitos ao split"
            value={(premissas?.percentualRecebimentosSujeitos?.valor ?? 0) * 100}
            onChange={(v) => atualizarPremissas({ percentualRecebimentosSujeitos: campoManual(v / 100) })}
          />
          <CampoPercentual
            label="Percentual do tributo segregado"
            value={(premissas?.percentualTributoSegregado?.valor ?? 0) * 100}
            onChange={(v) => atualizarPremissas({ percentualTributoSegregado: campoManual(v / 100) })}
          />
          <CampoPercentual label="Custo de capital (% a.m.)" value={(premissas?.taxaCustoCapitalMensal?.valor ?? 0) * 100} onChange={(v) => atualizarPremissas({ taxaCustoCapitalMensal: campoManual(v / 100) })} />
          <CampoMoeda
            label="Prazo atual de pagamento dos tributos (dias)"
            value={premissas?.prazoAtualPagamentoTributosDias?.valor ?? 0}
            onChange={(v) => atualizarPremissas({ prazoAtualPagamentoTributosDias: campoManual(v) })}
          />
          <CampoMoeda label="Caixa mínimo operacional" value={premissas?.caixaMinimoOperacional?.valor ?? 0} onChange={(v) => atualizarPremissas({ caixaMinimoOperacional: campoManual(v) })} />

          {!premissas && <Alert tone="warn">Nenhuma premissa informada ainda — o impacto de caixa poderá ficar indisponível mesmo com esta etapa habilitada.</Alert>}
        </>
      )}
    </Card>
  );
}
