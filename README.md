# Simulador de Impactos da Reforma Tributária (VGR)

Ferramenta gerencial (não fiscal) para comparar, ano a ano (2026–2033), o efeito
da Reforma Tributária (EC 132/2023 + LC 214/2025) sobre a carga tributária de
empresas, nos regimes Simples Nacional (unificado x híbrido), Lucro Presumido
e Lucro Real.

**Simulador multi-setor e extensível**: não é uma ferramenta fechada para um
único ramo — cada setor de atividade entra como uma nova entrada de
configuração (`config/atividades.json`), sem exigir reescrever o motor de
cálculo ou a interface. Setores cobertos hoje (ver `LABEL_PERFIL` em
`src/engine/atividades.ts` para a lista sempre atualizada):
- Aviação agrícola (convencional e drone)
- Produtor rural (PJ e PF)
- Transporte rodoviário de cargas
- Construção civil (empreitada, incorporação/venda e locação de imóvel —
  com a redução de alíquota do regime de bens imóveis, LC 214/2025 arts. 251-271)

**Isto é uma simulação gerencial. Não substitui apuração fiscal formal nem
parecer técnico definitivo do contador responsável.**

## Três frentes, um único motor de cálculo

- **`/` — Interno (clientes da VGR)**: formulário detalhado para o contador,
  pensado para ser usado com o cliente ao lado, com seletor de setor de
  atividade, comparação lado a lado de regimes e exportação de relatório.
- **`/importar` — Importação de SPED**: importa EFD ICMS/IPI, EFD
  Contribuições e ECD do cliente (processado 100% no navegador), apura a
  carga tributária atual, mapeia quais fornecedores/clientes geram crédito de
  CBS/IBS, gera um panorama de riscos/oportunidades e projeta 2027 a partir do
  movimento real. Ver [`docs/importacao-sped.md`](docs/importacao-sped.md)
  para o que é extraído de cada arquivo e as limitações conhecidas.
- **`/simulador` — Público (site da VGR)**: fluxo rápido de captação de lead —
  busca automática de CNPJ/CNAE na Receita Federal, identifica o setor de
  atividade automaticamente pelo CNAE, abre os campos de despesa pertinentes
  àquele setor, e captura contato antes de exibir o resultado.

As três consomem o mesmo `src/engine/` — a lógica de cálculo nunca é
duplicada entre as experiências.

## Como adicionar um novo setor de atividade

1. `config/atividades.json`: adicionar o mapeamento de CNAE → perfil e a lista
   de categorias de despesa daquele setor.
2. `src/engine/atividades.ts`: incluir o novo valor no tipo `PerfilAtividade`
   e o rótulo em `LABEL_PERFIL` (única fonte usada pelas duas telas).
3. Se o setor tiver regra tributária própria (ex.: redução de alíquota, como
   construção civil), adicionar os parâmetros em `config/parametros.json` e a
   lógica em `src/engine/calculo.ts`, seguindo o padrão já usado para
   `construcaoCivil`.
4. Cobrir com testes em `src/engine/__tests__/`.

Nenhuma dessas mudanças deveria exigir tocar em `src/pages/Interno.tsx` ou
`src/pages/Publico.tsx` além do necessário para expor um campo específico do
novo setor (ex.: um seletor de subtipo de operação).

## Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento (App interno em /, público em /simulador)
npm run test      # roda o motor de cálculo (67 testes)
npm run build     # build de produção (pasta dist/)
```

As funções serverless em `api/` (`cnpj.ts`, `lead.ts`) seguem a convenção de
Vercel Functions — se o deploy for noutro provedor, adaptar o handler para o
runtime equivalente (a lógica de negócio não muda).

## Arquitetura

- **Frontend**: React + TypeScript + Vite + `react-router-dom` (duas rotas,
  um único app).
- **Backend**: duas funções serverless leves (`api/cnpj.ts` — proxy da
  BrasilAPI; `api/lead.ts` — grava lead em Google Sheets). Introduzidas
  especificamente para a frente pública; a frente interna continua
  funcionando 100% no navegador.
- **Camada de configuração** (`config/parametros.json`, `config/atividades.json`):
  TODAS as alíquotas, datas de cronograma, percentuais de crédito do Simples,
  parâmetros do split payment e categorias de despesa por atividade/CNAE ficam
  nesses arquivos — nunca hardcoded na lógica ou na UI.
- **Motor de cálculo** (`src/engine/`): funções puras em TypeScript, testáveis
  isoladamente e cobertas por testes automatizados (`vitest`).
- **Gráficos**: `recharts`, seguindo a paleta de cores validada para
  acessibilidade (contraste e daltonismo) do design system interno.

Ver [`docs/arquitetura.md`](docs/arquitetura.md) para o detalhamento completo,
[`docs/base-legal.md`](docs/base-legal.md) para as fontes legais usadas na
modelagem (com data de consulta), e
[`docs/arquitetura-ingestao-fiscal.md`](docs/arquitetura-ingestao-fiscal.md)
para o planejamento (ainda não implementado) da ingestão automática de XML de
notas, EFD Contribuições, EFD ICMS/IPI, ECD, ECF, DEFIS e extrato do DAS.

## Como atualizar alíquotas e regras

Ver [`docs/manutencao-parametros.md`](docs/manutencao-parametros.md).

## Guia de uso para o contador

Ver [`docs/guia-de-uso.md`](docs/guia-de-uso.md).

## Setup da captação de leads (simulador público)

Ver [`docs/leads-setup.md`](docs/leads-setup.md) — configuração da conta de
serviço Google e variáveis de ambiente necessárias.
