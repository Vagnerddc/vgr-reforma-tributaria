# Arquitetura

## Requisitos que guiaram a decisão

- Mantido por um escritório de contabilidade, **sem time de TI dedicado**.
- Legislação em evolução até 2033 → alíquotas/regras não podem estar
  hardcoded.
- Uso interno (contador) + apresentação ao cliente final → interface simples,
  não uma tela técnica de apuração fiscal.
- Baixo volume de usuários simultâneos, sem necessidade de persistência de
  dados de clientes em banco (cada simulação é um "e se", não um cadastro).

## Decisão: SPA estática, sem backend

- **Frontend**: React + TypeScript + Vite. Todo o cálculo roda no navegador,
  client-side.
- **Sem servidor/API/banco de dados**: elimina custo de hospedagem de backend,
  manutenção de infraestrutura, e superfície de ataque (não há dados de
  clientes trafegando ou armazenados em servidor).
- **Hospedagem**: qualquer serviço de arquivos estáticos (Vercel, Netlify,
  GitHub Pages, ou um diretório servido pelo próprio site do escritório).
  Deploy = `npm run build` + upload da pasta `dist/`.
- **Persistência**: nenhuma por padrão — cada simulação é preenchida e
  exportada (relatório `.txt`) na hora. Se no futuro for necessário salvar
  simulações por cliente, a extensão natural é adicionar `localStorage` (sem
  servidor) antes de considerar um banco de dados real.

## Camadas

```
config/parametros.json   → única fonte de verdade para alíquotas, cronograma,
                            percentuais de crédito e parâmetros do split payment.
src/engine/               → motor de cálculo (TypeScript puro, sem UI):
  parametros.ts             - carrega e tipa o JSON de configuração
  types.ts                  - tipos de entrada/saída da simulação
  calculo.ts                - regras de negócio (CBS/IBS, Simples, split payment)
  __tests__/                - testes automatizados (vitest)
src/App.tsx               → interface: formulário de entrada + dashboard
src/App.css               → estilos (paleta validada para contraste/daltonismo)
```

## Por que separar `config/` de `src/engine/`

O objetivo explícito do projeto é permitir que o escritório atualize
alíquotas e prazos **sem mexer em código**. `parametros.json` é o único lugar
que muda quando sai uma nova IN da Receita Federal ou resolução do Comitê
Gestor. O motor de cálculo (`calculo.ts`) só lê esse arquivo — nunca contém um
número de alíquota ou uma data "no meio da lógica".

## Testabilidade

O motor de cálculo é testado isoladamente dos componentes de UI, com os três
perfis de cliente do escritório como casos de teste (ver
`src/engine/__tests__/calculo.test.ts`), o que permite validar mudanças em
`parametros.json` rodando `npm run test` antes de publicar qualquer
atualização de alíquota.

## Alternativas consideradas e descartadas

- **Next.js + backend + banco de dados**: rejeitado por excesso de
  complexidade operacional para o porte do escritório — exigiria manter um
  servidor, variáveis de ambiente, migrações de banco, sem ganho real, já que
  não há necessidade de multiusuário concorrente com dados compartilhados nem
  autenticação complexa.
- **Planilha Excel/Google Sheets**: mais familiar ao contador, mas alíquotas
  por ano x regime x parâmetros de split payment tornam a lógica de fórmulas
  frágil e difícil de testar/auditar; a versão web permite testes automatizados
  e uma experiência gerencial (dashboard) mais clara para o cliente final.
