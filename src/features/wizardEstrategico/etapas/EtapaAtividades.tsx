import { useMemo } from "react";
import { Alert, Button, Card, Field, CampoMoeda } from "../../../design-system";
import { listarPerfis } from "../../../engine/setores/catalogo";
import { campoManual } from "../components/campoManual";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

export function EtapaAtividades({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const perfis = useMemo(() => listarPerfis(), []);
  const secundarias = rascunho.identificacao.atividadesSecundarias ?? [];
  const principal = rascunho.identificacao.atividadePrincipal;

  function atualizarReceitaAtividade(perfilId: string, valor: number) {
    dispatch({ tipo: "atualizarReceita", valores: { receitaPorAtividade: { ...rascunho.receita.receitaPorAtividade, [perfilId]: campoManual(valor) } } });
  }

  function adicionarAtividade() {
    if (perfis.length === 0) return;
    const perfilId = perfis[0].id;
    dispatch({ tipo: "atualizarIdentificacao", valores: { atividadesSecundarias: [...secundarias, { perfilId, origem: "informado_usuario", status: "confirmado" }] } });
    dispatch({ tipo: "definirDadosSetoriais", dados: [...rascunho.dadosSetoriais, { perfilId, valores: {} }] });
  }

  function removerAtividade(perfilId: string) {
    dispatch({ tipo: "atualizarIdentificacao", valores: { atividadesSecundarias: secundarias.filter((a) => a.perfilId !== perfilId) } });
    dispatch({ tipo: "definirDadosSetoriais", dados: rascunho.dadosSetoriais.filter((d) => d.perfilId !== perfilId) });
    const receitaPorAtividade = { ...rascunho.receita.receitaPorAtividade };
    delete receitaPorAtividade[perfilId];
    dispatch({ tipo: "atualizarReceita", valores: { receitaPorAtividade } });
  }

  function atualizarPerfilAtividade(perfilIdAntigo: string, perfilIdNovo: string) {
    dispatch({ tipo: "atualizarIdentificacao", valores: { atividadesSecundarias: secundarias.map((a) => (a.perfilId === perfilIdAntigo ? { ...a, perfilId: perfilIdNovo } : a)) } });
  }

  return (
    <Card title="Atividades">
      <p>A atividade principal foi definida na etapa Empresa. Multiatividade é opcional — cada atividade mantém sua própria receita, sem misturar tudo em um número genérico.</p>

      {!principal && <Alert tone="warn">Defina a atividade principal na etapa Empresa antes de continuar.</Alert>}

      {principal && <CampoMoeda label="Receita da atividade principal (opcional, só para segregar por atividade)" value={rascunho.receita.receitaPorAtividade?.[principal.perfilId]?.valor ?? 0} onChange={(v) => atualizarReceitaAtividade(principal.perfilId, v)} />}

      {secundarias.map((atividade, indice) => (
        <div key={indice} className="vgr-wizard-atividade-secundaria">
          <Field label={`Atividade secundária ${indice + 1}`}>
            <select className="vgr-select" value={atividade.perfilId} onChange={(e) => atualizarPerfilAtividade(atividade.perfilId, e.target.value)}>
              {perfis.map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.segmento} — {perfil.descricao}
                </option>
              ))}
            </select>
          </Field>
          <CampoMoeda label="Receita desta atividade" value={rascunho.receita.receitaPorAtividade?.[atividade.perfilId]?.valor ?? 0} onChange={(v) => atualizarReceitaAtividade(atividade.perfilId, v)} />
          <Button variant="tertiary" onClick={() => removerAtividade(atividade.perfilId)}>
            Remover atividade
          </Button>
        </div>
      ))}

      <Button variant="secondary" onClick={adicionarAtividade} disabled={!principal}>
        Adicionar atividade
      </Button>
    </Card>
  );
}
