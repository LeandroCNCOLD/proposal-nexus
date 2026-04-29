Plano para ajustar a etapa de produtos em todos os tipos de cálculo ColdPro:

1. Padronizar a apresentação da aba Produtos
- Criar um layout único de “Produto + base de cálculo + propriedades térmicas + prévia de carga” para câmaras de congelados, resfriados, climatizados e demais ambientes sem túnel.
- Manter o formulário específico de túnel para túneis/girofreezer, mas alinhar a Etapa 4 com a mesma linguagem visual e os mesmos conceitos: temperaturas editáveis, propriedades oficiais bloqueadas e prévia clara.
- No resumo “Produtos cadastrados”, mostrar a massa correta conforme o modo usado:
  - estoque com giro: estoque, percentual, kg/dia movimentado e kg/h calculado;
  - entrada diária: kg/dia e tempo de recuperação;
  - entrada horária: kg/h direto;
  - lote/recuperação: massa do lote e tempo.

2. Bloquear propriedades oficiais vindas do catálogo, sem bloquear cálculo
- Quando o produto vier do catálogo, deixar bloqueados apenas para edição:
  - temperatura de congelamento;
  - densidade;
  - água, proteína e demais composição quando disponíveis;
  - Cp acima;
  - Cp abaixo;
  - calor latente original;
  - calor latente convertido/usado;
  - condutividade congelada;
  - fração de água congelável/congelada;
  - espessura/característica técnica quando vier do catálogo.
- Manter editáveis:
  - temperatura de entrada do produto;
  - temperatura final do produto;
  - dados operacionais de massa, tempo, giro, recuperação, túnel, ar, vazão etc.
- Garantir que campo bloqueado seja tratado apenas como “não editável pelo usuário”, nunca como “ausente”, “inválido” ou motivo de trava.

3. Separar claramente os dois “calores latentes”
- Renomear os rótulos para evitar ambiguidade:
  - “Calor latente do catálogo” em kJ/kg: valor oficial original carregado do produto.
  - “Calor latente usado no cálculo” em kcal/kg: valor convertido/normalizado usado na carga térmica.
- Nos resultados técnicos do túnel, acrescentar também:
  - “Latente base original”;
  - “Modo do latente”: efetivo ou total;
  - “Fração congelável aplicada”;
  - “Latente efetivo aplicado”, quando a base exigir multiplicação por fração.
- A regra ficará explícita: se o catálogo já entrega latente efetivo, não multiplicar novamente; se entrega latente total, aplicar fração congelável. O sistema já possui `latentMode`; vou expor isso na interface e nos detalhes do cálculo.

4. Ajustar Etapa 4 do túnel
- Alterar a descrição para: “Propriedades técnicas carregadas do catálogo e bloqueadas para preservar a base oficial. Temperaturas de entrada/final e condições operacionais continuam editáveis.”
- Bloquear na Etapa 4 do túnel as propriedades térmicas quando houver produto de catálogo selecionado, assim como já foi feito no formulário de produto comum.
- Manter “Temp. entrada”, “Temp. final”, “Temperatura do ar” e “Fator penetração térmica” editáveis, pois são premissas do projeto/processo, não propriedades oficiais do produto.
- Trocar “Grupo ASHRAE” e “Produto ASHRAE” para “Grupo do catálogo” e “Produto do catálogo”, conforme a terminologia correta.

5. Ajustar alertas para não punir dado oficial bloqueado
- Revisar os alertas técnicos do motor de túnel que hoje podem aparecer por fração congelável, latente baixo ou unidade.
- Quando o produto estiver vinculado ao catálogo oficial, os avisos de consistência de propriedade térmica serão informativos ou suprimidos quando forem apenas consequência dos dados oficiais bloqueados.
- Manter alertas operacionais importantes, como:
  - tempo estimado maior que tempo disponível;
  - vazão divergente da necessária;
  - falta de h manual para validação final;
  - falta de geometria, vazão, massa ou temperatura operacional.

6. Unificar a prévia da carga de produto por tipo de ambiente
- Para câmaras e ambientes sem túnel: a prévia mostrará carga do produto, embalagem, respiração quando aplicável e total da aba Produtos.
- Para túneis/girofreezer: a prévia continuará usando o motor do túnel, mas será apresentada com a mesma estrutura visual e com a separação entre produto, embalagem e cargas internas/processo.
- Evitar dupla contagem visual: quando “Túnel / processo” já representa total do túnel, a tela deixará claro se é carga interna/processo ou total consolidado do motor.

7. Documentar na própria tela a origem dos dados
- Adicionar uma mensagem fixa quando houver produto de catálogo:
  “Dados térmicos sincronizados com o cadastro técnico oficial. Campos bloqueados preservam a base de cálculo e não impedem salvar/recalcular.”
- Para seleção manual, manter a possibilidade de editar propriedades, com aviso de que são premissas manuais.

Arquivos a alterar
- `src/components/coldpro/ColdProProductForm.tsx`
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/routes/app.coldpro.$id.tsx`
- `src/features/coldpro/coldpro-calculation.engine.ts`
- `src/modules/coldpro/engines/tunnelEngine.ts`
- Se necessário, pequenos ajustes em normalizadores/adapters para expor `latentMode`, fração e origem sem mudar a base matemática.

Critério de aceite
- Produto do catálogo: usuário não consegue editar propriedades oficiais, mas consegue salvar e recalcular normalmente.
- Temperatura de entrada e final continuam editáveis.
- A tela diferencia “calor latente original do catálogo” de “calor latente usado/aplicado no cálculo”.
- Câmaras, ambientes resfriados/climatizados/congelados e túneis passam a ter uma apresentação de produto coerente e comparável, respeitando a estrutura específica de cada cálculo.
- Bloqueio visual de campo não gera trava, alarme crítico indevido ou impedimento de proposta.

Diretrizes obrigatórias de arquitetura daqui em diante
- Separar UI de regra de negócio: componentes React apenas orquestram estado, eventos e renderização.
- Não fazer cálculos dentro de componentes React; todo cálculo deve ficar em funções puras, módulos de engine, adapters ou services.
- Manter TypeScript estrito, sem casts desnecessários, sem `any` novo quando houver tipo de domínio claro.
- Preservar arquitetura modular para facilitar testes, manutenção e escala.
- Normalizar unidades em pontos explícitos de conversão: kcal/h, kJ, kW, TR, BTU/h e tempo.
- Preferir funções puras para cálculos térmicos, sincronização e normalização de dados.
- Não quebrar funcionalidades existentes; alterações devem ser incrementais, compatíveis e verificáveis.

Organização modular para GitHub + Cursor
- `src/modules/proposals`: fronteira do domínio de propostas.
  - `screens`: telas migradas incrementalmente das rotas de propostas.
  - `components`: componentes visuais de proposta/editor.
  - `services`: persistência, chamadas server-side e orquestrações.
  - `types`: contratos TypeScript do domínio.
  - `templates`: editor de templates, blocos e modelos.
  - `approval`: aprovação por alçada.
  - `financial`: análise financeira, impostos, margens e cálculos puros.
- `src/modules/nomus`: fronteira de integração com Nomus.
  - `services`: clientes e sincronizações.
  - `types`: payloads externos e modelos normalizados.
  - `mappers`: conversões Nomus → domínio interno.
- `src/modules/coldpro`: motor térmico e telas ColdPro, mantendo engines e physics separados da UI.