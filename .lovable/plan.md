Plano para deixar o sistema em “zoom padrão/original” e melhorar o preenchimento das boxes em notebooks.

## Objetivo

Ajustar a escala global da interface para parecer em 100% de zoom, sem sensação de tela comprimida ou reduzida, e garantir que cards/boxes/tabelas ocupem melhor o espaço disponível em notebook.

## Diagnóstico inicial

Hoje o sistema está configurado com aparência compacta global:

- `html { font-size: 14px; }`
- `body { font-size: 13px; }`
- `.app-shell { font-size: 13px; }`
- `.app-main { padding: 0.75rem; }`
- vários componentes ColdPro e tabelas também foram reduzidos para caber mais coisa na tela.

Isso dá a impressão de “zoom reduzido”. Para um notebook, o ideal é manter uma escala padrão mais confortável e ajustar os grids/cards para preencher a largura, sem depender de fonte pequena demais.

## O que vou ajustar

### 1. Restaurar escala padrão do sistema

Vou ajustar a base visual para um comportamento mais próximo do navegador em 100%:

- `html` volta para `font-size: 16px` ou `100%`.
- `body` sobe para um tamanho padrão mais legível.
- `.app-shell` deixa de forçar fonte compactada global.
- Preservo compactação apenas onde for realmente necessário, como tabelas densas ou áreas técnicas.

Resultado esperado: a interface fica com aparência mais “original padrão”, menos espremida.

### 2. Melhorar o preenchimento das boxes/cards

Vou revisar as regras globais de layout para que as boxes:

- ocupem 100% da largura disponível do painel principal;
- usem grids responsivos com colunas que se adaptam ao notebook;
- evitem cards muito estreitos ou sobrando espaço vazio desnecessário;
- mantenham espaçamento visual confortável.

Ajustes prováveis:

- aumentar um pouco o padding principal em telas médias/grandes;
- usar `minmax()` adequado nos grids;
- garantir `w-full`, `min-w-0` e `overflow-x-auto` onde houver tabelas ou conteúdo largo;
- evitar que elementos internos estourem horizontalmente.

### 3. Otimizar para notebook

Vou mirar principalmente a experiência em telas comuns de notebook, como:

```text
1366 x 768
1440 x 900
1536 x 864
```

Critérios:

- sidebar e topo sem consumir espaço excessivo;
- conteúdo principal bem preenchido;
- cards legíveis sem precisar mexer no zoom do navegador;
- tabelas com rolagem horizontal quando necessário, em vez de quebrar layout;
- menos “buracos” e colunas desalinhadas.

### 4. Ajustar AppShell

No `AppShell`, vou revisar:

- largura do conteúdo principal;
- padding do `<main>`;
- comportamento do topo fixo;
- uso de `overflow-x-hidden`, para não esconder conteúdo que deveria rolar em tabelas;
- estrutura para notebook sem compactar demais.

### 5. Ajustar CSS global

No `src/styles.css`, vou reorganizar a parte de escala:

- separar “escala padrão” de “modo compacto técnico”;
- manter design tokens e cores existentes;
- evitar zoom via `transform`, `scale` ou reduções globais agressivas;
- manter responsividade em mobile e desktop.

### 6. Validar visualmente

Depois da implementação, vou conferir a interface em viewport de notebook e revisar principalmente:

- dashboard/app principal;
- configurações/gestão de usuários;
- telas ColdPro, porque já têm muitas regras compactas;
- tabelas e cards com conteúdo extenso.

## Arquivos que serão ajustados

- `src/styles.css`
  - escala global, fonte base, padding, grids e comportamento responsivo.

- `src/components/AppShell.tsx`
  - estrutura principal, largura/padding e overflow.

- Possivelmente telas específicas caso algum layout esteja forçando largura ou cards estreitos demais:
  - `src/routes/app.configuracoes.index.tsx`
  - telas ColdPro com muitos cards/tabelas
  - dashboards/cards se necessário

## Resultado esperado

A interface ficará com aparência de zoom 100% padrão, mais confortável em notebook, com boxes preenchendo melhor o espaço da tela e sem depender de reduzir o zoom do navegador para visualizar bem.