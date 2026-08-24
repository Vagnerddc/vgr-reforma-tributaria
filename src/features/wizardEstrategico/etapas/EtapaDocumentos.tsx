/**
 * Etapa "Documentos" — sempre PULÁVEL (docs/ingestao-documental-v2.md).
 * Importa o que for possível diretamente dos documentos; o que não puder ser
 * obtido com segurança continua sendo perguntado nas etapas seguintes,
 * agora como revisão/complementação em vez de digitação do zero.
 */
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input } from "../../../design-system";
import { FileDropzone } from "../../../design-system/FileDropzone";
import { decodificarArquivosOuZip } from "../../../engine/sped/zip";
import { decodificarArquivosXmlOuZip } from "../../../engine/xml/zip";
import { tokenizarSped, identificarTipoArquivo } from "../../../engine/sped/parser";
import { ingerirCnpj } from "../../../application/ingestaoDocumental/adapters/cnpj";
import { ingerirContratoSocial } from "../../../application/ingestaoDocumental/adapters/contratoSocial";
import { parsePgdasTexto } from "../../../application/ingestaoDocumental/adapters/pgdas";
import { parseDefisTexto } from "../../../application/ingestaoDocumental/adapters/defis";
import { ingerirLoteXml } from "../../../application/ingestaoDocumental/adapters/xml";
import { ingerirEfdIcmsIpi } from "../../../application/ingestaoDocumental/adapters/efdIcmsIpi";
import { ingerirEfdContribuicoes } from "../../../application/ingestaoDocumental/adapters/efdContribuicoes";
import { ingerirEcd } from "../../../application/ingestaoDocumental/adapters/ecd";
import { ingerirEcf } from "../../../application/ingestaoDocumental/adapters/ecf";
import { ingerirResumoFolha, type ResumoFolhaEstruturado } from "../../../application/ingestaoDocumental/adapters/folha";
import { recomendarDocumentosPorRegime, type ObrigatoriedadeDocumento } from "../../../application/ingestaoDocumental/roteadorDocumental";
import { agregarDocumentosParaRascunho } from "../../../application/ingestaoDocumental/agregador";
import type { ResultadoIngestaoDocumento, TipoDocumento } from "../../../application/ingestaoDocumental/tipos";
import type { OperacaoTributariaNormalizada } from "../../../engine/operacaoTributaria";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

const ROTULO_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  cnpj: "CNPJ",
  contrato_social: "Contrato Social",
  pgdas: "PGDAS-D",
  defis: "DEFIS",
  xml_nfe: "XML (NF-e)",
  nfse: "NFS-e",
  efd_icms_ipi: "EFD ICMS/IPI",
  efd_contribuicoes: "EFD-Contribuições",
  ecd: "ECD",
  ecf: "ECF",
  folha_fs12: "Folha/FS12",
};

const ROTULO_OBRIGATORIEDADE: Record<ObrigatoriedadeDocumento, string> = {
  recomendado: "Recomendado",
  opcional: "Opcional",
  nao_aplicavel: "Não aplicável",
};

function iconeStatus(status: ResultadoIngestaoDocumento["status"] | "nao_enviado"): string {
  if (status === "processado") return "✓";
  if (status === "processado_com_ressalvas") return "⚠";
  if (status === "falhou") return "⚠";
  return "○";
}

let contadorDocumentoId = 0;
function proximoDocumentoId(prefixo: string): string {
  contadorDocumentoId += 1;
  return `${prefixo}-${contadorDocumentoId}`;
}

export function EtapaDocumentos({ rascunho, dispatch }: { rascunho: RascunhoCenarioEmpresa; dispatch: (acao: AcaoWizard) => void }) {
  const [cnpjDigitado, setCnpjDigitado] = useState("");
  const [textoContratoSocial, setTextoContratoSocial] = useState("");
  const [textoPgdas, setTextoPgdas] = useState("");
  const [textoDefis, setTextoDefis] = useState("");
  const [folha, setFolha] = useState<ResumoFolhaEstruturado>({ periodo: "" });

  const [resultados, setResultados] = useState<ResultadoIngestaoDocumento[]>([]);
  const [operacoesXml, setOperacoesXml] = useState<OperacaoTributariaNormalizada[]>([]);
  const [processando, setProcessando] = useState(false);

  const regime = rascunho.regimesSelecionados[0];
  const checklist = useMemo(() => (regime ? recomendarDocumentosPorRegime(regime) : undefined), [regime]);

  function registrarResultado(resultado: ResultadoIngestaoDocumento) {
    setResultados((atual) => [...atual.filter((r) => r.documentoId !== resultado.documentoId), resultado]);
  }

  async function aoConsultarCnpj() {
    if (!cnpjDigitado.trim()) return;
    const resultado = await ingerirCnpj(cnpjDigitado, proximoDocumentoId("cnpj"));
    registrarResultado(resultado);
  }

  function aoProcessarContratoSocial() {
    if (!textoContratoSocial.trim()) return;
    registrarResultado(ingerirContratoSocial(textoContratoSocial, proximoDocumentoId("contrato-social")));
  }

  function aoProcessarPgdas() {
    if (!textoPgdas.trim()) return;
    registrarResultado(parsePgdasTexto(textoPgdas, proximoDocumentoId("pgdas")));
  }

  function aoProcessarDefis() {
    if (!textoDefis.trim()) return;
    registrarResultado(parseDefisTexto(textoDefis, proximoDocumentoId("defis")));
  }

  function aoProcessarFolha() {
    if (!folha.periodo.trim()) return;
    registrarResultado(ingerirResumoFolha(folha, proximoDocumentoId("folha")));
  }

  async function aoReceberXml(files: FileList) {
    setProcessando(true);
    try {
      const arquivos = await decodificarArquivosXmlOuZip(Array.from(files));
      const { resultado, operacoes } = ingerirLoteXml(arquivos, proximoDocumentoId("xml"));
      registrarResultado(resultado);
      setOperacoesXml((atual) => [...atual, ...operacoes]);
    } finally {
      setProcessando(false);
    }
  }

  /** EFD ICMS/IPI, EFD-Contribuições, ECD e ECF compartilham o mesmo dropzone — o tipo real é detectado pelo próprio conteúdo (`identificarTipoArquivo`), igual ao fluxo de `/importar`, em vez de o usuário precisar classificar cada arquivo manualmente. */
  async function aoReceberSped(files: FileList) {
    setProcessando(true);
    try {
      const arquivos = await decodificarArquivosOuZip(Array.from(files));
      for (const arquivo of arquivos) {
        const tipo = identificarTipoArquivo(tokenizarSped(arquivo.conteudo));
        const documentoId = proximoDocumentoId(tipo ?? "sped-desconhecido");
        if (tipo === "efd_icms_ipi") registrarResultado(ingerirEfdIcmsIpi(arquivo.nomeArquivo, arquivo.conteudo, documentoId));
        else if (tipo === "efd_contribuicoes") registrarResultado(ingerirEfdContribuicoes(arquivo.nomeArquivo, arquivo.conteudo, documentoId));
        else if (tipo === "ecd") registrarResultado(ingerirEcd(arquivo.nomeArquivo, arquivo.conteudo, documentoId));
        else if (tipo === "ecf") registrarResultado(ingerirEcf(arquivo.nomeArquivo, arquivo.conteudo, documentoId));
      }
    } finally {
      setProcessando(false);
    }
  }

  function aoProcessarEContinuar() {
    if (resultados.length === 0) return;
    const agregado = agregarDocumentosParaRascunho(rascunho, resultados, operacoesXml);
    dispatch({ tipo: "aplicarResultadoIngestao", resultado: agregado });
    setResultados([]);
    setOperacoesXml([]);
  }

  const statusPorTipo = new Map(resultados.map((r) => [r.tipoDocumento, r.status]));
  const documentosJaAplicados = rascunho.ingestao?.documentosProcessados ?? [];

  return (
    <Card title="Documentos">
      <p>
        Importe o que for possível diretamente dos documentos — cadastro, receita histórica, dados fiscais. Esta etapa é opcional: você pode pular e preencher manualmente nas etapas
        seguintes, ou complementar depois de já ter avançado.
      </p>

      {checklist && (
        <>
          <h4>Documentos recomendados para {regime}</h4>
          <ul>
            {checklist.itens
              .filter((i) => i.obrigatoriedade !== "nao_aplicavel")
              .map((item) => (
                <li key={item.tipoDocumento}>
                  {iconeStatus(statusPorTipo.get(item.tipoDocumento) ?? "nao_enviado")} {ROTULO_TIPO_DOCUMENTO[item.tipoDocumento]} — <Badge tone={item.obrigatoriedade === "recomendado" ? "info" : "neutral"}>{ROTULO_OBRIGATORIEDADE[item.obrigatoriedade]}</Badge>
                  <span> — {item.motivo}</span>
                </li>
              ))}
          </ul>
        </>
      )}
      {!checklist && <Alert tone="info">Selecione ao menos um regime na etapa Fiscal para ver o checklist documental recomendado — a importação abaixo funciona de qualquer forma.</Alert>}

      <Field label="CNPJ" hint="Preenche cadastro (razão social, CNAE, porte, opção pelo Simples) automaticamente.">
        <Input value={cnpjDigitado} onChange={(e) => setCnpjDigitado(e.target.value)} placeholder="00.000.000/0000-00" />
        <Button variant="secondary" onClick={aoConsultarCnpj}>Consultar</Button>
      </Field>

      <Field label="Contrato Social (texto já extraído)" hint="Cole o texto do contrato — nunca inclua CPF/RG/estado civil, mas se incluir, são removidos automaticamente.">
        <textarea className="vgr-input" rows={4} value={textoContratoSocial} onChange={(e) => setTextoContratoSocial(e.target.value)} />
        <Button variant="secondary" onClick={aoProcessarContratoSocial}>Processar</Button>
      </Field>

      <Field label="PGDAS-D (texto já extraído)" hint="Fonte nativa do Simples Nacional: RBT12, receita, anexo, alíquota efetiva, DAS.">
        <textarea className="vgr-input" rows={4} value={textoPgdas} onChange={(e) => setTextoPgdas(e.target.value)} />
        <Button variant="secondary" onClick={aoProcessarPgdas}>Processar</Button>
      </Field>

      <Field label="DEFIS (texto já extraído)" hint="Complementar ao PGDAS-D — nunca o substitui.">
        <textarea className="vgr-input" rows={4} value={textoDefis} onChange={(e) => setTextoDefis(e.target.value)} />
        <Button variant="secondary" onClick={aoProcessarDefis}>Processar</Button>
      </Field>

      <FileDropzone label="XML (NF-e)" hint="Aceita .xml e .zip — deduplicado automaticamente." accept=".xml,.zip" multiple onFiles={aoReceberXml} />

      <FileDropzone label="EFD ICMS/IPI, EFD-Contribuições, ECD, ECF" hint="O tipo de cada arquivo é detectado automaticamente pelo conteúdo." accept=".txt,.zip" multiple onFiles={aoReceberSped} />

      <Field label="Resumo de folha (período)" hint="Entrada estruturada — nunca converte terceiros/autônomos em FS12, nunca sugere pró-labore.">
        <Input value={folha.periodo} onChange={(e) => setFolha({ ...folha, periodo: e.target.value })} placeholder="2026" />
        <Input type="number" placeholder="Folha bruta anual" value={folha.folhaBruta ?? ""} onChange={(e) => setFolha({ ...folha, folhaBruta: e.target.value ? Number(e.target.value) : undefined })} />
        <Input type="number" placeholder="Encargos anuais" value={folha.encargos ?? ""} onChange={(e) => setFolha({ ...folha, encargos: e.target.value ? Number(e.target.value) : undefined })} />
        <Button variant="secondary" onClick={aoProcessarFolha}>Processar</Button>
      </Field>

      {processando && <p aria-live="polite">Processando arquivos…</p>}

      {resultados.length > 0 && (
        <>
          <h4>Nesta rodada</h4>
          <ul>
            {resultados.map((r) => (
              <li key={r.documentoId}>
                {iconeStatus(r.status)} {ROTULO_TIPO_DOCUMENTO[r.tipoDocumento]} ({r.metadados.nomeArquivo})
              </li>
            ))}
          </ul>
          <Button variant="primary" onClick={aoProcessarEContinuar}>Aplicar ao cenário</Button>
        </>
      )}

      {documentosJaAplicados.length > 0 && (
        <>
          <h4>Já aplicados</h4>
          <ul>
            {documentosJaAplicados.map((d) => (
              <li key={d.documentoId}>
                {iconeStatus(d.status)} {ROTULO_TIPO_DOCUMENTO[d.tipoDocumento]} ({d.nomeArquivo})
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
