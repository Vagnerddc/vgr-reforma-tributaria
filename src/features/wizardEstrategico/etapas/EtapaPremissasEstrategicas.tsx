import { Alert, Button, Card, CampoMoeda } from "../../../design-system";
import type { Objetivo, VariavelOtimizacao } from "../../../engine/otimizacaoMultidimensional/tipos";
import type { TipoPontoVirada, IntervaloBusca } from "../../../engine/motorPontosVirada/tipos";
import type { VariavelSensibilidade } from "../../../engine/motorCenarios/sensibilidade";
import type { AcaoWizard } from "../estado";
import type { PontoViradaRascunho, RascunhoCenarioEmpresa } from "../tipos";

const VARIAVEIS: { value: VariavelSensibilidade; label: string }[] = [
  { value: "faturamento", label: "Faturamento" },
  { value: "crescimento", label: "Crescimento" },
  { value: "creditosIbsCbs", label: "Créditos IBS/CBS" },
  { value: "custosFixos", label: "Custos fixos" },
  { value: "folha", label: "Folha" },
  { value: "custoCapital", label: "Custo de capital" },
  { value: "percentualRecebimentosSujeitosSplit", label: "% recebimentos sujeitos ao split" },
  { value: "percentualTributoSegregadoSplit", label: "% tributo segregado no split" },
];

const OBJETIVOS: { value: Objetivo; label: string }[] = [
  { value: "minimizar_carga_fiscal", label: "Minimizar carga fiscal" },
  { value: "maximizar_resultado_economico", label: "Maximizar resultado econômico" },
  { value: "minimizar_capital_giro_adicional", label: "Minimizar capital de giro adicional" },
];

const TIPOS_PONTO_VIRADA: { value: TipoPontoVirada; label: string }[] = [
  { value: "mudanca_regime_menor_carga", label: "Mudança de regime com menor carga" },
  { value: "mudanca_anexo_simples", label: "Mudança de anexo do Simples" },
  { value: "cruzamento_fator_r", label: "Cruzamento do Fator R" },
  { value: "preservacao_margem", label: "Preservação de margem" },
  { value: "margem_zero", label: "Margem zero" },
  { value: "igualdade_resultado_economico", label: "Igualdade de resultado econômico" },
  { value: "igualdade_custo_financeiro", label: "Igualdade de custo financeiro" },
  { value: "limite_capital_giro", label: "Limite de capital de giro" },
  { value: "mudanca_elegibilidade", label: "Mudança de elegibilidade" },
];

export function EtapaPremissasEstrategicas({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const otimizacao = rascunho.otimizacao;

  function novaVariavelOtimizacao(): VariavelOtimizacao {
    return { variavel: "faturamento", min: 0, max: 0, passos: 5 };
  }

  function atualizarVariavel(indice: number, atualizador: (v: VariavelOtimizacao) => VariavelOtimizacao) {
    dispatch({ tipo: "definirOtimizacao", otimizacao: { ...otimizacao, variaveis: otimizacao.variaveis.map((v, i) => (i === indice ? atualizador(v) : v)) } });
  }

  function alternarObjetivo(objetivo: Objetivo) {
    const objetivos = otimizacao.objetivos.includes(objetivo) ? otimizacao.objetivos.filter((o) => o !== objetivo) : [...otimizacao.objetivos, objetivo];
    dispatch({ tipo: "definirOtimizacao", otimizacao: { ...otimizacao, objetivos } });
  }

  function novoPontoVirada(): PontoViradaRascunho {
    return { tipo: "preservacao_margem", variavel: "faturamento", intervalo: { min: 0, max: 0 }, ano: rascunho.ano ?? new Date().getFullYear() };
  }

  function atualizarPontoVirada(indice: number, atualizador: (p: PontoViradaRascunho) => PontoViradaRascunho) {
    dispatch({ tipo: "definirPontosVirada", pontos: rascunho.pontosVirada.map((p, i) => (i === indice ? atualizador(p) : p)) });
  }

  function atualizarIntervalo(indice: number, parcial: Partial<IntervaloBusca>) {
    atualizarPontoVirada(indice, (p) => ({ ...p, intervalo: { ...p.intervalo, ...parcial } }));
  }

  return (
    <Card title="Premissas Estratégicas">
      <p>Só usadas se você quiser habilitar otimização e/ou pontos de virada. A análise básica funciona sem esta etapa.</p>

      <h4>Otimização multidimensional</h4>
      <label style={{ display: "block", marginBottom: 8 }}>
        <input type="checkbox" checked={otimizacao.habilitada} onChange={(e) => dispatch({ tipo: "definirOtimizacao", otimizacao: { ...otimizacao, habilitada: e.target.checked } })} /> Habilitar
        otimização
      </label>

      {otimizacao.habilitada && (
        <>
          <fieldset>
            <legend>Objetivos</legend>
            {OBJETIVOS.map((o) => (
              <label key={o.value} style={{ display: "block" }}>
                <input type="checkbox" checked={otimizacao.objetivos.includes(o.value)} onChange={() => alternarObjetivo(o.value)} /> {o.label}
              </label>
            ))}
          </fieldset>

          {otimizacao.variaveis.map((variavel, indice) => (
            <div key={indice} className="vgr-wizard-variavel-otimizacao">
              <select className="vgr-select" value={variavel.variavel} onChange={(e) => atualizarVariavel(indice, (v) => ({ ...v, variavel: e.target.value as VariavelSensibilidade }))}>
                {VARIAVEIS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <CampoMoeda label="Mínimo" value={variavel.min} onChange={(v) => atualizarVariavel(indice, (variavelAtual) => ({ ...variavelAtual, min: v }))} />
              <CampoMoeda label="Máximo" value={variavel.max} onChange={(v) => atualizarVariavel(indice, (variavelAtual) => ({ ...variavelAtual, max: v }))} />
              <CampoMoeda label="Passos" value={variavel.passos} onChange={(v) => atualizarVariavel(indice, (variavelAtual) => ({ ...variavelAtual, passos: v }))} />
              <Button variant="tertiary" onClick={() => dispatch({ tipo: "definirOtimizacao", otimizacao: { ...otimizacao, variaveis: otimizacao.variaveis.filter((_, i) => i !== indice) } })}>
                Remover
              </Button>
            </div>
          ))}

          {otimizacao.variaveis.length === 0 && <Alert tone="info">Nenhum limite foi presumido — adicione ao menos uma variável com mínimo/máximo próprios.</Alert>}

          <Button variant="secondary" onClick={() => dispatch({ tipo: "definirOtimizacao", otimizacao: { ...otimizacao, variaveis: [...otimizacao.variaveis, novaVariavelOtimizacao()] } })}>
            Adicionar variável
          </Button>
        </>
      )}

      <h4>Pontos de virada a investigar</h4>
      {rascunho.pontosVirada.map((ponto, indice) => (
        <div key={indice} className="vgr-wizard-ponto-virada">
          <select className="vgr-select" value={ponto.tipo} onChange={(e) => atualizarPontoVirada(indice, (p) => ({ ...p, tipo: e.target.value as TipoPontoVirada }))}>
            {TIPOS_PONTO_VIRADA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select className="vgr-select" value={ponto.variavel} onChange={(e) => atualizarPontoVirada(indice, (p) => ({ ...p, variavel: e.target.value as VariavelSensibilidade }))}>
            {VARIAVEIS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <CampoMoeda label="Intervalo — mínimo" value={ponto.intervalo.min} onChange={(v) => atualizarIntervalo(indice, { min: v })} />
          <CampoMoeda label="Intervalo — máximo" value={ponto.intervalo.max} onChange={(v) => atualizarIntervalo(indice, { max: v })} />
          <Button variant="tertiary" onClick={() => dispatch({ tipo: "definirPontosVirada", pontos: rascunho.pontosVirada.filter((_, i) => i !== indice) })}>
            Remover
          </Button>
        </div>
      ))}

      <Button variant="secondary" onClick={() => dispatch({ tipo: "definirPontosVirada", pontos: [...rascunho.pontosVirada, novoPontoVirada()] })}>
        Adicionar ponto de virada
      </Button>
    </Card>
  );
}
