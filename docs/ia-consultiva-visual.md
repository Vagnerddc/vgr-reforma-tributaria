# IA Consultiva Visual

> Continuação de [caixa-timeline-pontos-virada.md](./caixa-timeline-pontos-virada.md).
> Integra visualmente o módulo `engine/iaConsultiva/` já existente —
> **nenhuma IA nova, nenhum recálculo, nenhum segredo no frontend.**
> 681 testes passando (663 + 18 novos), `tsc -b` e `vite build` limpos.
> Princípio: "A análise precisa continuar verdadeira sem IA. A IA
> existe para tornar essa verdade mais compreensível."

## A. Objetivo da IA Consultiva Visual

Permitir que o usuário solicite, sob demanda, uma leitura em 3 níveis
(Executiva/Consultiva/Técnica) da decisão já produzida pelos motores —
nunca uma nova conclusão, nunca uma segunda camada decisória.

## B. Fronteira arquitetural

```
AnaliseEstrategicaCompleta (application/analiseEstrategica)
      ↓
application/iaConsultiva/motor.ts::gerarExplicacaoDaAnalise
      ↓ (extrai .decisao, delega)
engine/iaConsultiva/motor.ts::gerarTresNiveis (intocado)
      ↓
engine/iaConsultiva/contexto.ts::construirContexto (intocado, reaproveitado)
      ↓
guardrails (intocado)
      ↓
RespostaIaConsultiva
      ↓
presentation/viewModels/iaConsultiva.ts (resolve IDs, mapeia status visual)
      ↓
SecaoIaConsultiva.tsx
```

`application/iaConsultiva/motor.ts` é uma camada FINA: só extrai
`decisao` de `AnaliseEstrategicaCompleta` e chama `gerarTresNiveis`
já existente — nenhuma linha de guardrail, prompt ou lógica de IA foi
duplicada ou recriada.

## C. Geração sob demanda

`SecaoIaConsultiva` nunca chama `gerarExplicacaoDaAnalise` no
`useEffect`/render — só dentro do handler `onClick` do botão "Gerar
explicação". Abrir `/analises/estrategica` nunca dispara uma
requisição a provedor externo.

## D. Contexto enviado

`construirContexto` (engine, intocado) já reduz a análise a um
`ContextoIaConsultiva` compacto — evidências com valor estruturado,
condições, bloqueios, riscos, qualidade. A camada de aplicação só
adiciona a chamada, nunca amplia o que é enviado.

## E. Política de dados

`gerarExplicacaoDaAnalise` usa `POLITICA_DADOS_PADRAO` (engine, já
existente) quando nenhuma política é passada — `permitirIdentificacaoEmpresa:
false` por padrão, então o nome da empresa nunca é enviado sem
configuração explícita. Nenhuma UI de consentimento fake foi criada:
a política já é restritiva por padrão.

## F. Estados de geração

`StatusVisualIa`: `nao_gerada` (antes do clique) → `carregando` →
`gerada`/`fallback`/`rejeitada`/`erro_provedor`/`indisponivel` (mapeados
1:1 de `StatusGeracao`, já existente). `fallback`/`rejeitada`/`erro_provedor`/
`indisponivel` **nunca** aparecem como "ERRO IA" na leitura padrão — o
conteúdo do fallback é exibido normalmente; só o modo Técnico expõe o
status real via `metadadosTecnicos`.

## G. Executiva / Consultiva / Técnica

Os 3 níveis vêm de UMA chamada (`gerarTresNiveis`, preferência A da
instrução) — nunca 3 análises independentes. Trocar de aba só troca
qual `RespostaIaConsultiva` já obtida é exibida — nenhuma nova
chamada, nenhuma alteração de domínio (testado: seção 83).

## H. Guardrails

Preservados integralmente — `SecaoIaConsultiva` nunca renderiza
`RespostaBrutaIa`, só `RespostaIaConsultiva` (já validada). Testado
com um provedor malicioso (número inventado + alternativa trocada +
qualidade promovida simultaneamente): o ViewModel reflete o fallback,
o texto malicioso nunca aparece.

## I. Fallback

Quando não há provedor configurado (caso real desta aplicação — nenhum
backend de IA existe ainda), `gerarExplicacaoConsultiva` já produz o
fallback determinístico (`templatesFallback.ts`, engine, intocado). A
seção exibe esse conteúdo normalmente, com um badge discreto
("Leitura consultiva da análise") — nunca um aviso alarmante.

## J. Integração com `/analises/estrategica`

Posição: Visão Geral → Por quê → **IA Consultiva** → Comparação de
Regimes → Caixa → Timeline → Pontos de Virada → Score → Plano → Pareto.
Os 8 blocos anteriores continuam renderizando exatamente como antes —
`SecaoIaConsultiva` é aditiva, sem nenhuma dependência dos blocos
seguintes.

## K. Privacidade

Nenhuma identificação de empresa é enviada por padrão (seção E).
Nenhum dado bruto de SPED/ECD/ECF/folha é enviado — o contexto só
contém o que `construirContexto` já produz (agregados/evidências).

## L. Segurança

**Nenhum segredo no frontend.** Nenhuma variável `VITE_*_API_KEY` foi
criada. `ProvedorIaConsultiva` permanece uma interface — esta
aplicação não instancia nenhum provedor real (não há backend seguro
disponível ainda), então toda chamada cai no fallback determinístico,
que é 100% local e determinístico. Quando um backend existir, basta
injetar um `ProvedorIaConsultiva` que chama esse backend — a página
não muda.

## M. Responsividade

`Tabs` (design system, já responsivo) para a troca de nível; todo o
conteúdo usa os mesmos primitivos (`Card`, `Alert`, `DetailToggle`,
`Skeleton`) já validados em telas estreitas nas fases anteriores.
Nenhum CSS novo.

## N. Testes

18 testes novos: `application/iaConsultiva/__tests__/motor.test.ts`
(fallback sem provedor, decisão ausente, erro de provedor isolado,
`contextHash` estável/sensível a mudança) e
`presentation/__tests__/iaConsultiva.test.ts` (linguagem absoluta
ausente em preferência robusta, condição preservada em condicionada,
conflito sem vencedor, obrigação sem linguagem de preferência, dados
insuficientes explica a lacuna, equivalência sem escolha, guardrail
end-to-end contra provedor malicioso — número/alternativa/qualidade
inventados nunca chegam ao ViewModel —, Fator R nunca vira pró-labore,
preço nunca vira ordem, 3 níveis sem alterar o domínio, fallback nunca
tratado como erro na leitura padrão mas exposto no modo técnico,
IDs de evidência sempre resolvidos em texto).

## O. Limitações conhecidas

1. **Nenhum provedor real está configurado nesta aplicação** — não há
   backend de IA disponível; a experiência sempre usa o fallback
   determinístico. Isso é esperado e documentado (seção 54 do
   pedido): "a aplicação continua funcional".
2. **Cache limitado ao estado do componente** — `resultado` fica em
   `useState` local; navegar para fora da página e voltar exige gerar
   de novo. Nenhuma persistência entre sessões foi criada (seção 45:
   "não criar persistência complexa").
3. **`textoTecnico` só é exibido quando o provedor/fallback o
   preenche** — o fallback determinístico atual não popula esse
   campo; fica disponível para quando um provedor real o preencher.
4. **Sem campo de prompt livre** — conforme instruído, não existe
   "pergunte à IA" nesta fase.

## Próximas etapas

Memória Técnica, Modo Apresentação, revisão do Wizard — nesta ordem,
conforme já planejado.
