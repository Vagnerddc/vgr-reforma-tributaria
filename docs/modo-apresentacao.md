# Modo Apresentação Executivo

> Continuação de [ia-consultiva-visual.md](./ia-consultiva-visual.md).
> **Nenhum novo motor, nenhum recálculo, nenhum segredo.** 695 testes
> passando (681 + 14 novos), `tsc -b` e `vite build` limpos. Princípio:
> "O modo normal serve para analisar. O Modo Apresentação serve para
> comunicar." Nenhuma regra nova nasce aqui — só narrativa sobre dados
> já produzidos.

## A. Objetivo

Permitir que o consultor apresente `/analises/estrategica` numa reunião
como uma sequência de capítulos, sem abrir mão da fidelidade aos
resultados determinísticos.

## B. Relação com a análise normal

```
AnaliseEstrategicaCompleta
      ↓
PaginaAnaliseEstrategicaViewModel (já existente)
      ↓
ApresentacaoExecutivaViewModel (novo — só seleciona referências)
      ↓
ModoApresentacao (novo — narrativa em capítulos)
```

`construirApresentacaoExecutivaViewModel` NUNCA lê `AnaliseEstrategicaCompleta`
diretamente — recebe o `PaginaAnaliseEstrategicaViewModel` já construído
pela rota normal, evitando um segundo pipeline (seção 1/8).

## C. ViewModel

`ApresentacaoExecutivaViewModel { nomeEmpresa, ano, capitulos[],
vm (referência ao ViewModel da página), ia?, limitacoesMateriais[] }`.
`capitulos` é a única coisa calculada aqui — uma lista DINÂMICA
(seção 11/49-51): cada capítulo só existe se há dado real (ou
indisponibilidade materialmente relevante, caso do Caixa) para
mostrar.

## D. Capítulos

`impacto`, `decisao`, `evidencias` ("Por quê?"), `regimes`, `caixa`
(sempre presente — indisponibilidade também é informação executiva),
`timeline` (só se `incluirHorizonte` foi solicitado na análise),
`pontosVirada`, `score`, `plano`, `pareto`, `ia` (só se já gerada),
`limitacoes` (só se houver limitação material coletada). Testado:
seção 89 (sem Score/Pareto configurados, os capítulos correspondentes
não existem) e seção 103 (contagem varia de fato entre uma análise
mínima e uma completa).

## E. Navegação

`ModoApresentacao` reaproveita a MESMA lista `capitulos` para montar
`← Anterior`/`X de N`/`Próximo →`. A aritmética de índice
(`indiceProximo`/`indiceAnterior`/`indiceValido`, `navegacao.ts`) é
pura e testada isoladamente, sem DOM — trocar de capítulo nunca chama
motor/IA (seção 66/67/100, garantido estruturalmente: os componentes
de cada capítulo só leem o `ViewModel` já pronto).

Teclado: `ArrowRight`/`ArrowLeft`/`Escape` (seção 43/44/102). Tela
cheia: `Fullscreen API` com feature detection (`suportaFullscreen()`) —
nunca obrigatória, funciona normalmente sem ela (seção 45-47).

## F. Tratamento dos status de decisão

O capítulo `decisao` reaproveita `CardDecisaoEstrategica` (já
existente, fase da Consolidação da Experiência Executiva) sem
alteração — os 7 estados (robusta/condicionada/conflito/equivalentes/
dados_insuficientes/bloqueado/sem_conclusao) já tratados lá continuam
válidos aqui. Testado explicitamente na apresentação: condição nunca
desaparece (seção 90), conflito nunca declara vencedor (seção 91),
obrigação jurídica nunca usa "melhor regime" (seção 92).

## G. Caixa

Capítulo `caixa` reaproveita `SecaoImpactoCaixa` — indisponibilidade
nunca vira R$ 0 (testado: seção 93).

## H. Timeline

Capítulo `timeline` reaproveita `TimelineEstrategica` — mudanças
discretas (ex.: 2029→2030) continuam representadas como eventos, nunca
suavizadas, porque o componente é o MESMO já testado na fase anterior.

## I. Pontos de Virada

Capítulo `pontosVirada` reaproveita `SecaoPontosVirada` — nunca virou
previsão (mesma garantia da fase anterior, reaproveitada sem alteração).

## J. Score

Capítulo `score` reaproveita `SecaoScoreEstrategico` — perfil
dimensional, sem destaque exagerado ao consolidado. `ApresentacaoExecutivaViewModel`
não possui nenhum campo que combine score com decisão (testado:
seção 96/97 — ausência estrutural de `melhorAlternativa`/`rankingPareto`).

## K. Plano

Capítulo `plano` reaproveita `SecaoPlanoAcao` — bloqueios/motivos
preservados sem alteração.

## L. Pareto

Capítulo `pareto` reaproveita `SecaoParetoFronteira` — sem numeração
1º/2º/3º, herdado da fase de Otimização Multidimensional.

## M. IA Consultiva

Capítulo `ia` só existe quando uma explicação JÁ foi gerada pelo
usuário na tela normal (`SecaoIaConsultiva` chama
`onResultadoGerado`, que a página guarda em estado e passa para
`construirApresentacaoExecutivaViewModel`) — entrar/navegar no Modo
Apresentação NUNCA dispara uma chamada de IA (seção 3/40/75, testado:
seção 98/99). A apresentação sempre usa o nível `consultiva`.

## N. Responsividade

Layout full-bleed com tipografia em `clamp()` (KPIs, headlines) para
telas de projetor (1366×768/1920×1080); grids com `auto-fit` empilham
naturalmente em tablet/mobile; `main` com `overflow-y: auto` evita
travar em conteúdo mais longo. `prefers-reduced-motion` respeitado
(nenhuma transição/animação quando o usuário pede menos movimento).

## O. Acessibilidade

`role="region"`/`aria-label` no container; `h2` do capítulo recebe
foco automático (`tabIndex={-1}` + `.focus()`) a cada navegação —
essencial para leitores de tela acompanharem a troca; `aria-live="polite"`
no `main`; `aria-label` em todos os botões de navegação; `aria-current`
no indicador de progresso.

## P. Limitações conhecidas

1. **Deep link por capítulo é só o índice inicial** (`?modo=apresentacao&secao=N`)
   — a URL não é atualizada automaticamente enquanto o usuário navega
   dentro do Modo Apresentação (seção 68: "não é obrigatório"); ao
   sair, os parâmetros são limpos.
2. **Sem impressão/PDF** — fora de escopo desta fase, conforme
   instruído.
3. **Conteúdo dos capítulos reaproveita os componentes de seção
   existentes (`Card`) em vez de versões "slide" bespoke** — decisão
   deliberada para não duplicar código; o contraste em fundo escuro é
   ajustado via CSS (`.vgr-apresentacao .vgr-card`), mas a densidade
   visual de alguns componentes (ex.: tabela de comparação) não foi
   redesenhada especificamente para "reunião" — funcional, não
   maximamente otimizada para auditório.
4. **`textoTecnico`/metadados técnicos da IA nunca aparecem na
   apresentação** — por design (seção 17/48): a apresentação só usa o
   nível `consultiva`.
5. **Sem testes de renderização** (mesma limitação já documentada nas
   fases anteriores — ausência de `@testing-library`/jsdom no
   projeto); a cobertura desta fase é sobre o ViewModel e a lógica
   pura de navegação.

## Próximas etapas

Revisão do Wizard e, só depois, avaliação de migração do pipeline
legado — nesta ordem, conforme já planejado.
