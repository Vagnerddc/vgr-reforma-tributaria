import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Só para `npm run dev`: responde /api/cnpj e /api/lead localmente, sem
 * depender do `vercel dev`. Em produção o build usa as funções reais em
 * api/cnpj.ts e api/lead.ts — este plugin nunca entra no bundle.
 */
function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cnpj')) return next()

        const url = new URL(req.url, 'http://localhost')
        const cnpj = (url.searchParams.get('cnpj') || '').replace(/\D/g, '')
        res.setHeader('Content-Type', 'application/json')

        if (cnpj.length !== 14) {
          res.statusCode = 400
          res.end(JSON.stringify({ erro: 'CNPJ inválido. Informe 14 dígitos.' }))
          return
        }

        try {
          const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          })
          if (!resposta.ok) {
            const erro =
              resposta.status === 404
                ? 'CNPJ não encontrado na base da Receita Federal.'
                : resposta.status === 429
                  ? 'Muitas consultas em um curto período — aguarde alguns instantes e tente novamente.'
                  : 'A consulta à Receita Federal falhou temporariamente. Tente novamente em instantes.'
            res.statusCode = resposta.status
            res.end(JSON.stringify({ erro }))
            return
          }
          const dados = (await resposta.json()) as Record<string, unknown>
          res.statusCode = 200
          res.end(
            JSON.stringify({
              cnpj: dados.cnpj,
              razaoSocial: dados.razao_social,
              nomeFantasia: dados.nome_fantasia,
              cnaePrincipalCodigo: dados.cnae_fiscal,
              cnaePrincipalDescricao: dados.cnae_fiscal_descricao,
              municipio: dados.municipio,
              uf: dados.uf,
              situacaoCadastral: dados.descricao_situacao_cadastral,
              porte: dados.porte,
              opcaoPeloSimples: dados.opcao_pelo_simples ?? null,
            })
          )
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ erro: 'Falha ao consultar a BrasilAPI. Tente novamente em instantes.' }))
        }
      })

      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/lead' || req.method !== 'POST') return next()
        // Em dev, sem credenciais do Google configuradas: apenas confirma recebimento
        // e imprime no terminal, para não travar o fluxo de teste local do formulário.
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          console.log('[dev] lead recebido (não gravado em planilha):', body)
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, dev: true }))
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
})
