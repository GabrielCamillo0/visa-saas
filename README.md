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
3. `pnpm migrate` (roda migrations SQL)
4. `pnpm dev`


## Scripts úteis
- `pnpm migrate`: executa migrations em `/migrations`
- `pnpm build && pnpm start`: produção


> Aviso legal: Esta ferramenta **não é aconselhamento jurídico**. onsulte um advogado de imigração.