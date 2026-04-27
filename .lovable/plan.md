Plano para instalar o botão de recálculo e recálculo automático ao trocar produto no ambiente.

## O que será implementado

1. **Botão “Recalcular ambiente” visível no ColdPro**
   - Adicionar uma ação de recálculo mais clara na tela do ambiente, não apenas dentro da etapa final.
   - O botão usará o motor atual `calculateColdProEnvironment`.
   - Ao concluir, atualizará o resultado exibido na tela e mostrará confirmação.

2. **Recálculo automático ao salvar/trocar produto do ambiente**
   - Quando um produto for adicionado, editado ou trocado pelo catálogo dentro de um ambiente, o sistema deverá:
     - salvar o produto;
     - reaplicar as propriedades atualizadas do catálogo;
     - recalcular a carga térmica do ambiente automaticamente;
     - atualizar o card/resultado na tela.

3. **Recálculo automático ao excluir produto**
   - Quando um produto for removido do ambiente, o sistema também recalculará o ambiente para não manter carga antiga salva.

4. **Túnel também deve seguir o mesmo comportamento**
   - Em ambientes de túnel/congelamento/resfriamento, ao salvar/trocar produto no formulário de túnel, recalcular o ambiente logo após salvar.
   - Isso evita que o usuário veja resultado antigo após alterar produto, massa, tempo, temperatura ou propriedades térmicas.

5. **Indicação visual de recálculo**
   - Enquanto o recálculo estiver rodando, mostrar estado de carregamento no botão/ação.
   - Mensagens esperadas:
     - “Produto salvo e carga recalculada”
     - “Produto excluído e carga recalculada”
     - “Túnel salvo e carga recalculada”
     - caso falhe: salvar mantém sucesso, mas mostrar aviso de erro no recálculo.

## Detalhes técnicos

Arquivos principais:

- `src/routes/app.coldpro.$id.tsx`
- possivelmente `src/features/coldpro/use-coldpro.ts`
- possivelmente `src/features/coldpro/coldpro.functions.ts`

Fluxo atual já existe:

```text
Salvar produto/túnel -> invalida dados do projeto
Botão Calcular carga -> roda calculateColdProEnvironment
```

Novo fluxo:

```text
Salvar produto/túnel -> salvar no banco -> calculateColdProEnvironment(environmentId) -> atualizar resultado na tela
Excluir produto -> excluir no banco -> calculateColdProEnvironment(environmentId) -> atualizar resultado na tela
Botão Recalcular ambiente -> calculateColdProEnvironment(environmentId)
```

Não será necessário criar tabela nova. O recálculo continuará substituindo o registro em `coldpro_results` do ambiente, como já acontece hoje.

## Validação

Após implementar:

- rodar TypeScript para garantir que compila;
- verificar se o botão aparece;
- confirmar que salvar/trocar produto chama o recálculo;
- confirmar que o resultado passa a incluir o bloco novo `operational_model` nos ambientes recalculados.