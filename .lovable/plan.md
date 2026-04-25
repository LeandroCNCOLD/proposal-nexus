Vou remover o “Seletor Técnico” duplicado que aparece em Inteligência para evitar conflito com o ColdPro principal.

## O que será feito

1. Remover o item do menu lateral
   - Tirar “Seletor Técnico” do grupo “Inteligência”.
   - Manter os demais itens: Head-to-Head, Documentos & IA e Relatórios.

2. Remover a rota `/app/seletor`
   - Excluir a página que carrega o módulo `ColdProSeletorApp`.
   - Assim o usuário não consegue mais acessar esse cálculo paralelo pelo menu nem por rota direta.

3. Remover o módulo antigo/duplicado do seletor
   - Apagar os componentes e serviços em `src/modules/coldpro` que pertencem a esse seletor paralelo.
   - Preservar o ColdPro oficial em `src/features/coldpro`, `src/components/coldpro`, `src/integrations/coldpro` e rotas `/app/coldpro*`.

4. Ajustar importações compartilhadas com cuidado
   - Existem funções do ColdPro oficial que reutilizam apenas o motor de processos avançados dentro de `src/modules/coldpro/services/advancedProcesses`.
   - Para não quebrar o ColdPro oficial, vou migrar essas funções compartilhadas para dentro de `src/features/coldpro` ou ajustar as importações antes de remover o módulo antigo.

5. Validar build e referências
   - Rodar busca por `/app/seletor`, `ColdProSeletorApp` e `saveColdProSeletorCalculation` para garantir que não sobrou referência quebrada.
   - Rodar build/typecheck para confirmar que o sistema continua funcionando.

## Resultado esperado

- O menu “Inteligência > Seletor Técnico” desaparece.
- A página antiga de cálculo térmico não existe mais.
- O ColdPro correto continua disponível em “Cadastros > ColdPro”, “Produtos Ashrae” e “Catálogo ColdPro”.
- Reduzimos o risco de conflito entre dois motores de cálculo diferentes.