C# Visa SaaS (PostgreSQL + Next.js)


SaaS que recebe dados do usuário (texto/arquivos), propõe um visto provável, faz 5 perguntas de validação e entrega um plano de ação.


## Stack
- Next.js (App Router)
- PostgreSQL (node-postgres `pg`)
- OpenAI (outputs estruturados via schemas)
- S3 (upload de arquivos via Signed URL)
- Stripe (billing)


## Desenvolvimento
1. `cp .env.example .env` e preencha variáveis
2. `pnpm install`
3. **Banco de dados:** o app usa PostgreSQL via `DATABASE_URL` no `.env`.
   - **Erro "ECONNREFUSED" ou "database_unavailable"?** O PostgreSQL não está acessível.
   - **Opção A – PostgreSQL local:** instale e inicie o PostgreSQL (porta 5432), crie o banco (ex.: `createdb visa-saas`) e use `DATABASE_URL=postgresql://postgres@localhost:5432/visa-saas` (ajuste usuário/senha se necessário).
   - **Opção B – Supabase:** no dashboard do projeto Supabase, vá em **Project Settings → Database** e copie a **Connection string (URI)**. Cole em `DATABASE_URL` no `.env` (use a senha do banco do projeto).
4. `pnpm migrate` (roda migrations SQL)
5. **Login com Google (opcional):** para o botão "Entrar com Google" funcionar:
   - No [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto → **Authentication** → **Providers** → **Google**: ative e preencha **Client ID** e **Client Secret** (crie em [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Credentials → Create OAuth 2.0 Client ID → tipo "Web application" → Authorized redirect URIs: `https://seu-projeto.supabase.co/auth/v1/callback`).
   - Em **Authentication** → **URL Configuration**: **Redirect URLs** deve incluir `http://localhost:3000/auth/callback` (dev) e sua URL de produção (ex.: `https://seudominio.com/auth/callback`).
6. `pnpm dev`


## Lemon Squeezy (pagamentos)
- Crie uma conta em [Lemon Squeezy](https://lemonsqueezy.com) e uma loja.
- Crie um produto (ex.: assinatura mensal) e anote o **Variant ID** (em Products → variante → URL ou API).
- Em **Settings → API**: crie uma API key e anote o **Store ID**.
- Em **Settings → Webhooks**: adicione uma URL (ex.: `https://seudominio.com/api/billing/lemonsqueezy/webhook`), defina um **Signing secret** e selecione os eventos: `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_payment_failed`, `subscription_payment_recovered`.
- No `.env`:
  - `LEMONSQUEEZY_API_KEY` — API key
  - `LEMONSQUEEZY_STORE_ID` — ID da loja
  - `LEMONSQUEEZY_SIGNING_SECRET` — mesmo valor do webhook
  - `LEMONSQUEEZY_VARIANT_ID` — Variant ID do plano padrão (ou use `NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID` e/ou envie `variantId` no body do checkout).
- Rode `pnpm migrate` para adicionar as colunas de assinatura em `users`.


## Scripts úteis
- `pnpm migrate`: executa migrations em `/migrations`
- `pnpm build && pnpm start`: produção
- Se o **build** travar ou falhar por memória, use mais heap:  
  **Linux/Mac:** `NODE_OPTIONS=--max-old-space-size=4096 pnpm build`  
  **PowerShell:** `$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm build`


> Aviso legal: Esta ferramenta **não é aconselhamento jurídico**. onsulte um advogado de imigração.