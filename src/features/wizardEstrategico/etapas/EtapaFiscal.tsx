import { Alert, Button, Card, CampoMoeda } from "../../../design-system";
import { campoManual, campoManualOuIndefinido } from "../components/campoManual";
import type { AjusteFiscal } from "../../../engine/cenarioEmpresa";
import type { Regime } from "../../../engine/types";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

const REGIMES: { value: Regime; label: string }[] = [
  { value: "simples_unificado", label: "Simples Nacional (unificado)" },
  { value: "simples_hibrido", label: "Simples Nacional (híbrido)" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
];

export function EtapaFiscal({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const selecionados = rascunho.regimesSelecionados;
  const lucroRealSelecionado = selecionados.includes("lucro_real");
  const ajustes = rascunho.tributario.ajustesFiscais ?? [];

  function alternarRegime(regime: Regime) {
    const novos = selecionados.includes(regime) ? selecionados.filter((r) => r !== regime) : [...selecionados, regime];
    dispatch({ tipo: "definirRegimesSelecionados", regimes: novos });
  }

  function adicionarAjuste() {
    const novo: AjusteFiscal = { tipo: "adicao", tributoAplicavel: "ambos", valor: 0, descricao: "", origem: "informado_usuario", status: "confirmado" };
    dispatch({ tipo: "atualizarTributario", valores: { ajustesFiscais: [...ajustes, novo] } });
  }

  function atualizarAjuste(indice: number, atualizador: (a: AjusteFiscal) => AjusteFiscal) {
    dispatch({ tipo: "atualizarTributario", valores: { ajustesFiscais: ajustes.map((a, i) => (i === indice ? atualizador(a) : a)) } });
  }

  function removerAjuste(indice: number) {
    dispatch({ tipo: "atualizarTributario", valores: { ajustesFiscais: ajustes.filter((_, i) => i !== indice) } });
  }

  return (
    <Card title="Regimes e Dados Fiscais">
      <p>Selecionar um regime significa considerá-lo na comparação — a elegibilidade jurídica final é sempre decidida pelo motor, nunca aqui.</p>

      <fieldset>
        <legend>Regimes a comparar</legend>
        {REGIMES.map((regime) => (
          <label key={regime.value} style={{ display: "block" }}>
            <input type="checkbox" checked={selecionados.includes(regime.value)} onChange={() => alternarRegime(regime.value)} /> {regime.label}
          </label>
        ))}
      </fieldset>

      {selecionados.length === 0 && <Alert tone="warn">Selecione ao menos um regime — a simulação exige isso.</Alert>}

      {lucroRealSelecionado && (
        <>
          <h4>Ajustes fiscais (Lucro Real)</h4>
          {ajustes.map((ajuste, indice) => (
            <div key={indice} className="vgr-wizard-ajuste-fiscal">
              <input className="vgr-input" placeholder="Descrição" value={ajuste.descricao} onChange={(e) => atualizarAjuste(indice, (a) => ({ ...a, descricao: e.target.value }))} />
              <select className="vgr-select" value={ajuste.tipo} onChange={(e) => atualizarAjuste(indice, (a) => ({ ...a, tipo: e.target.value as AjusteFiscal["tipo"] }))}>
                <option value="adicao">Adição</option>
                <option value="exclusao">Exclusão</option>
              </select>
              <select className="vgr-select" value={ajuste.tributoAplicavel} onChange={(e) => atualizarAjuste(indice, (a) => ({ ...a, tributoAplicavel: e.target.value as AjusteFiscal["tributoAplicavel"] }))}>
                <option value="irpj">IRPJ</option>
                <option value="csll">CSLL</option>
                <option value="ambos">Ambos</option>
              </select>
              <CampoMoeda label="Valor" value={ajuste.valor} onChange={(v) => atualizarAjuste(indice, (a) => ({ ...a, valor: v }))} />
              <Button variant="tertiary" onClick={() => removerAjuste(indice)}>
                Remover
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={adicionarAjuste}>
            Adicionar ajuste fiscal
          </Button>

          <h4>Saldos de prejuízo anteriores</h4>
          <CampoMoeda
            label="Saldo IRPJ"
            value={rascunho.tributario.saldosPrejuizoAnteriores?.irpj?.valor ?? 0}
            onChange={(v) => dispatch({ tipo: "atualizarTributario", valores: { saldosPrejuizoAnteriores: { ...rascunho.tributario.saldosPrejuizoAnteriores, irpj: campoManual(v) } } })}
          />
          <CampoMoeda
            label="Saldo CSLL"
            value={rascunho.tributario.saldosPrejuizoAnteriores?.csll?.valor ?? 0}
            onChange={(v) => dispatch({ tipo: "atualizarTributario", valores: { saldosPrejuizoAnteriores: { ...rascunho.tributario.saldosPrejuizoAnteriores, csll: campoManual(v) } } })}
          />

          {ajustes.length === 0 && !rascunho.tributario.saldosPrejuizoAnteriores && <Alert tone="info">Lucro Real com dados parciais — a análise segue com ressalva, sem inventar ajustes/saldos.</Alert>}
        </>
      )}

      <h4>Regime atual (opcional)</h4>
      <select
        className="vgr-select"
        value={rascunho.tributario.regimeAtual?.valor ?? ""}
        onChange={(e) => dispatch({ tipo: "atualizarTributario", valores: { regimeAtual: campoManualOuIndefinido(e.target.value ? (e.target.value as Regime) : undefined) } })}
      >
        <option value="">Não informado</option>
        {REGIMES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </Card>
  );
}
