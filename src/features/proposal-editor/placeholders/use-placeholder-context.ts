import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPlaceholderContext,
  type PlaceholderContext,
  type PlaceholderInputs,
} from "@/features/proposal-editor/placeholders";

/**
 * Carrega os dados necessários do navegador (proposta + cliente + contato +
 * vendedor + nomus_proposal + items + template) e devolve um PlaceholderContext
 * pronto para alimentar o resolveString/resolveDeep no preview.
 *
 * Faz tudo via SDK do Supabase no client (RLS aplica). Sem server function,
 * já que o editor já está autenticado.
 */
export function usePlaceholderContext(proposalId: string, templateBundle?: {
  template?: {
    empresa_nome?: string | null;
    empresa_email?: string | null;
    empresa_telefone?: string | null;
    empresa_site?: string | null;
    empresa_cidade?: string | null;
  } | null;
} | null): { context: PlaceholderContext; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["placeholder-context", proposalId],
    queryFn: async (): Promise<PlaceholderInputs> => {
      const { data: prop } = await supabase
        .from("proposals")
        .select(
          "number, title, valid_until, delivery_term, total_value, payment_terms, nomus_payment_term_name, nomus_price_table_name, nomus_seller_name, created_at, nomus_proposal_id, nomus_id, client_id, contact_id, sales_owner_id, clients:client_id(name, trade_name, document, city, state), client_contacts:contact_id(name, email, phone, role)",
        )
        .eq("id", proposalId)
        .maybeSingle();

      const nomusKey = prop?.nomus_proposal_id ?? prop?.nomus_id;
      let nomusProposal = null as PlaceholderInputs["nomusProposal"];
      let nomusItems: PlaceholderInputs["nomusItems"] = [];
      if (nomusKey) {
        const { data: np } = await supabase
          .from("nomus_proposals")
          .select(
            "id, valor_produtos, valor_descontos, valor_total, condicao_pagamento_nome, tabela_preco_nome, vendedor_nome, data_emissao, validade, observacoes, prazo_entrega_dias",
          )
          .eq("nomus_id", nomusKey)
          .maybeSingle();
        if (np) {
          nomusProposal = np as PlaceholderInputs["nomusProposal"];
          const { data: items } = await supabase
            .from("nomus_proposal_items")
            .select("description, quantity, unit_value_with_unit")
            .eq("nomus_proposal_id", (np as { id: string }).id)
            .order("position", { ascending: true });
          nomusItems = (items ?? []) as PlaceholderInputs["nomusItems"];
        }
      }

      let seller: PlaceholderInputs["seller"] = null;
      if (prop?.sales_owner_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, job_title, phone")
          .eq("id", prop.sales_owner_id)
          .maybeSingle();
        if (profile) seller = profile as PlaceholderInputs["seller"];
      }

      return {
        proposal: prop
          ? {
              number: prop.number,
              title: prop.title,
              valid_until: prop.valid_until,
              delivery_term: prop.delivery_term,
              total_value: prop.total_value,
              payment_terms: prop.payment_terms,
              nomus_payment_term_name: prop.nomus_payment_term_name,
              nomus_price_table_name: prop.nomus_price_table_name,
              nomus_seller_name: prop.nomus_seller_name,
              created_at: prop.created_at,
            }
          : null,
        client: (prop?.clients as PlaceholderInputs["client"]) ?? null,
        contact: (prop?.client_contacts as PlaceholderInputs["contact"]) ?? null,
        seller,
        nomusProposal,
        nomusItems,
      };
    },
    staleTime: 30_000,
  });

  const context = useMemo(() => {
    return buildPlaceholderContext({
      ...(data ?? {}),
      template: templateBundle?.template ?? null,
    });
  }, [data, templateBundle?.template]);

  return { context, isLoading };
}
