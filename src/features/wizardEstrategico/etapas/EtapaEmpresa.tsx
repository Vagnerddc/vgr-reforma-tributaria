import { useMemo } from "react";
import { Card, Field, Input } from "../../../design-system";
import { listarPerfis } from "../../../engine/setores/catalogo";
import { campoManualOuIndefinido } from "../components/campoManual";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

export function EtapaEmpresa({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const perfis = useMemo(() => listarPerfis(), []);
  const id = rascunho.identificacao;

  return (
    <Card title="Empresa">
      <p>Somente o que a análise estratégica realmente utiliza — nada de dados cadastrais irrelevantes.</p>

      <Field label="Nome da empresa">
        <Input value={id.nomeEmpresa?.valor ?? ""} onChange={(e) => dispatch({ tipo: "atualizarIdentificacao", valores: { nomeEmpresa: campoManualOuIndefinido(e.target.value || undefined) } })} />
      </Field>

      <Field label="UF">
        <Input value={id.uf?.valor ?? ""} maxLength={2} onChange={(e) => dispatch({ tipo: "atualizarIdentificacao", valores: { uf: campoManualOuIndefinido(e.target.value ? e.target.value.toUpperCase() : undefined) } })} />
      </Field>

      <Field label="Município">
        <Input value={id.municipio?.valor ?? ""} onChange={(e) => dispatch({ tipo: "atualizarIdentificacao", valores: { municipio: campoManualOuIndefinido(e.target.value || undefined) } })} />
      </Field>

      <Field label="Data de abertura" hint="Usada quando a receita histórica de 12 meses não está disponível (empresa nova).">
        <input type="date" className="vgr-input" value={id.dataAberturaEmpresa?.valor ?? ""} onChange={(e) => dispatch({ tipo: "atualizarIdentificacao", valores: { dataAberturaEmpresa: campoManualOuIndefinido(e.target.value || undefined) } })} />
      </Field>

      <Field label="Perfil setorial — atividade principal" hint="O perfil sugere campos e ajuda contextual; nunca decide regime, crédito ou tratamento tributário.">
        <select
          className="vgr-select"
          value={id.atividadePrincipal?.perfilId ?? ""}
          onChange={(e) =>
            dispatch({
              tipo: "atualizarIdentificacao",
              valores: { atividadePrincipal: e.target.value ? { perfilId: e.target.value, origem: "informado_usuario", status: "confirmado" } : undefined },
            })
          }
        >
          <option value="">Selecione…</option>
          {perfis.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.segmento} — {perfil.descricao}
            </option>
          ))}
        </select>
      </Field>
    </Card>
  );
}
