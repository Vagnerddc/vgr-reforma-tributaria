import { Alert, Button, Card, CampoMoeda } from "../../../design-system";
import type { NaturezaEconomica, TratamentoCredito, GastoInformado } from "../../../engine/creditoTributario";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

const NATUREZAS: { value: NaturezaEconomica; label: string }[] = [
  { value: "custo_direto", label: "Custo direto" },
  { value: "custo_operacional", label: "Custo operacional" },
  { value: "folha_e_encargos", label: "Folha e encargos" },
  { value: "beneficios_pessoal", label: "Benefícios de pessoal" },
  { value: "despesa_administrativa", label: "Despesa administrativa" },
  { value: "outros_gastos", label: "Outros gastos" },
];

const TRATAMENTOS: { value: TratamentoCredito; label: string }[] = [
  { value: "creditavel", label: "Creditável" },
  { value: "nao_creditavel", label: "Não creditável" },
  { value: "parcial", label: "Parcial" },
  { value: "indeterminado", label: "Não sei / indeterminado" },
];

function novoItem(): GastoInformado {
  return {
    categoria: {
      chave: "",
      label: "",
      naturezaEconomica: "custo_operacional",
      creditoPisCofins: { tratamento: "indeterminado", status: "confirmado" },
      creditoIcmsIpi: { tratamento: "indeterminado", status: "confirmado" },
      creditoIbsCbs: { tratamento: "indeterminado", status: "confirmado" },
    },
    valorAnual: 0,
  };
}

export function EtapaCustosCreditos({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const itens = rascunho.custos.itens;

  function atualizarItem(indice: number, atualizador: (item: GastoInformado) => GastoInformado) {
    dispatch({ tipo: "definirCustos", itens: itens.map((item, i) => (i === indice ? atualizador(item) : item)) });
  }

  function removerItem(indice: number) {
    dispatch({ tipo: "definirCustos", itens: itens.filter((_, i) => i !== indice) });
  }

  return (
    <Card title="Custos e Créditos">
      <p>
        Reaproveita a taxonomia já existente de natureza econômica e tratamento de crédito por sistema (PIS/COFINS, ICMS/IPI, IBS/CBS). Quando não souber o tratamento, escolha "não sei /
        indeterminado" — nunca vira "não creditável" por omissão.
      </p>

      {itens.map((item, indice) => (
        <div key={indice} className="vgr-wizard-item-custo">
          <label className="vgr-field">
            <span className="vgr-field-label">Descrição</span>
            <input className="vgr-input" value={item.categoria.label} onChange={(e) => atualizarItem(indice, (i) => ({ ...i, categoria: { ...i.categoria, label: e.target.value, chave: e.target.value } }))} />
          </label>

          <label className="vgr-field">
            <span className="vgr-field-label">Natureza econômica</span>
            <select className="vgr-select" value={item.categoria.naturezaEconomica} onChange={(e) => atualizarItem(indice, (i) => ({ ...i, categoria: { ...i.categoria, naturezaEconomica: e.target.value as NaturezaEconomica } }))}>
              {NATUREZAS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>

          <CampoMoeda label="Valor anual" value={item.valorAnual} onChange={(v) => atualizarItem(indice, (i) => ({ ...i, valorAnual: v }))} />

          {(["creditoPisCofins", "creditoIcmsIpi", "creditoIbsCbs"] as const).map((sistema) => (
            <label className="vgr-field" key={sistema}>
              <span className="vgr-field-label">
                Crédito — {sistema === "creditoPisCofins" ? "PIS/COFINS" : sistema === "creditoIcmsIpi" ? "ICMS/IPI" : "IBS/CBS"}
              </span>
              <select
                className="vgr-select"
                value={item.categoria[sistema].tratamento}
                onChange={(e) => atualizarItem(indice, (i) => ({ ...i, categoria: { ...i.categoria, [sistema]: { ...i.categoria[sistema], tratamento: e.target.value as TratamentoCredito } } }))}
              >
                {TRATAMENTOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <Button variant="tertiary" onClick={() => removerItem(indice)}>
            Remover item
          </Button>
        </div>
      ))}

      {itens.some((i) => [i.categoria.creditoPisCofins, i.categoria.creditoIcmsIpi, i.categoria.creditoIbsCbs].some((t) => t.tratamento === "indeterminado")) && (
        <Alert tone="info">Há itens com tratamento de crédito indeterminado — a análise seguirá em frente, sinalizando essa lacuna na Revisão.</Alert>
      )}

      <Button variant="secondary" onClick={() => dispatch({ tipo: "definirCustos", itens: [...itens, novoItem()] })}>
        Adicionar item de custo
      </Button>
    </Card>
  );
}
