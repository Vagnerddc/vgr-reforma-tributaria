import { useEffect, useMemo, useState } from "react";
import {
  categoriasDespesaDoPerfil,
  categoriasGenericasDaNatureza,
  LABEL_PERFIL,
  LABEL_NATUREZA_OPERACAO,
  type PerfilAtividade,
  type NaturezaOperacaoGenerica,
} from "../engine/atividades";
import {
  agregarCreditoPorSistema,
  LABEL_NATUREZA_ECONOMICA,
  type CategoriaGasto,
  type GastoInformado,
  type NaturezaEconomica,
  type ResultadoAgregacaoCredito,
} from "../engine/creditoTributario";
import { CampoMoeda, CampoPercentual } from "../lib/campos";
import { Select, Field, Button, Alert } from "../design-system";

type Classificacao = PerfilAtividade | NaturezaOperacaoGenerica;

function ehPerfilEspecifico(c: Classificacao): c is PerfilAtividade {
  return c in LABEL_PERFIL;
}

function categoriasDe(classificacao: Classificacao): CategoriaGasto[] {
  return ehPerfilEspecifico(classificacao)
    ? categoriasDespesaDoPerfil(classificacao)
    : categoriasGenericasDaNatureza(classificacao);
}

/** Agrupa categorias por natureza econômica, na ordem em que devem aparecer na tela. */
const ORDEM_NATUREZA: NaturezaEconomica[] = [
  "custo_direto",
  "custo_operacional",
  "folha_e_encargos",
  "beneficios_pessoal",
  "despesa_administrativa",
  "outros_gastos",
];

export interface CustosDespesasResultado {
  faturamentoAnual: number;
  agregacaoSistemaAtual: ResultadoAgregacaoCredito;
  agregacaoNovoSistema: ResultadoAgregacaoCredito;
  somaGastosInformados: number;
}

interface CustosDespesasStepProps {
  perfilPreSelecionado: PerfilAtividade;
  faturamentoAnual: number;
  onChange: (resultado: CustosDespesasResultado) => void;
}

/**
 * Passo "Custos e despesas" do wizard manual — coleta a estrutura de custos
 * de forma dinâmica conforme a natureza da operação (um dos 4 setores
 * específicos, já com categorias revisadas, ou uma classificação genérica
 * serviço/indústria/comércio/outras). Simplificado por padrão (um valor por
 * grupo de natureza econômica, em R$ ou %); "Detalhar composição" abre as
 * categorias individuais quando o usuário tem dado melhor.
 *
 * Não decide tratamento tributário aqui — só coleta valores e delega a
 * agregação a `agregarCreditoPorSistema` (engine/creditoTributario.ts).
 */
export function CustosDespesasStep({ perfilPreSelecionado, faturamentoAnual, onChange }: CustosDespesasStepProps) {
  const [classificacao, setClassificacao] = useState<Classificacao>(perfilPreSelecionado);
  const [modoDetalhado, setModoDetalhado] = useState<Partial<Record<NaturezaEconomica, boolean>>>({});
  const [valorAgregadoReais, setValorAgregadoReais] = useState<Partial<Record<NaturezaEconomica, number>>>({});
  const [valorAgregadoPercentual, setValorAgregadoPercentual] = useState<Partial<Record<NaturezaEconomica, number>>>({});
  const [unidadeAgregada, setUnidadeAgregada] = useState<Partial<Record<NaturezaEconomica, "reais" | "percentual">>>({});
  const [valoresPorCategoria, setValoresPorCategoria] = useState<Record<string, number>>({});

  const categorias = useMemo(() => categoriasDe(classificacao), [classificacao]);
  const gruposPresentes = useMemo(
    () => ORDEM_NATUREZA.filter((n) => categorias.some((c) => c.naturezaEconomica === n)),
    [categorias]
  );

  function valorDoGrupoEmReais(natureza: NaturezaEconomica): number {
    const categoriasDoGrupo = categorias.filter((c) => c.naturezaEconomica === natureza);
    if (modoDetalhado[natureza]) {
      return categoriasDoGrupo.reduce((soma, c) => soma + (valoresPorCategoria[c.chave] ?? 0), 0);
    }
    const unidade = unidadeAgregada[natureza] ?? "reais";
    if (unidade === "percentual") {
      return ((valorAgregadoPercentual[natureza] ?? 0) / 100) * faturamentoAnual;
    }
    return valorAgregadoReais[natureza] ?? 0;
  }

  const gastosInformados: GastoInformado[] = useMemo(() => {
    const gastos: GastoInformado[] = [];
    for (const natureza of gruposPresentes) {
      const categoriasDoGrupo = categorias.filter((c) => c.naturezaEconomica === natureza);
      if (modoDetalhado[natureza]) {
        for (const cat of categoriasDoGrupo) {
          const valor = valoresPorCategoria[cat.chave] ?? 0;
          if (valor > 0) gastos.push({ categoria: cat, valorAnual: valor });
        }
      } else {
        const valor = valorDoGrupoEmReais(natureza);
        if (valor > 0 && categoriasDoGrupo[0]) {
          // Simplificado: todas as categorias do grupo hoje têm o mesmo tratamento
          // (nenhuma foi revisada individualmente ainda) — usar a primeira como
          // representante do grupo não muda o resultado agregado.
          gastos.push({ categoria: categoriasDoGrupo[0], valorAnual: valor });
        }
      }
    }
    return gastos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, gruposPresentes, modoDetalhado, valoresPorCategoria, valorAgregadoReais, valorAgregadoPercentual, unidadeAgregada, faturamentoAnual]);

  const somaGastosInformados = gastosInformados.reduce((s, g) => s + g.valorAnual, 0);
  const agregacaoSistemaAtual = useMemo(
    () => agregarCreditoPorSistema(gastosInformados, "pisCofins", faturamentoAnual),
    [gastosInformados, faturamentoAnual]
  );
  const agregacaoIcmsIpi = useMemo(
    () => agregarCreditoPorSistema(gastosInformados, "icmsIpi", faturamentoAnual),
    [gastosInformados, faturamentoAnual]
  );
  const agregacaoNovoSistema = useMemo(
    () => agregarCreditoPorSistema(gastosInformados, "ibsCbs", faturamentoAnual),
    [gastosInformados, faturamentoAnual]
  );

  useEffect(() => {
    // Sistema atual (PIS/COFINS + ICMS/IPI) — mantém o mesmo número para os dois
    // hoje, como o motor já faz (ver calculo.ts); a estrutura de dados já separa
    // os dois por baixo, então basta trocar essa linha quando um dia divergirem.
    const percentualSistemaAtualCombinado = (agregacaoSistemaAtual.percentualCreditavel + agregacaoIcmsIpi.percentualCreditavel) / 2;
    onChange({
      faturamentoAnual,
      agregacaoSistemaAtual: { ...agregacaoSistemaAtual, percentualCreditavel: percentualSistemaAtualCombinado },
      agregacaoNovoSistema,
      somaGastosInformados,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agregacaoSistemaAtual, agregacaoIcmsIpi, agregacaoNovoSistema, somaGastosInformados, faturamentoAnual]);

  const percentualSobreFaturamento = faturamentoAnual > 0 ? (somaGastosInformados / faturamentoAnual) * 100 : 0;

  return (
    <div>
      <Field label="Como classificar os custos desta empresa?" hint="Os 4 setores específicos já têm categorias revisadas; as demais opções usam uma estrutura genérica por natureza da operação.">
        <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value as Classificacao)}>
          <optgroup label="Setores específicos">
            {(Object.entries(LABEL_PERFIL) as [PerfilAtividade, string][]).map(([valor, label]) => (
              <option key={valor} value={valor}>{label}</option>
            ))}
          </optgroup>
          <optgroup label="Classificação genérica">
            {(Object.entries(LABEL_NATUREZA_OPERACAO) as [NaturezaOperacaoGenerica, string][]).map(([valor, label]) => (
              <option key={valor} value={valor}>{label}</option>
            ))}
          </optgroup>
        </Select>
      </Field>

      {gruposPresentes.map((natureza) => {
        const categoriasDoGrupo = categorias.filter((c) => c.naturezaEconomica === natureza);
        const detalhado = modoDetalhado[natureza] ?? false;
        const unidade = unidadeAgregada[natureza] ?? "reais";
        return (
          <div key={natureza} className="vgr-card" style={{ marginBottom: 14 }}>
            <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>{LABEL_NATUREZA_ECONOMICA[natureza]}</strong>

            {!detalhado ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <Button variant={unidade === "reais" ? "primary" : "secondary"} onClick={() => setUnidadeAgregada((a) => ({ ...a, [natureza]: "reais" }))}>
                    R$ anual
                  </Button>
                  <Button variant={unidade === "percentual" ? "primary" : "secondary"} onClick={() => setUnidadeAgregada((a) => ({ ...a, [natureza]: "percentual" }))}>
                    % do faturamento
                  </Button>
                </div>
                {unidade === "reais" ? (
                  <CampoMoeda
                    label={`${LABEL_NATUREZA_ECONOMICA[natureza]} (R$/ano)`}
                    value={valorAgregadoReais[natureza] ?? 0}
                    onChange={(v) => setValorAgregadoReais((a) => ({ ...a, [natureza]: v }))}
                  />
                ) : (
                  <CampoPercentual
                    label={`${LABEL_NATUREZA_ECONOMICA[natureza]} (% do faturamento)`}
                    value={valorAgregadoPercentual[natureza] ?? 0}
                    onChange={(v) => setValorAgregadoPercentual((a) => ({ ...a, [natureza]: v }))}
                  />
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {categoriasDoGrupo.map((cat) => (
                  <CampoMoeda
                    key={cat.chave}
                    label={cat.label}
                    value={valoresPorCategoria[cat.chave] ?? 0}
                    onChange={(v) => setValoresPorCategoria((a) => ({ ...a, [cat.chave]: v }))}
                  />
                ))}
              </div>
            )}

            {categoriasDoGrupo.length > 1 && (
              <Button
                variant="tertiary"
                style={{ paddingLeft: 0, marginTop: 4 }}
                onClick={() => setModoDetalhado((m) => ({ ...m, [natureza]: !detalhado }))}
              >
                {detalhado ? "← Voltar ao valor único" : "Detalhar composição →"}
              </Button>
            )}
          </div>
        );
      })}

      {percentualSobreFaturamento > 100 && (
        <Alert tone="warn">
          ⚠ A soma dos custos e despesas informados representa {percentualSobreFaturamento.toFixed(0)}% do faturamento anual. Revise
          os valores antes de prosseguir.
        </Alert>
      )}
    </div>
  );
}
