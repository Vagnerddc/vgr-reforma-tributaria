# Setup: captura de leads do simulador público → Google Sheets

O simulador público (`/simulador`) envia cada lead para a função serverless
`api/lead.ts`, que grava uma linha numa planilha Google Sheets via uma conta
de serviço (service account). Nenhuma credencial fica no frontend.

## 1. Criar a planilha

1. Crie uma planilha no Google Sheets (ex.: "Leads — Simulador Reforma
   Tributária").
2. Renomeie a primeira aba para `Leads`.
3. Na primeira linha, adicione os cabeçalhos (opcional, só para leitura
   humana — a função sempre insere na próxima linha livre):
   `Data | Nome | E-mail | Telefone | Tipo Pessoa | CNPJ/CPF | Perfil | Regime | Faturamento | Carga 2033 | Delta % | Origem`
4. Copie o ID da planilha (a parte da URL entre `/d/` e `/edit`).

## 2. Criar a conta de serviço (Google Cloud)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie (ou
   reutilize) um projeto.
2. Ative a **Google Sheets API** para esse projeto.
3. Crie uma **Service Account** (Credenciais → Criar credenciais → Conta de
   serviço).
4. Gere uma chave JSON para essa conta de serviço e guarde em local seguro
   (não versionar no git).
5. **Compartilhe a planilha** (botão "Compartilhar" do Google Sheets) com o
   e-mail da conta de serviço (algo como
   `nome@projeto.iam.gserviceaccount.com`), como Editor.

## 3. Configurar variáveis de ambiente

No provedor de hospedagem (ex.: Vercel → Project Settings → Environment
Variables), adicione:

| Variável | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | campo `client_email` do JSON da conta de serviço |
| `GOOGLE_PRIVATE_KEY` | campo `private_key` do JSON (mantenha as quebras de linha como `\n` — a função já trata isso) |
| `GOOGLE_SHEET_ID` | ID copiado no passo 1 |

## 4. Testar

Depois de configurar e implantar, preencha o simulador público até o fim
(etapa "Ver meu resultado") e confira se uma nova linha aparece na aba
`Leads` da planilha.

## Observações

- Se as variáveis de ambiente não estiverem configuradas, a função retorna
  erro 500, mas o simulador **não bloqueia** a exibição do resultado ao
  usuário (a chamada de lead falha silenciosamente do ponto de vista da
  experiência, ver `src/pages/Publico.tsx`).
- Para trocar Google Sheets por um CRM (RD Station, HubSpot, Pipedrive) no
  futuro, só é necessário reescrever o corpo de `api/lead.ts` — o contrato
  com o frontend (`POST /api/lead` com o mesmo payload) não muda.
