## Objetivo

No Banco de Leads (`src/routes/app.sdr.bank.tsx`), os botões **Pegar** e **Devolver** hoje se alternam (um aparece, o outro some). O usuário quer ver **os dois sempre juntos**, sendo que:

- **Devolver** começa **desabilitado** (cinza)
- Ao clicar em **Pegar**, **Devolver** fica habilitado automaticamente (porque `lockedByMe` vira `true`)
- E o tamanho dos botões precisa ser **reduzido** para caber na coluna sem quebrar layout

## Mudanças

### 1. Linhas individuais (propostas) — `renderLeadRow` (linhas 605-642)

Substituir a lógica atual (Pegar XOR Devolver) por **par fixo lado a lado**:

- `Pegar` — habilitado quando `!lockedByMe && !lockedByOther && !atLimit`; desabilitado se já pegou (lockedByMe) ou se atingiu o limite
- `Devolver` — habilitado **somente quando `lockedByMe && !isFrozen`**; desabilitado nos outros casos (visual cinza, sem ação)
- Se `lockedByOther` (outro SDR pegou) → mostrar apenas badge "Em atendimento por X", esconder os dois botões (regra atual mantida)
- Botões compactos: `size="sm"` + classe extra `h-7 px-2 text-[11px]`, ícone `w-3 h-3` sem texto extra. Ex.: `<Lock/> Pegar` / `<Unlock/> Devolver`

Bloquear (gestor) e Desbloquear (gestor) continuam como hoje, no mesmo container flex.

### 2. Linha-mãe do grupo (CNPJ) — bloco linhas 896-966

Mesma ideia: sempre renderizar **par Pegar grupo / Devolver grupo** quando `canPickLeads && !isArchivedTab`:

- `Pegar grupo (N)` — habilitado quando `g.pickableIds.length > 0 && !atLimit`; label vira `Pegar restantes (N)` quando há mix
- `Devolver grupo (N)` — habilitado quando `g.returnableIds.length > 0`; label vira `Devolver minhas (N)` quando há mix; desabilitado (cinza) quando o SDR ainda não pegou nada do grupo
- Mesma redução de tamanho (`h-7 px-2 text-[11px]`)
- AlertDialog de confirmação do "Devolver" permanece

### 3. Eliminar estados A/B/C/D condicionais

Como os dois botões agora aparecem sempre, removo as flags `stateA/stateB/stateC` e uso diretamente `g.pickableIds.length` e `g.returnableIds.length` para habilitar/desabilitar e definir o label.

## Arquivos

- `src/routes/app.sdr.bank.tsx` — apenas alterações de UI nas duas regiões acima (sem mudanças em mutations, serviços ou tipos).

## Validação

- Build TypeScript limpo
- Visual: confirmar par lado a lado em ambas as linhas (mãe e filha), e que `Devolver` fica visualmente desabilitado até clicar em `Pegar`
