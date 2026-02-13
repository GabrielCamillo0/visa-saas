# Deploy do Visa SaaS na Vercel

## 1. Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Projeto em um repositório **Git** (GitHub, GitLab ou Bitbucket)
- **Banco PostgreSQL** acessível pela internet (ex.: Supabase, Neon, Railway)
- **Supabase** configurado (Auth já está no projeto)
- **OpenAI** API key

---

## 2. Enviar o código para o Git

Se ainda não subiu o projeto:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USUARIO/visa-saas.git
git push -u origin main
```

*(Substitua pela URL do seu repositório.)*

---

## 3. Criar o projeto na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login.
2. Clique em **Add New…** → **Project**.
3. **Import** o repositório do Git (conecte GitHub/GitLab/Bitbucket se pedir).
4. Selecione o repositório **visa-saas**.
5. A Vercel deve detectar **Next.js** automaticamente:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build` (padrão)
   - **Output Directory:** (deixe padrão)
   - **Install Command:** `pnpm install` ou `npm install` (conforme o que você usa)

**Não clique em Deploy ainda** — configure antes as variáveis de ambiente.

---

## 4. Variáveis de ambiente

No passo de configuração do projeto (ou depois em **Settings → Environment Variables**), adicione:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_APP_URL` | Sim | URL do app na Vercel, ex: `https://visa-saas.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key do Supabase (SSR/auth) |
| `DATABASE_URL` | Sim | Connection string PostgreSQL (ex.: do Supabase ou Neon) |
| `OPENAI_API_KEY` | Sim | Chave da API OpenAI |
| `NEXTAUTH_URL` | Recomendado | Mesmo valor de `NEXT_PUBLIC_APP_URL` |
| `NEXTAUTH_SECRET` | Recomendado | String aleatória longa (ex: `openssl rand -hex 32`) |

**Opcionais** (podem ficar para depois):

- `OPENAI_MODEL` — ex: `gpt-4o-mini` (padrão)
- `STORAGE_PROVIDER` — `local` ou `s3`; em serverless use `s3` ou similar
- `S3_*` — se usar upload em S3/R2
- `STRIPE_*` — se for usar pagamentos
- `AI_TIMEOUT_*` — timeouts das chamadas de IA (opcional)

**Importante:** Depois do primeiro deploy, atualize `NEXT_PUBLIC_APP_URL` e `NEXTAUTH_URL` com a URL real que a Vercel der (ex: `https://seu-projeto.vercel.app`).

---

## 5. Deploy

1. Clique em **Deploy**.
2. Aguarde o build. Se der erro, confira o log (geralmente falta variável de ambiente ou `DATABASE_URL` incorreta).
3. Ao terminar, a Vercel mostra a URL do projeto (ex: `https://visa-saas-xxx.vercel.app`).

---

## 6. Após o deploy

### 6.1 URL no Supabase (Auth)

1. No [Supabase Dashboard](https://app.supabase.com) → seu projeto → **Authentication** → **URL Configuration**.
2. Em **Redirect URLs**, adicione:
   - `https://SEU_DOMINIO_VERCEL.app/auth/callback`
   - `https://SEU_DOMINIO_VERCEL.app/**`
3. Em **Site URL**, use: `https://SEU_DOMINIO_VERCEL.app`

### 6.2 Variáveis com a URL final

No projeto na Vercel → **Settings** → **Environment Variables**:

- Atualize `NEXT_PUBLIC_APP_URL` para a URL real (ex: `https://visa-saas.vercel.app`).
- Atualize `NEXTAUTH_URL` para o mesmo valor.
- Faça um **Redeploy** (Deployments → ⋮ → Redeploy) para aplicar.

### 6.3 Banco de dados

- As **migrations** não rodam sozinhas na Vercel. Rode localmente apontando para o mesmo `DATABASE_URL` de produção:

  ```bash
  DATABASE_URL="postgresql://..." pnpm run migrate
  ```

  Ou use o painel do seu provedor de Postgres (Supabase SQL Editor, etc.) para executar os scripts em `migrations/`.

---

## 7. Comandos úteis

- **Deploy manual:** cada `git push` na branch conectada (ex: `main`) gera um deploy automático.
- **Logs:** Vercel → projeto → **Deployments** → clique no deploy → **Functions** ou **Build Logs**.
- **Domínio próprio:** Settings → **Domains** → adicione seu domínio.

---

## Resumo rápido

1. Subir código no Git.
2. Conectar o repo na Vercel e criar o projeto.
3. Preencher variáveis de ambiente (principalmente Supabase, `DATABASE_URL`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`).
4. Deploy.
5. Configurar redirect URLs no Supabase e rodar migrations no banco.
6. Ajustar `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` para a URL final e redeployar.
