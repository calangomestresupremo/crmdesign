# CRM Design

CRM Design é um controle de vendas para designers que prospectam clientes e precisam acompanhar oportunidades desde o primeiro lead até o fechamento.

## Funcionalidades

- Pipeline visual com etapas de conversão: Novo lead, Primeiro contato, Briefing marcado, Proposta enviada, Negociação, Fechado e Perdido.
- Cadastro manual de leads com dados completos do contato, empresa, origem, serviço de interesse, orçamento e observações.
- Perfil do lead com edição de dados, troca de etapa e registro de atividades de contato/follow-up.
- Controle geral de leads com busca por nome, empresa, origem, contato ou serviço.
- Importação de leads via CSV, TSV, TXT, JSON e arquivos `.xls` baseados em tabela HTML, com mapeamento de colunas e prévia antes de salvar.
- Campo de upload preparado para XLS/XLSX; para planilhas binárias Excel, salve como CSV para importar diretamente neste build sem dependências.
- Exportação dos leads em JSON.
- Persistência local no navegador via `localStorage`.
- Identidade visual em amarelo `#ffaa00`, gradiente para laranja, preto e branco.

## Rodando localmente

O projeto não depende de pacotes externos. Use Node.js com TypeScript disponível no ambiente.

```bash
npm run build
npm run dev
```

A aplicação ficará disponível em `http://localhost:4173`.

## Checagem de tipos

```bash
npm run check
```
