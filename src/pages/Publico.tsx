import { useEffect, useMemo, useState } from "react";
import { simular } from "../engine/calculo";
import type { Regime, AnexoSimples, MeioPagamento, SimulacaoInput, TipoOperacaoConstrucao } from "../engine/types";
import { pisCofinsAutomatico, icmsAutomatico } from "../engine/tributosAtuais";
import {
  identificarPerfilPorCnae,
  categoriasDespesaDoPerfil,
  percentualCustosCreditaveisDeDespesas,
  LABEL_PERFIL,
  type PerfilAtividade,
} from "../engine/atividades";
import { buscarDadosCnpj, CnpjLookupError, type DadosCnpj } from "../lib/cnpj";
import { CampoMoeda, CampoPercentual } from "../lib/campos";
import { TabelaDetalhamento } from "../components/TabelaDetalhamento";
import { TabelaComparativoSistemas } from "../components/TabelaComparativoSistemas";
import logoVgr from "../assets/vgr/logo-vgr.svg";
// /simulador fica fora do AppShell (é a calculadora pública), mas usa os mesmos
// tokens e componentes do resto da plataforma, por instrução explícita:
// "fora da sidebar não significa fora do Design System". Tokens/CSS já são
// carregados globalmente em main.tsx.
import {
  TaxStat,
  TaxReductionStat,
  comparativoDoResultado,
  serieCargaPorAno,
  CargaLineChart,
  Stepper,
  Field,
  Input,
  Select,
  Button,
  Alert,
  Badge,
  DetailToggle,
  formatarReais,
} from "../design-system";
import "./Publico.css";

type TipoPessoa = "PJ" | "PF";
type Etapa = "identificacao" | "despesas" | "contato" | "resultado";
type ModoAnaliseTransporte = "empresa" | "por_caminhao";

const ETAPAS = ["Identificação", "Despesas", "Contato", "Resultado"];
const INDICE_ETAPA: Record<Etapa, number> = { identificacao: 1, despesas: 2, contato: 3, resultado: 4 };

export default function Publico() {
  const [etapa, setEtapa] = useState<Etapa>("identificacao");
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PJ");

  // PJ
  const [cnpj, setCnpj] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);
  const [dadosCnpj, setDadosCnpj] = useState<DadosCnpj | null>(null);
  const [perfil, setPerfil] = useState<PerfilAtividade | null>(null);
  const [tipoAviacao, setTipoAviacao] = useState<"convencional" | "drone">("convencional");
  const [tipoOperacaoConstrucao, setTipoOperacaoConstrucao] = useState<TipoOperacaoConstrucao>("empreitada");

  // PF (produtor rural pessoa física)
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [municipioFazenda, setMunicipioFazenda] = useState("");
  const [ufFazenda, setUfFazenda] = useState("");
  const [registroCarNirf, setRegistroCarNirf] = useState("");

  // dados comuns
  const [regimeAtual, setRegimeAtual] = useState<Regime>("simples_unificado");
  const [anexoSimples, setAnexoSimples] = useState<AnexoSimples>("anexoIII");
  const [faturamentoAnual, setFaturamentoAnual] = useState(1_000_000);
  const [pisCofinsPercentual, setPisCofinsPercentual] = useState(3.65);
  const [icmsIpiPercentual, setIcmsIpiPercentual] = useState(2.5);
  const [pisCofinsManual, setPisCofinsManual] = useState(false);
  const [icmsManual, setIcmsManual] = useState(false);
  const [percentualClienteContribuinte, setPercentualClienteContribuinte] = useState(70);
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>("pix");
  const [despesas, setDespesas] = useState<Record<string, number>>({});

  // transporte rodoviário de cargas: empresa como um todo x por caminhão
  const [modoAnaliseTransporte, setModoAnaliseTransporte] = useState<ModoAnaliseTransporte>("empresa");
  const [quantidadeCaminhoes, setQuantidadeCaminhoes] = useState(1);

  // contato / lead
  const [nomeContato, setNomeContato] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [leadErro, setLeadErro] = useState(false);

  const categorias = perfil ? categoriasDespesaDoPerfil(perfil) : [];

  function reiniciarSimulacao() {
    setEtapa("identificacao");
    setTipoPessoa("PJ");
    setCnpj("");
    setBuscandoCnpj(false);
    setErroCnpj(null);
    setDadosCnpj(null);
    setPerfil(null);
    setTipoAviacao("convencional");
    setTipoOperacaoConstrucao("empreitada");
    setNomeCompleto("");
    setCpf("");
    setMunicipioFazenda("");
    setUfFazenda("");
    setRegistroCarNirf("");
    setRegimeAtual("simples_unificado");
    setAnexoSimples("anexoIII");
    setFaturamentoAnual(1_000_000);
    setPisCofinsPercentual(3.65);
    setIcmsIpiPercentual(2.5);
    setPisCofinsManual(false);
    setIcmsManual(false);
    setPercentualClienteContribuinte(70);
    setMeioPagamento("pix");
    setDespesas({});
    setModoAnaliseTransporte("empresa");
    setQuantidadeCaminhoes(1);
    setNomeContato("");
    setEmail("");
    setTelefone("");
    setEnviandoLead(false);
    setLeadEnviado(false);
  }

  async function handleBuscarCnpj() {
    setErroCnpj(null);
    setBuscandoCnpj(true);
    try {
      const dados = await buscarDadosCnpj(cnpj);
      setDadosCnpj(dados);
      const perfilIdentificado = identificarPerfilPorCnae(dados.cnaePrincipalCodigo);
      setPerfil(perfilIdentificado);
      if (!perfilIdentificado) {
        setErroCnpj(
          `O CNAE principal dessa empresa ainda não é coberto por este simulador (setores atuais: ${Object.values(LABEL_PERFIL).join(", ")}). Fale com a VGR para uma análise personalizada.`
        );
      }
    } catch (e) {
      setErroCnpj(e instanceof CnpjLookupError ? e.message : "Erro inesperado ao consultar o CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  function selecionarPerfilManualPF() {
    setPerfil("produtor_rural");
  }

  const ufAtual = tipoPessoa === "PJ" ? dadosCnpj?.uf ?? "" : ufFazenda;
  const isSimples = regimeAtual === "simples_unificado" || regimeAtual === "simples_hibrido";

  useEffect(() => {
    if (pisCofinsManual) return;
    const sugestao = pisCofinsAutomatico(regimeAtual, anexoSimples);
    setPisCofinsPercentual(Number((sugestao.aliquota * 100).toFixed(4)));
  }, [regimeAtual, anexoSimples, pisCofinsManual]);

  const icmsSugerido = perfil ? icmsAutomatico(ufAtual, perfil) : null;

  useEffect(() => {
    if (icmsManual || !ufAtual || !perfil) return;
    const sugestao = icmsAutomatico(ufAtual, perfil);
    setIcmsIpiPercentual(Number((sugestao.aliquota * 100).toFixed(4)));
  }, [ufAtual, perfil, icmsManual]);

  const input: SimulacaoInput = useMemo(
    () => ({
      nomeEmpresa: tipoPessoa === "PJ" ? dadosCnpj?.razaoSocial ?? "" : nomeCompleto,
      ...(perfil ? { perfil } : {}),
      ...(perfil === "aviacao_agricola" ? { tipoAviacao } : {}),
      ...(perfil === "construcao_civil" ? { tipoOperacaoConstrucao } : {}),
      ...(isSimples ? { anexoSimples } : {}),
      regimeAtual,
      faturamentoAnual,
      pisCofinsPercentualAtual: pisCofinsPercentual / 100,
      icmsIpiPercentualAtual: icmsIpiPercentual / 100,
      percentualCustosCreditaveis: percentualCustosCreditaveisDeDespesas(despesas, faturamentoAnual),
      perfilClientes: {
        percentualClienteContribuinte: percentualClienteContribuinte / 100,
        percentualClienteNaoContribuinte: 1 - percentualClienteContribuinte / 100,
      },
      meioPagamentoPredominante: meioPagamento,
    }),
    [tipoPessoa, dadosCnpj, nomeCompleto, perfil, tipoAviacao, tipoOperacaoConstrucao, isSimples, anexoSimples, regimeAtual, faturamentoAnual, pisCofinsPercentual, icmsIpiPercentual, despesas, percentualClienteContribuinte, meioPagamento]
  );

  const resultado = useMemo(() => simular(input), [input]);
  const anoPleno = resultado.anos[resultado.anos.length - 1];
  const { comparativo: comparativoPublico } = comparativoDoResultado(resultado, faturamentoAnual);
  const serieCarga = serieCargaPorAno(resultado, faturamentoAnual);
  const observacoesUnicas = useMemo(
    () => Array.from(new Set(resultado.anos.flatMap((a) => a.observacoes))),
    [resultado]
  );

  async function enviarLead() {
    setEnviandoLead(true);
    setLeadErro(false);
    try {
      const resposta = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeContato,
          email,
          telefone,
          tipoPessoa,
          cnpjOuCpf: tipoPessoa === "PJ" ? cnpj : cpf,
          perfilAtividade: perfil,
          regimeAtual,
          faturamentoAnual,
          cargaProjetada2033: anoPleno.cargaNovaPropriaEmpresa,
          deltaCargaPercentual2033: anoPleno.deltaCargaPercentual,
        }),
      });
      // P0.4: fetch só rejeita em falha de rede — um erro HTTP (5xx/4xx) resolve
      // normalmente, então sem checar `.ok` a mensagem de sucesso aparecia mesmo
      // quando o lead NUNCA chegou a ser salvo no servidor.
      if (!resposta.ok) throw new Error(`Falha ao enviar lead: HTTP ${resposta.status}`);
      setLeadEnviado(true);
    } catch {
      // A captação de lead não deve bloquear a exibição do resultado ao usuário
      // (por isso segue para "resultado" mesmo em erro), mas a mensagem exibida
      // tem que refletir a realidade — nunca dizer "recebemos seus dados" se o
      // envio de fato falhou.
      setLeadErro(true);
    } finally {
      setEnviandoLead(false);
      setEtapa("resultado");
    }
  }

  const reducaoPublico = comparativoPublico.deltaPontosPercentuais >= 0;

  return (
    <div className="publico-root">
      <header className="publico-header">
        <img src={logoVgr} alt="VGR Gestão Contábil e Controladoria" className="logo-vgr" />
        <h1>Simulador rápido — Impactos da Reforma Tributária</h1>
        <p>Setores atendidos: {Object.values(LABEL_PERFIL).join(", ")}. Estimativa gerencial em poucos passos.</p>
      </header>

      <main className="publico-card">
        <Stepper labels={ETAPAS} currentStep={INDICE_ETAPA[etapa]} />

        {etapa === "identificacao" && (
          <section>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Button variant={tipoPessoa === "PJ" ? "primary" : "secondary"} onClick={() => setTipoPessoa("PJ")}>Empresa (CNPJ)</Button>
              <Button variant={tipoPessoa === "PF" ? "primary" : "secondary"} onClick={() => setTipoPessoa("PF")}>Produtor rural — pessoa física (CPF)</Button>
            </div>

            {tipoPessoa === "PJ" && (
              <div>
                <Field label="CNPJ">
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                </Field>
                <Button variant="secondary" onClick={handleBuscarCnpj} disabled={buscandoCnpj || cnpj.replace(/\D/g, "").length !== 14}>
                  {buscandoCnpj ? "Buscando..." : "Buscar dados na Receita Federal"}
                </Button>
                {erroCnpj && <div style={{ marginTop: 12 }}><Alert tone="danger">{erroCnpj}</Alert></div>}
                {dadosCnpj && perfil && (
                  <div className="vgr-card" style={{ marginTop: 14 }}>
                    <p style={{ margin: "0 0 4px" }}><strong>{dadosCnpj.razaoSocial}</strong> — {dadosCnpj.municipio}/{dadosCnpj.uf}</p>
                    <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: "0 0 4px" }}>CNAE: {dadosCnpj.cnaePrincipalCodigo} — {dadosCnpj.cnaePrincipalDescricao}</p>
                    <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: "0 0 10px" }}>Perfil identificado: {LABEL_PERFIL[perfil]}</p>
                    {perfil === "aviacao_agricola" && (
                      <Field label="Tipo de operação">
                        <Select value={tipoAviacao} onChange={(e) => setTipoAviacao(e.target.value as "convencional" | "drone")}>
                          <option value="convencional">Aeronave convencional</option>
                          <option value="drone">Drone</option>
                        </Select>
                      </Field>
                    )}
                    {perfil === "construcao_civil" && (
                      <Field label="Tipo de operação">
                        <Select
                          value={tipoOperacaoConstrucao}
                          onChange={(e) => setTipoOperacaoConstrucao(e.target.value as TipoOperacaoConstrucao)}
                        >
                          <option value="empreitada">Empreitada (execução de obra/serviço)</option>
                          <option value="incorporacao">Incorporação / venda de imóvel</option>
                          <option value="locacao">Locação de imóvel</option>
                        </Select>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {tipoPessoa === "PF" && (
              <div>
                <Field label="Nome completo"><Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} /></Field>
                <Field label="CPF"><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></Field>
                <Field label="Município da propriedade"><Input value={municipioFazenda} onChange={(e) => setMunicipioFazenda(e.target.value)} /></Field>
                <Field label="UF"><Input value={ufFazenda} onChange={(e) => setUfFazenda(e.target.value)} maxLength={2} /></Field>
                <Field label="Registro CAR ou NIRF (opcional)"><Input value={registroCarNirf} onChange={(e) => setRegistroCarNirf(e.target.value)} /></Field>
                <Button variant="primary" onClick={selecionarPerfilManualPF}>Continuar como produtor rural</Button>
              </div>
            )}

            {perfil && (
              <div style={{ marginTop: 8 }}>
                {perfil === "transporte_rodoviario_cargas" && (
                  <>
                    <div style={{ fontSize: 12.5, fontWeight: 650, marginBottom: 8 }}>Simular</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <Button
                        variant={modoAnaliseTransporte === "empresa" ? "primary" : "secondary"}
                        onClick={() => setModoAnaliseTransporte("empresa")}
                      >
                        Empresa (frota toda)
                      </Button>
                      <Button
                        variant={modoAnaliseTransporte === "por_caminhao" ? "primary" : "secondary"}
                        onClick={() => setModoAnaliseTransporte("por_caminhao")}
                      >
                        Por caminhão
                      </Button>
                    </div>
                    {modoAnaliseTransporte === "por_caminhao" && (
                      <Field label="Quantidade de caminhões (frota)">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={quantidadeCaminhoes}
                          onChange={(e) => setQuantidadeCaminhoes(Math.max(1, Number(e.target.value)))}
                        />
                      </Field>
                    )}
                  </>
                )}
                <Field label="Regime tributário atual">
                  <Select value={regimeAtual} onChange={(e) => setRegimeAtual(e.target.value as Regime)}>
                    <option value="simples_unificado">Simples Nacional — unificado</option>
                    <option value="simples_hibrido">Simples Nacional — híbrido</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="lucro_real">Lucro Real</option>
                  </Select>
                </Field>
                {isSimples && (
                  <Field label="Anexo do Simples Nacional">
                    <Select value={anexoSimples} onChange={(e) => setAnexoSimples(e.target.value as AnexoSimples)}>
                      <option value="anexoIII">Anexo III</option>
                      <option value="anexoV">Anexo V</option>
                    </Select>
                  </Field>
                )}
                <CampoMoeda
                  label={
                    perfil === "transporte_rodoviario_cargas" && modoAnaliseTransporte === "por_caminhao"
                      ? "Faturamento anual da frota toda (R$)"
                      : "Faturamento anual (R$)"
                  }
                  value={faturamentoAnual}
                  onChange={setFaturamentoAnual}
                />
                <CampoPercentual
                  label="PIS/COFINS atual (% do faturamento)"
                  value={pisCofinsPercentual}
                  onChange={(v) => {
                    setPisCofinsPercentual(v);
                    setPisCofinsManual(true);
                  }}
                />
                <p className="vgr-field-hint">
                  {pisCofinsManual
                    ? <>Valor ajustado manualmente. <Button variant="tertiary" onClick={() => setPisCofinsManual(false)}>Usar automático</Button></>
                    : "Preenchido automaticamente conforme o regime tributário."}
                </p>
                <CampoPercentual
                  label={`ICMS/IPI atual (% do faturamento)${ufAtual ? ` — ref. ${ufAtual.toUpperCase()}` : ""}`}
                  value={icmsIpiPercentual}
                  onChange={(v) => {
                    setIcmsIpiPercentual(v);
                    setIcmsManual(true);
                  }}
                  erro={
                    pisCofinsPercentual + icmsIpiPercentual <= 0
                      ? "A soma de PIS/COFINS e ICMS/IPI é a base de comparação para calcular a variação — não pode ser zero."
                      : undefined
                  }
                />
                <p className="vgr-field-hint">
                  {icmsManual ? (
                    <>Valor ajustado manualmente. <Button variant="tertiary" onClick={() => setIcmsManual(false)}>Usar automático</Button></>
                  ) : ufAtual ? (
                    "Preenchido automaticamente conforme a UF — confirme sempre com sua contabilidade."
                  ) : (
                    "Informe a UF para pré-preencher automaticamente."
                  )}
                </p>
                {icmsSugerido && <Alert tone="warn">⚠ {icmsSugerido.observacao}</Alert>}
                <div style={{ marginTop: 16 }}>
                  <CampoPercentual
                    label="% de clientes contribuintes de IBS/CBS"
                    value={percentualClienteContribuinte}
                    onChange={setPercentualClienteContribuinte}
                  />
                </div>
                <Field label="Meio de pagamento predominante">
                  <Select value={meioPagamento} onChange={(e) => setMeioPagamento(e.target.value as MeioPagamento)}>
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto</option>
                    <option value="ted">TED / transferência</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                  </Select>
                </Field>
                <Button
                  variant="primary"
                  disabled={faturamentoAnual <= 0 || pisCofinsPercentual + icmsIpiPercentual <= 0}
                  onClick={() => setEtapa("despesas")}
                >
                  Próximo: detalhar despesas →
                </Button>
              </div>
            )}
          </section>
        )}

        {etapa === "despesas" && perfil && (
          <section>
            <h2 style={{ fontSize: 15 }}>Despesas típicas da atividade identificada</h2>
            <p className="vgr-lede">Preencha o que se aplicar — o que ficar em branco entra como zero.</p>
            {categorias.map((c) => (
              <CampoMoeda
                key={c.chave}
                label={c.label}
                value={despesas[c.chave] ?? 0}
                onChange={(v) => setDespesas({ ...despesas, [c.chave]: v })}
              />
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <Button variant="secondary" onClick={() => setEtapa("identificacao")}>← Voltar</Button>
              <Button variant="primary" onClick={() => setEtapa("contato")}>Ver resultado →</Button>
            </div>
          </section>
        )}

        {etapa === "contato" && (
          <section>
            <h2 style={{ fontSize: 15 }}>Para onde enviamos o seu resultado?</h2>
            <p className="vgr-lede">
              Preenchendo seus dados, um especialista da VGR pode te ajudar a interpretar o cenário — sem compromisso.
            </p>
            <Field label="Nome"><Input value={nomeContato} onChange={(e) => setNomeContato(e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Telefone/WhatsApp"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <Button variant="secondary" onClick={() => setEtapa("despesas")}>← Voltar</Button>
              <Button variant="primary" disabled={!nomeContato || !email || enviandoLead} onClick={enviarLead}>
                {enviandoLead ? "Enviando..." : "Ver meu resultado →"}
              </Button>
            </div>
          </section>
        )}

        {etapa === "resultado" && (
          <section>
            {leadEnviado && <Alert tone="info">✓ Recebemos seus dados — a equipe VGR pode entrar em contato.</Alert>}
            {leadErro && (
              <Alert tone="warn">
                Não conseguimos registrar seus dados de contato agora (seu resultado abaixo continua válido). Se
                quiser garantir o contato da equipe VGR, envie um e-mail ou WhatsApp diretamente.
              </Alert>
            )}

            <div style={{ marginTop: 12 }}>
              <Badge tone={reducaoPublico ? "accent" : "danger"}>{reducaoPublico ? "💡 Oportunidade identificada" : "▲ Atenção"}</Badge>
            </div>
            <div style={{ marginTop: 10 }}>
              <TaxReductionStat comparativo={comparativoPublico} tone={reducaoPublico ? "good" : "bad"} size="lg" />
            </div>

            <div className="vgr-kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 20 }}>
              <div className="vgr-kpi static">
                <span className="vgr-kpi-label">Carga hoje (referência)</span>
                <TaxStat percent={comparativoPublico.cargaAtual} reais={resultado.anos[0].cargaAtualReferencia} tone="bad" />
              </div>
              <div className="vgr-kpi static">
                <span className="vgr-kpi-label">Carga projetada em {anoPleno.ano}</span>
                <TaxStat percent={comparativoPublico.cargaProjetada} reais={anoPleno.cargaNovaPropriaEmpresa} tone="good" />
              </div>
            </div>

            {perfil === "transporte_rodoviario_cargas" && modoAnaliseTransporte === "por_caminhao" && quantidadeCaminhoes > 0 && (
              <div className="vgr-kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 12 }}>
                <div className="vgr-kpi static">
                  <span className="vgr-kpi-label">Carga hoje por caminhão ({quantidadeCaminhoes} na frota)</span>
                  <span className="vgr-tstat"><span className="vgr-tstat-pct tab">{formatarReais(resultado.anos[0].cargaAtualReferencia / quantidadeCaminhoes)}</span></span>
                </div>
                <div className="vgr-kpi static">
                  <span className="vgr-kpi-label">Carga projetada em {anoPleno.ano} por caminhão</span>
                  <span className="vgr-tstat"><span className="vgr-tstat-pct tab">{formatarReais(anoPleno.cargaNovaPropriaEmpresa / quantidadeCaminhoes)}</span></span>
                </div>
              </div>
            )}

            <div className="vgr-section-title">Evolução da carga tributária</div>
            <div className="vgr-chart-container">
              <CargaLineChart dados={serieCarga} />
            </div>

            <div className="vgr-card" style={{ marginTop: 16 }}>
              <p style={{ margin: 0, fontSize: 13 }}>{resultado.recomendacao}</p>
            </div>

            {(observacoesUnicas.length > 0 || resultado.avisos.length > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {observacoesUnicas.map((o, i) => (
                  <Alert key={`o${i}`} tone="warn">⚠ {o}</Alert>
                ))}
                {resultado.avisos.map((a, i) => (
                  <Alert key={`a${i}`} tone="warn">⚠ {a}</Alert>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <DetailToggle label="Ver detalhamento tributário (débito, crédito, CBS/IBS por ano)">
                <TabelaDetalhamento anos={resultado.anos} faturamentoAnual={faturamentoAnual} />
                <h4 style={{ fontSize: 12.5 }}>Sistema antigo × sistema novo</h4>
                <TabelaComparativoSistemas anos={resultado.anos} faturamentoAnual={faturamentoAnual} />
              </DetailToggle>
            </div>

            <p style={{ fontSize: 13, marginTop: 20 }}>
              Quer uma análise completa com seus documentos fiscais? <a href="mailto:contato@vgr.cnt.br">Fale com a VGR</a>.
            </p>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={reiniciarSimulacao}>Nova simulação</Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
