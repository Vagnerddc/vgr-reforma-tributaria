import { useState } from "react";
import type { Regime, MeioPagamento, AnexoSimples, TipoOperacaoConstrucao } from "../engine/types";
import { LABEL_PERFIL, taxaCrescimentoDefault, type PerfilAtividade } from "../engine/atividades";
import type { MetodologiaMultiAno } from "../engine/metodologiaMultiAno";
import { CampoPercentual } from "../lib/campos";
import { Stepper, Tooltip, Button, Field, Input, Select } from "../design-system";
import { CustosDespesasStep, type CustosDespesasResultado } from "./CustosDespesasStep";

type ModoProjecao = "crescimento" | "margem";

/**
 * Wizard do simulador — baseline visual aprovada no protótipo (etapas nomeadas,
 * progresso visível, validação antes de avançar, Anterior/Continuar, só os
 * campos da etapa atual visíveis). Não tem NENHUMA lógica de cálculo própria:
 * todo o estado e os handlers vêm de ImportarSped (que já consome o engine),
 * este componente só reorganiza a apresentação em passos.
 */
export interface SimuladorWizardProps {
  nomeEmpresa: string;
  setNomeEmpresa: (v: string) => void;
  perfil: PerfilAtividade;
  setPerfil: (v: PerfilAtividade) => void;
  regimeAtual: Regime;
  setRegimeAtual: (v: Regime) => void;
  isSimples: boolean;
  anexoSimples: AnexoSimples;
  setAnexoSimples: (v: AnexoSimples) => void;
  tipoAviacao: "convencional" | "drone";
  setTipoAviacao: (v: "convencional" | "drone") => void;
  tipoOperacaoConstrucao: TipoOperacaoConstrucao;
  setTipoOperacaoConstrucao: (v: TipoOperacaoConstrucao) => void;
  percentualClienteContribuinte: number;
  setPercentualClienteContribuinte: (v: number) => void;
  percentualComprasProdutorRural: number;
  percentualCreditoPresumidoProdutorRural: number;
  setPercentualCreditoPresumidoProdutorRural: (v: number) => void;
  meioPagamento: MeioPagamento;
  setMeioPagamento: (v: MeioPagamento) => void;
  modoProjecao: ModoProjecao;
  setModoProjecao: (v: ModoProjecao) => void;
  margemAlvo: number;
  setMargemAlvo: (v: number) => void;
  avisoMeta: string | null;
  taxaCrescimento: number;
  setTaxaCrescimento: (v: number) => void;
  metodologia: MetodologiaMultiAno | null;
  onSubmit: () => void;
  processando?: boolean;
  /**
   * "sped": faturamento/despesas vêm do SPED importado, sobra decidir a
   * projeção (etapa 4). "manual": faturamento e alíquotas já foram
   * informados antes do wizard (ver ImportarSped.tsx) — simular() escalona
   * a carga ano a ano por conta própria, então a etapa de projeção não
   * existe nesse modo.
   */
  modo?: "sped" | "manual";
  /** Só usado no modo manual — alimenta o passo "Custos e despesas". */
  faturamentoAnualManual?: number;
  onCustosChange?: (resultado: CustosDespesasResultado) => void;
}

const ETAPAS_SPED = ["Empresa", "Regime e operação", "Créditos", "Projeção"];
const ETAPAS_MANUAL = ["Empresa", "Regime e operação", "Custos e despesas", "Créditos"];

export function SimuladorWizard(props: SimuladorWizardProps) {
  const modoManual = props.modo === "manual";
  const ETAPAS = modoManual ? ETAPAS_MANUAL : ETAPAS_SPED;
  const passoCustos = modoManual ? 3 : -1;
  const passoCreditos = modoManual ? 4 : 3;
  const passoProjecao = modoManual ? -1 : 4;
  const [passo, setPasso] = useState(1);
  const [erroNome, setErroNome] = useState(false);

  function avancar() {
    if (passo === 1 && !props.nomeEmpresa.trim()) {
      setErroNome(true);
      return;
    }
    setErroNome(false);
    setPasso((p) => Math.min(ETAPAS.length, p + 1));
  }
  function voltar() {
    setPasso((p) => Math.max(1, p - 1));
  }

  return (
    <div className="vgr-wizard">
      <Stepper labels={ETAPAS} currentStep={passo} />

      {passo === 1 && (
        <div>
          <Field label="Nome do cliente" error={erroNome ? "Informe o nome do cliente para continuar." : undefined}>
            <Input
              type="text"
              value={props.nomeEmpresa}
              onChange={(e) => {
                props.setNomeEmpresa(e.target.value);
                if (erroNome && e.target.value.trim()) setErroNome(false);
              }}
            />
          </Field>
          <Field label="Setor de atividade">
            <Select value={props.perfil} onChange={(e) => props.setPerfil(e.target.value as PerfilAtividade)}>
              {Object.entries(LABEL_PERFIL).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {passo === 2 && (
        <div>
          <Field label="Regime tributário atual">
            <Select value={props.regimeAtual} onChange={(e) => props.setRegimeAtual(e.target.value as Regime)}>
              <option value="simples_unificado">Simples Nacional — unificado</option>
              <option value="simples_hibrido">Simples Nacional — híbrido</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </Select>
          </Field>
          {props.isSimples && (
            <Field label="Anexo do Simples Nacional">
              <Select value={props.anexoSimples} onChange={(e) => props.setAnexoSimples(e.target.value as AnexoSimples)}>
                <option value="anexoIII">Anexo III</option>
                <option value="anexoV">Anexo V</option>
              </Select>
            </Field>
          )}
          {props.perfil === "aviacao_agricola" && (
            <Field label="Tipo de operação">
              <Select value={props.tipoAviacao} onChange={(e) => props.setTipoAviacao(e.target.value as "convencional" | "drone")}>
                <option value="convencional">Aeronave convencional</option>
                <option value="drone">Drone</option>
              </Select>
            </Field>
          )}
          {props.perfil === "construcao_civil" && (
            <Field label="Tipo de operação">
              <Select
                value={props.tipoOperacaoConstrucao}
                onChange={(e) => props.setTipoOperacaoConstrucao(e.target.value as TipoOperacaoConstrucao)}
              >
                <option value="empreitada">Empreitada</option>
                <option value="incorporacao">Incorporação / venda de imóvel</option>
                <option value="locacao">Locação de imóvel</option>
              </Select>
            </Field>
          )}
          <Field label="Meio de pagamento predominante">
            <Select value={props.meioPagamento} onChange={(e) => props.setMeioPagamento(e.target.value as MeioPagamento)}>
              <option value="pix">Pix</option>
              <option value="boleto">Boleto</option>
              <option value="ted">TED / transferência</option>
              <option value="cartao_credito">Cartão de crédito</option>
            </Select>
          </Field>
        </div>
      )}

      {modoManual && passo === passoCustos && (
        <CustosDespesasStep
          perfilPreSelecionado={props.perfil}
          faturamentoAnual={props.faturamentoAnualManual ?? 0}
          onChange={props.onCustosChange ?? (() => {})}
        />
      )}

      {passo === passoCreditos && (
        <div>
          <CampoPercentual
            label="% de clientes que já são contribuintes de IBS/CBS"
            value={props.percentualClienteContribuinte}
            onChange={props.setPercentualClienteContribuinte}
          />
          {props.percentualComprasProdutorRural > 0 && (
            <>
              <p className="vgr-field-hint" style={{ marginBottom: 12 }}>
                {props.percentualComprasProdutorRural.toFixed(0)}% das compras vêm de fornecedores identificados como produtor
                rural — calculado automaticamente a partir do SPED, não precisa informar.
              </p>
              <Tooltip label="A lei não fixa esse percentual — depende de ato do Comitê Gestor/Ministério da Fazenda, que pode variar por produto.">
                <CampoPercentual
                  label="% de crédito presumido sobre essas compras (art. 168)"
                  value={props.percentualCreditoPresumidoProdutorRural}
                  onChange={props.setPercentualCreditoPresumidoProdutorRural}
                />
              </Tooltip>
            </>
          )}
        </div>
      )}

      {passo === passoProjecao && !modoManual && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Button variant={props.modoProjecao === "margem" ? "primary" : "secondary"} onClick={() => props.setModoProjecao("margem")}>
              Definir meta de lucro
            </Button>
            <Button
              variant={props.modoProjecao === "crescimento" ? "primary" : "secondary"}
              onClick={() => props.setModoProjecao("crescimento")}
            >
              Definir crescimento de vendas
            </Button>
          </div>

          {props.modoProjecao === "margem" ? (
            <>
              <CampoPercentual label="Meta de lucro líquido em 2027 (%)" value={props.margemAlvo} onChange={props.setMargemAlvo} />
              <p className="vgr-field-hint">O sistema calcula o faturamento necessário para chegar nessa margem, mantendo as despesas de hoje.</p>
              {props.avisoMeta && <p className="vgr-field-error">{props.avisoMeta}</p>}
            </>
          ) : (
            <>
              <CampoPercentual
                label="Crescimento de vendas até 2027 (%)"
                value={props.taxaCrescimento}
                onChange={props.setTaxaCrescimento}
              />
              {props.metodologia?.taxaCrescimentoReal != null ? (
                <p className="vgr-field-hint">
                  Crescimento real 2025→2026: {(props.metodologia.taxaCrescimentoReal * 100).toFixed(1)}% ao ano.{" "}
                  <Button variant="tertiary" onClick={() => props.setTaxaCrescimento(props.metodologia!.taxaCrescimentoReal! * 100)}>
                    Usar crescimento real
                  </Button>
                </p>
              ) : (
                <p className="vgr-field-hint">
                  Sugestão para {LABEL_PERFIL[props.perfil]}: {(taxaCrescimentoDefault(props.perfil) * 100).toFixed(0)}% ao ano.{" "}
                  <Button variant="tertiary" onClick={() => props.setTaxaCrescimento(taxaCrescimentoDefault(props.perfil) * 100)}>
                    Usar sugestão
                  </Button>
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <Button variant="secondary" onClick={voltar} style={{ visibility: passo === 1 ? "hidden" : "visible" }}>
          ← Anterior
        </Button>
        {passo < ETAPAS.length ? (
          <Button variant="primary" onClick={avancar}>
            Salvar e continuar →
          </Button>
        ) : (
          <Button variant="primary" onClick={props.onSubmit} disabled={props.processando}>
            {props.processando ? "Calculando…" : "Processar simulação →"}
          </Button>
        )}
      </div>
    </div>
  );
}
