## Resultado da verificação

Verifiquei o estado atual do projeto, Git, rotas, dependências, banco e integração do ColdPro. A conclusão é: o ColdPro está presente e parcialmente funcional, mas o relatório do Manus não bate 100% com o estado real deste ambiente.

## O que está correto

1. **Arquivos ColdPro existem no código**
   - `src/features/coldpro/`
   - `src/modules/coldpro/`
   - `src/components/coldpro/`
   - `src/integrations/coldpro/`

2. **Rotas estão registradas corretamente**
   - `/app/coldpro`
   - `/app/coldpro/$id`
   - `/app/coldpro/produtos`
   - `/app/coldpro/catalogo`
   - `/app/seletor`

   A estrutura `src/routes/app.alguma-coisa.tsx` está correta para TanStack Router. Isso não é erro.

3. **Menu lateral inclui o ColdPro**
   - ColdPro
   - Produtos Ashrae
   - Catálogo ColdPro
   - Seletor Técnico

4. **Banco já tem tabelas ColdPro**
   Foram encontradas 28 tabelas `coldpro_*`, incluindo projetos, ambientes, produtos, resultados, catálogo e performance.

5. **Há dados no banco**
   Exemplos encontrados:
   - `coldpro_projects`: 1 registro
   - `coldpro_environments`: 5 registros
   - `coldpro_results`: 5 registros
   - `coldpro_products`: 308 registros
   - `coldpro_equipment_models`: 94 registros
   - `coldpro_equipment_performance_points`: 1369 registros
   - `coldpro_thermal_materials`: 17 registros

6. **Há build gerado**
   Existe `dist/client` e `dist/server`, indicando que houve build recente no ambiente.

## Divergências no relatório do Manus

1. **Commit final citado não aparece aqui**
   O relatório cita:

   ```text
   96e01bd chore: merge coldpro-integration into main - resolve conflicts
   ```

   Mas o estado atual do Git está em:

   ```text
   0263782 Buscou produto na tabela F3
   ```

   Ou seja: esse commit `96e01bd` não está no estado atual deste projeto.

2. **Não encontrei branch `coldpro-integration` aqui**
   O relatório diz que ela foi criada e mergeada, mas o Git atual não mostra essa branch local.

3. **O `.env` citado pelo Manus não corresponde ao projeto**
   O relatório cita variáveis falsas/exemplo como:

   ```env
   VITE_SUPABASE_URL=https://supabase-dev.example.com
   VITE_SUPABASE_ANON_KEY=...
   VITE_COLDPRO_ENABLED=true
   VITE_COLDPRO_DEBUG=true
   ```

   Aqui, o `.env.example` só tem:

   ```env
   NOMUS_BASE_URL=
   NOMUS_API_KEY=
   ```

   Isso é bom em parte: não há vazamento de chaves reais no `.env.example`. Mas o relatório dele parece descrever uma instalação local dele, não necessariamente o estado real deste projeto Lovable.

4. **Versões de dependência não batem exatamente**
   Exemplo:
   - Manus cita `@cloudflare/vite-plugin@1.33.2`
   - Projeto atual declara `@cloudflare/vite-plugin ^1.25.5`

   Isso não significa erro automaticamente, mas mostra que o relatório não é uma fotografia fiel deste repositório atual.

5. **Mistura TipTap v2 e v3 permanece no package.json**
   Existem dependências TipTap com versões `^2` e outras `^3.22.4`. O Manus diz que resolveu o conflito, mas a mistura ainda aparece declarada. Pode compilar, mas é um ponto de risco.

## Problemas reais encontrados

### 1. Segurança: funções ColdPro usam cliente administrativo sem middleware de autenticação

As funções principais do ColdPro usam `supabaseAdmin`, que ignora as políticas de acesso do banco, e várias não têm middleware explícito de autenticação.

Funções afetadas incluem:

```text
src/features/coldpro/coldpro.functions.ts
src/features/coldpro/product-catalog.functions.ts
src/features/coldpro/catalog-selection.functions.ts
src/features/coldpro/push-coldpro-to-proposal.functions.ts
src/integrations/coldpro/coldpro-memorial.functions.ts
src/modules/coldpro/services/coldProPersistence.functions.ts
```

Risco prático: mesmo com a tela protegida por login, as funções de servidor deveriam validar sessão no backend antes de ler/gravar dados.

### 2. Políticas do banco muito permissivas em algumas tabelas ColdPro

O linter do backend encontrou 15 avisos. Entre eles, há políticas `USING true` / `WITH CHECK true` em tabelas ColdPro para operações de escrita.

Exemplos:

```text
coldpro_projects
coldpro_environments
coldpro_environment_products
coldpro_equipment_selections
coldpro_results
coldpro_tunnels
coldpro_products
coldpro_insulation_materials
coldpro_equipment_catalog
```

Isso deve ser apertado para exigir usuário autenticado e, quando aplicável, vínculo com projeto/proposta/perfil.

### 3. Algumas tabelas de catálogo permitem escrita ampla

Catálogos técnicos, materiais e produtos podem precisar ser editáveis apenas por usuários internos/autorizados. Hoje algumas políticas estão amplas demais.

### 4. O relatório do Manus recomenda comandos que não são adequados aqui

Ele sugere:

```bash
npx supabase link
npx supabase db push
```

Neste projeto, o backend já está integrado ao Lovable Cloud. Não é necessário linkar manualmente nem empurrar banco por CLI local.

## Plano de correção recomendado

### Etapa 1 — Blindar funções ColdPro no backend

Adicionar validação de usuário autenticado nas funções de servidor do ColdPro, seguindo o padrão já usado nas funções Nomus.

Arquivos a revisar:

```text
src/features/coldpro/coldpro.functions.ts
src/features/coldpro/product-catalog.functions.ts
src/features/coldpro/catalog-selection.functions.ts
src/features/coldpro/push-coldpro-to-proposal.functions.ts
src/integrations/coldpro/coldpro-memorial.functions.ts
src/modules/coldpro/services/coldProPersistence.functions.ts
```

Para funções de catálogo que devem ser públicas apenas para leitura, manter leitura autenticada ou controlada; para escrita/importação, exigir usuário autenticado e, idealmente, papel permitido.

### Etapa 2 — Corrigir políticas permissivas do banco

Criar migração para substituir políticas amplas por políticas mais seguras:

- projetos ColdPro: somente usuários autenticados podem criar/ver/alterar;
- dados filhos: acesso condicionado ao projeto existente e usuário autenticado;
- catálogos técnicos: leitura autenticada, escrita restrita a papéis administrativos/técnicos;
- resultados, seleções e relatórios: acesso vinculado ao projeto.

### Etapa 3 — Conferir consistência de dependências

Rodar validação com o gerenciador correto do projeto e verificar se a mistura TipTap v2/v3 causa risco real:

```text
bun run build
bunx tsc --noEmit
```

Se aparecer conflito TipTap, alinhar versões para um conjunto compatível com os componentes existentes.

### Etapa 4 — Validar fluxo real do ColdPro

Testar o caminho operacional:

```text
/app/coldpro
→ criar/abrir projeto
→ criar/editar ambiente
→ preencher produto/túnel/processos avançados
→ calcular carga
→ selecionar equipamento
→ gerar memorial PDF
→ enviar para proposta
```

### Etapa 5 — Gerar relatório final de auditoria

Após as correções, entregar um relatório curto com:

- status do build;
- status TypeScript;
- status das políticas do banco;
- rotas ColdPro confirmadas;
- divergências remanescentes entre Git/Lovable/relatório Manus;
- lista objetiva de arquivos alterados.

## Resumo

O ColdPro está instalado no projeto, as rotas existem e o banco possui estrutura/dados. Porém, eu não trataria a instalação do Manus como “100% comprovada”, porque o commit, branch e variáveis citadas por ele não aparecem exatamente aqui.

A correção mais importante agora não é reinstalar o ColdPro; é **blindar autenticação/autorização nas funções e políticas do ColdPro**, depois rodar build/typecheck e validar o fluxo completo.