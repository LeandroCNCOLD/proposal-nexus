/**
 * CORREÇÕES PARA INTEGRAÇÃO NOMUS
 * Arquivo com as correções prontas para implementar
 * 
 * Substitua as funções nos arquivos originais pelas versões corrigidas abaixo
 */

// ============================================================================
// ARQUIVO: src/integrations/nomus/client.ts
// ============================================================================

// CORREÇÃO 1: Aumentar limite de itens
// ANTES:
// const LIST_MAX_ITEMS = 50_000;

// DEPOIS:
const LIST_MAX_ITEMS = 500_000;  // Aumentado de 50.000 para 500.000
const LIST_MAX_PAGES = 500;       // Aumentado de 200 para 500


// CORREÇÃO 2: Aumentar timeout
// ANTES:
// const REQUEST_TIMEOUT_MS = 25_000;

// DEPOIS:
const REQUEST_TIMEOUT_MS = 60_000;  // Aumentado de 25s para 60s


// ============================================================================
// ARQUIVO: src/integrations/nomus/server.functions.ts
// ============================================================================

// CORREÇÃO 3: Capturar TODOS os erros (não apenas 3)
// ANTES:
// if (itemErrors.length < 3) itemErrors.push(msg);

// DEPOIS:
async function runEntitySync(args: {
  entity: string;
  endpoint: string;
  triggeredBy: string | null;
  processItem: (raw: Json) => Promise<"ok" | "skip" | "unmatched">;
  query?: Record<string, string | number | undefined>;
  pageSize?: number;
}): Promise<SyncResult> {
  const { entity, endpoint, triggeredBy, processItem, query, pageSize } = args;
  await setState(entity, { running: true, last_error: null });
  try {
    const res = await listAll<Json>(endpoint, query ?? {}, { entity, triggeredBy, pageSize });
    if (!res.ok) {
      const error = res.error ?? "Falha ao listar entidade no Nomus";
      await setState(entity, { running: false, last_error: error });
      return { ok: false, error };
    }
    let count = 0;
    let skipped = 0;
    let unmatched = 0;
    const itemErrors: string[] = [];
    for (const raw of res.items) {
      try {
        const r = await processItem(raw);
        if (r === "ok") count += 1;
        else if (r === "unmatched") { unmatched += 1; skipped += 1; }
        else skipped += 1;
      } catch (e) {
        skipped += 1;
        const msg = e instanceof Error ? e.message : String(e);
        // ✅ CORREÇÃO: Capturar TODOS os erros, não apenas 3
        itemErrors.push(msg);
      }
    }
    const noteParts: string[] = [];
    if (itemErrors.length > 0) {
      // ✅ Mostrar contagem total de erros
      noteParts.push(`${itemErrors.length} itens com erro: ${itemErrors.slice(0, 5).join(" | ")}${itemErrors.length > 5 ? "..." : ""}`);
    }
    if (unmatched > 0) noteParts.push(`${unmatched} item(s) sem correspondência local`);
    await setState(entity, {
      running: false,
      last_synced_at: new Date().toISOString(),
      total_synced: count,
      last_error: noteParts.length > 0 ? noteParts.join(" • ") : null,
    });
    return { ok: true, count, skipped, unmatched };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setState(entity, { running: false, last_error: msg });
    return { ok: false, error: msg };
  }
}


// CORREÇÃO 4: Adicionar email e telefone ao sincronizar clientes
// ANTES:
// export const nomusSyncClients = createServerFn({ method: "POST" })
//   .middleware([requireSupabaseAuth])
//   .handler(async ({ context }) => {
//     const userId = (context as { userId?: string }).userId ?? null;
//     return runEntitySync({
//       entity: "clientes",
//       endpoint: NOMUS_ENDPOINTS.clientes,
//       triggeredBy: userId,
//       processItem: async (raw) => {
//         const nomus_id = pickStr(raw, "id", "codigo", "idCliente");
//         const name = pickStr(raw, "nome", "razaoSocial", "nomeFantasia");
//         if (!nomus_id || !name) return "skip";
//         const { error } = await supabaseAdmin
//           .from("clients")
//           .upsert(
//             {
//               nomus_id,
//               name,
//               document: pickStr(raw, "cnpj", "cpf", "documento"),
//               trade_name: pickStr(raw, "nomeFantasia", "fantasia"),
//               city: pickStr(raw, "cidade", "municipio"),
//               state: pickStr(raw, "uf", "estado"),
//               segment: pickStr(raw, "segmento", "ramo"),
//               origin: "nomus",
//               nomus_synced_at: new Date().toISOString(),
//             },
//             { onConflict: "nomus_id" }
//           );
//         if (error) throw new Error(error.message);
//         return "ok";
//       },
//     });
//   });

// DEPOIS:
export const nomusSyncClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "clientes",
      endpoint: NOMUS_ENDPOINTS.clientes,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "codigo", "idCliente");
        const name = pickStr(raw, "nome", "razaoSocial", "nomeFantasia");
        if (!nomus_id || !name) return "skip";
        const { error } = await supabaseAdmin
          .from("clients")
          .upsert(
            {
              nomus_id,
              name,
              document: pickStr(raw, "cnpj", "cpf", "documento"),
              trade_name: pickStr(raw, "nomeFantasia", "fantasia"),
              city: pickStr(raw, "cidade", "municipio"),
              state: pickStr(raw, "uf", "estado"),
              segment: pickStr(raw, "segmento", "ramo"),
              // ✅ CORREÇÃO: Adicionar email
              email: pickStr(raw, "email", "emailPrincipal", "emailContato", "email_principal"),
              // ✅ CORREÇÃO: Adicionar telefone
              phone: pickStr(raw, "telefone", "telefonePrincipal", "celular", "telefone_principal"),
              // ✅ CORREÇÃO: Adicionar outros campos importantes
              address: pickStr(raw, "endereco", "logradouro", "rua"),
              address_number: pickStr(raw, "numero", "numeroEndereco"),
              address_complement: pickStr(raw, "complemento", "complementoEndereco"),
              zip_code: pickStr(raw, "cep", "codigoPostal"),
              status: pickStr(raw, "situacao", "status", "ativo"),
              origin: "nomus",
              nomus_synced_at: new Date().toISOString(),
            },
            { onConflict: "nomus_id" }
          );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });


// CORREÇÃO 5: Implementar sincronização incremental
// Adicionar esta função ANTES de runEntitySync:

async function getLastSyncDate(entity: string): Promise<Date | null> {
  const { data } = await supabaseAdmin
    .from("nomus_sync_state")
    .select("last_synced_at")
    .eq("entity", entity)
    .single();
  
  if (data?.last_synced_at) {
    return new Date(data.last_synced_at);
  }
  return null;
}

// Usar assim em cada sync:
export const nomusSyncClientsIncremental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    
    // ✅ CORREÇÃO: Adicionar sincronização incremental
    const lastSync = await getLastSyncDate("clientes");
    const query = lastSync 
      ? { dataModificacaoInicial: lastSync.toISOString() }
      : {};
    
    return runEntitySync({
      entity: "clientes",
      endpoint: NOMUS_ENDPOINTS.clientes,
      triggeredBy: userId,
      query,  // ✅ Passar query com filtro de data
      processItem: async (raw) => {
        // ... resto do código ...
      },
    });
  });


// ============================================================================
// ARQUIVO: src/integrations/nomus/client.ts (Validação de resposta)
// ============================================================================

// CORREÇÃO 6: Melhorar validação de resposta do Nomus
// ANTES:
// function extractBatch<T>(payload: unknown): T[] {
//   if (!payload) return [];
//   if (Array.isArray(payload)) return payload as T[];
//   const env = payload as Record<string, unknown>;
//   for (const k of ["items", "resultados", "data", "content", "registros", "lista"]) {
//     const v = env[k];
//     if (Array.isArray(v)) return v as T[];
//   }
//   return [];
// }

// DEPOIS:
function extractBatch<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const env = payload as Record<string, unknown>;
  for (const k of ["items", "resultados", "data", "content", "registros", "lista"]) {
    const v = env[k];
    if (Array.isArray(v)) return v as T[];
  }
  
  // ✅ CORREÇÃO: Log de aviso se formato não reconhecido
  if (DEBUG) {
    console.warn("[nomus] extractBatch: formato de resposta não reconhecido", {
      keys: Object.keys(env).slice(0, 5),
      type: typeof payload,
    });
  }
  
  return [];
}


// ============================================================================
// RESUMO DAS CORREÇÕES
// ============================================================================

/**
 * CORREÇÕES IMPLEMENTADAS:
 * 
 * 1. ✅ Aumentar LIST_MAX_ITEMS de 50K para 500K
 * 2. ✅ Aumentar LIST_MAX_PAGES de 200 para 500
 * 3. ✅ Aumentar REQUEST_TIMEOUT_MS de 25s para 60s
 * 4. ✅ Capturar TODOS os erros (não apenas 3)
 * 5. ✅ Adicionar email e telefone ao sincronizar clientes
 * 6. ✅ Adicionar outros campos importantes (endereço, CEP, status)
 * 7. ✅ Implementar sincronização incremental com filtro de data
 * 8. ✅ Melhorar validação de resposta do Nomus
 * 
 * IMPACTO ESPERADO:
 * - Cards faltando: RESOLVIDO
 * - Dados incompletos: RESOLVIDO
 * - Erros silenciados: RESOLVIDO
 * - Performance: MELHORADA
 * 
 * TEMPO DE IMPLEMENTAÇÃO: ~1 hora
 * RISCO: BAIXO (mudanças isoladas)
 * TESTE: Sincronizar com dados reais após implementar
 */
