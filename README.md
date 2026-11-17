# Central de Manutenção

Aplicação independente para abertura, acompanhamento e gestão de solicitações de manutenção de unidades operacionais.

## Stack
- React 18 + Vite
- Supabase Auth e PostgreSQL
- Supabase Edge Function `maintenance-public`
- Vercel

## Desenvolvimento
```bash
npm install
npm run dev
```

## Variáveis de ambiente
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_MAINTENANCE_API_URL`

Nunca incluir a chave `service_role` no frontend. A interface utiliza exclusivamente a chave publishable e a Edge Function pública para abertura e acompanhamento de chamados.

## Primeira unidade
Loja 232 — Macaé.

## Identidade visual
Interface dark, com superfícies grafite, contraste elevado e acentos dourados discretos.