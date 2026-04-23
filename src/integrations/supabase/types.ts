export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          insight_type: string
          metadata: Json | null
          prompt_hash: string | null
          proposal_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          insight_type: string
          metadata?: Json | null
          prompt_hash?: string | null
          proposal_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insight_type?: string
          metadata?: Json | null
          prompt_hash?: string | null
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          nomus_id: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          nomus_id?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          nomus_id?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          document: string | null
          id: string
          is_active: boolean
          name: string
          nomus_id: string | null
          nomus_synced_at: string | null
          notes: string | null
          origin: string | null
          region: string | null
          segment: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          id?: string
          is_active?: boolean
          name: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          notes?: string | null
          origin?: string | null
          region?: string | null
          segment?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          notes?: string | null
          origin?: string | null
          region?: string | null
          segment?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          competitive_lines: string[] | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          perceived_lead_time: string | null
          perceived_strengths: string | null
          perceived_weaknesses: string | null
          price_positioning: string | null
          region: string | null
          strategic_notes: string | null
          strong_segments: string[] | null
          updated_at: string
        }
        Insert: {
          competitive_lines?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          perceived_lead_time?: string | null
          perceived_strengths?: string | null
          perceived_weaknesses?: string | null
          price_positioning?: string | null
          region?: string | null
          strategic_notes?: string | null
          strong_segments?: string[] | null
          updated_at?: string
        }
        Update: {
          competitive_lines?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          perceived_lead_time?: string | null
          perceived_strengths?: string | null
          perceived_weaknesses?: string | null
          price_positioning?: string | null
          region?: string | null
          strategic_notes?: string | null
          strong_segments?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          competitor_id: string | null
          created_at: string
          equipment_id: string | null
          extracted_text: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          name: string
          proposal_id: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          competitor_id?: string | null
          created_at?: string
          equipment_id?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          name: string
          proposal_id?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          competitor_id?: string | null
          created_at?: string
          equipment_id?: string | null
          extracted_text?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          name?: string
          proposal_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_lines: {
        Row: {
          application: string | null
          code: string
          created_at: string
          description: string | null
          family: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          application?: string | null
          code: string
          created_at?: string
          description?: string | null
          family?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          application?: string | null
          code?: string
          created_at?: string
          description?: string | null
          family?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      equipment_performance_curves: {
        Row: {
          application: string | null
          chamber_humidity: number | null
          chamber_temperature: number | null
          condensation_temperature: number | null
          cooling_capacity: number | null
          created_at: string
          equipment_id: string
          evaporation_temperature: number | null
          id: string
          notes: string | null
          rejected_heat: number | null
        }
        Insert: {
          application?: string | null
          chamber_humidity?: number | null
          chamber_temperature?: number | null
          condensation_temperature?: number | null
          cooling_capacity?: number | null
          created_at?: string
          equipment_id: string
          evaporation_temperature?: number | null
          id?: string
          notes?: string | null
          rejected_heat?: number | null
        }
        Update: {
          application?: string | null
          chamber_humidity?: number | null
          chamber_temperature?: number | null
          condensation_temperature?: number | null
          cooling_capacity?: number | null
          created_at?: string
          equipment_id?: string
          evaporation_temperature?: number | null
          id?: string
          notes?: string | null
          rejected_heat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_performance_curves_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipments: {
        Row: {
          application: string | null
          cabinet: string | null
          cabinet_type: string | null
          compressor_bitzer: string | null
          compressor_copeland: string | null
          compressor_danfoss_bock: string | null
          compressor_dorin: string | null
          condenser_fan: string | null
          condenser_fan_flow: number | null
          condenser_model: string | null
          created_at: string
          evaporator_fan: string | null
          evaporator_fan_flow: number | null
          evaporator_model: string | null
          id: string
          is_active: boolean
          line_id: string | null
          model: string
          nomus_id: string | null
          nomus_synced_at: string | null
          refrigerant: string | null
          tags: string[] | null
          technical_notes: string | null
          updated_at: string
          voltage: string | null
        }
        Insert: {
          application?: string | null
          cabinet?: string | null
          cabinet_type?: string | null
          compressor_bitzer?: string | null
          compressor_copeland?: string | null
          compressor_danfoss_bock?: string | null
          compressor_dorin?: string | null
          condenser_fan?: string | null
          condenser_fan_flow?: number | null
          condenser_model?: string | null
          created_at?: string
          evaporator_fan?: string | null
          evaporator_fan_flow?: number | null
          evaporator_model?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          model: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          refrigerant?: string | null
          tags?: string[] | null
          technical_notes?: string | null
          updated_at?: string
          voltage?: string | null
        }
        Update: {
          application?: string | null
          cabinet?: string | null
          cabinet_type?: string | null
          compressor_bitzer?: string | null
          compressor_copeland?: string | null
          compressor_danfoss_bock?: string | null
          compressor_dorin?: string | null
          condenser_fan?: string | null
          condenser_fan_flow?: number | null
          condenser_model?: string | null
          created_at?: string
          evaporator_fan?: string | null
          evaporator_fan_flow?: number | null
          evaporator_model?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          model?: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          refrigerant?: string | null
          tags?: string[] | null
          technical_notes?: string | null
          updated_at?: string
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "equipment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_api_catalog: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          endpoint_path: string
          fields: Json
          http_method: string
          id: string
          is_used_in_app: boolean
          last_verified_at: string | null
          module_key: string
          module_name: string
          notes: string | null
          observed_count: number | null
          record_type: string | null
          sample_payload: Json | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint_path: string
          fields?: Json
          http_method?: string
          id?: string
          is_used_in_app?: boolean
          last_verified_at?: string | null
          module_key: string
          module_name: string
          notes?: string | null
          observed_count?: number | null
          record_type?: string | null
          sample_payload?: Json | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint_path?: string
          fields?: Json
          http_method?: string
          id?: string
          is_used_in_app?: boolean
          last_verified_at?: string | null
          module_key?: string
          module_name?: string
          notes?: string | null
          observed_count?: number | null
          record_type?: string | null
          sample_payload?: Json | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      nomus_cost_imports: {
        Row: {
          filename: string
          id: string
          imported_at: string
          imported_by: string | null
          inserted_count: number
          notes: string | null
          price_table_id: string
          skipped_count: number
          total_rows: number
          updated_count: number
          with_cost_count: number
        }
        Insert: {
          filename: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          inserted_count?: number
          notes?: string | null
          price_table_id: string
          skipped_count?: number
          total_rows?: number
          updated_count?: number
          with_cost_count?: number
        }
        Update: {
          filename?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          inserted_count?: number
          notes?: string | null
          price_table_id?: string
          skipped_count?: number
          total_rows?: number
          updated_count?: number
          with_cost_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "nomus_cost_imports_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_invoices: {
        Row: {
          chave_acesso: string | null
          cliente_nomus_id: string | null
          data_emissao: string | null
          id: string
          nomus_id: string
          numero: string | null
          pedido_nomus_id: string | null
          raw: Json | null
          serie: string | null
          status_nomus: string | null
          synced_at: string
          valor_total: number | null
        }
        Insert: {
          chave_acesso?: string | null
          cliente_nomus_id?: string | null
          data_emissao?: string | null
          id?: string
          nomus_id: string
          numero?: string | null
          pedido_nomus_id?: string | null
          raw?: Json | null
          serie?: string | null
          status_nomus?: string | null
          synced_at?: string
          valor_total?: number | null
        }
        Update: {
          chave_acesso?: string | null
          cliente_nomus_id?: string | null
          data_emissao?: string | null
          id?: string
          nomus_id?: string
          numero?: string | null
          pedido_nomus_id?: string | null
          raw?: Json | null
          serie?: string | null
          status_nomus?: string | null
          synced_at?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      nomus_payment_terms: {
        Row: {
          code: string | null
          days_first_installment: number | null
          id: string
          installments: number | null
          interval_days: number | null
          is_active: boolean
          name: string
          nomus_id: string
          raw: Json | null
          synced_at: string
        }
        Insert: {
          code?: string | null
          days_first_installment?: number | null
          id?: string
          installments?: number | null
          interval_days?: number | null
          is_active?: boolean
          name: string
          nomus_id: string
          raw?: Json | null
          synced_at?: string
        }
        Update: {
          code?: string | null
          days_first_installment?: number | null
          id?: string
          installments?: number | null
          interval_days?: number | null
          is_active?: boolean
          name?: string
          nomus_id?: string
          raw?: Json | null
          synced_at?: string
        }
        Relationships: []
      }
      nomus_pedido_items: {
        Row: {
          description: string | null
          id: string
          nomus_item_id: string | null
          nomus_pedido_id: string
          nomus_product_id: string | null
          product_code: string | null
          quantity: number | null
          raw: Json | null
          synced_at: string
          total: number | null
          unit_price: number | null
        }
        Insert: {
          description?: string | null
          id?: string
          nomus_item_id?: string | null
          nomus_pedido_id: string
          nomus_product_id?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          synced_at?: string
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          description?: string | null
          id?: string
          nomus_item_id?: string | null
          nomus_pedido_id?: string
          nomus_product_id?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          synced_at?: string
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nomus_pedido_items_nomus_pedido_id_fkey"
            columns: ["nomus_pedido_id"]
            isOneToOne: false
            referencedRelation: "nomus_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_pedidos: {
        Row: {
          cliente_nomus_id: string | null
          data_emissao: string | null
          data_entrega: string | null
          id: string
          nomus_id: string
          numero: string | null
          proposal_nomus_id: string | null
          raw: Json | null
          status_nomus: string | null
          synced_at: string
          valor_total: number | null
          vendedor_nomus_id: string | null
        }
        Insert: {
          cliente_nomus_id?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          id?: string
          nomus_id: string
          numero?: string | null
          proposal_nomus_id?: string | null
          raw?: Json | null
          status_nomus?: string | null
          synced_at?: string
          valor_total?: number | null
          vendedor_nomus_id?: string | null
        }
        Update: {
          cliente_nomus_id?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          id?: string
          nomus_id?: string
          numero?: string | null
          proposal_nomus_id?: string | null
          raw?: Json | null
          status_nomus?: string | null
          synced_at?: string
          valor_total?: number | null
          vendedor_nomus_id?: string | null
        }
        Relationships: []
      }
      nomus_price_table_items: {
        Row: {
          currency: string | null
          custo_cif: number | null
          custo_materiais: number | null
          custo_mod: number | null
          custo_producao_total: number | null
          custos_adm: number | null
          custos_venda: number | null
          equipment_id: string | null
          has_cost_data: boolean
          id: string
          import_source: string | null
          imported_at: string | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_contribuicao: number | null
          margem_desejada_pct: number | null
          nomus_product_id: string
          preco_calculado: number | null
          preco_liquido: number | null
          price_table_id: string
          raw: Json | null
          synced_at: string
          unidade_medida: string | null
          unit_price: number
        }
        Insert: {
          currency?: string | null
          custo_cif?: number | null
          custo_materiais?: number | null
          custo_mod?: number | null
          custo_producao_total?: number | null
          custos_adm?: number | null
          custos_venda?: number | null
          equipment_id?: string | null
          has_cost_data?: boolean
          id?: string
          import_source?: string | null
          imported_at?: string | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_contribuicao?: number | null
          margem_desejada_pct?: number | null
          nomus_product_id: string
          preco_calculado?: number | null
          preco_liquido?: number | null
          price_table_id: string
          raw?: Json | null
          synced_at?: string
          unidade_medida?: string | null
          unit_price: number
        }
        Update: {
          currency?: string | null
          custo_cif?: number | null
          custo_materiais?: number | null
          custo_mod?: number | null
          custo_producao_total?: number | null
          custos_adm?: number | null
          custos_venda?: number | null
          equipment_id?: string | null
          has_cost_data?: boolean
          id?: string
          import_source?: string | null
          imported_at?: string | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_contribuicao?: number | null
          margem_desejada_pct?: number | null
          nomus_product_id?: string
          preco_calculado?: number | null
          preco_liquido?: number | null
          price_table_id?: string
          raw?: Json | null
          synced_at?: string
          unidade_medida?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "nomus_price_table_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomus_price_table_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_price_tables: {
        Row: {
          code: string | null
          currency: string | null
          id: string
          is_active: boolean
          name: string
          nomus_id: string
          raw: Json | null
          synced_at: string
        }
        Insert: {
          code?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          name: string
          nomus_id: string
          raw?: Json | null
          synced_at?: string
        }
        Update: {
          code?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nomus_id?: string
          raw?: Json | null
          synced_at?: string
        }
        Relationships: []
      }
      nomus_proposal_items: {
        Row: {
          additional_info: string | null
          analise_lucro: Json | null
          description: string | null
          discount: number | null
          id: string
          impostos: Json | null
          item_status: string | null
          nomus_item_id: string | null
          nomus_product_id: string | null
          nomus_proposal_id: string
          position: number | null
          prazo_entrega_dias: number | null
          product_code: string | null
          quantity: number | null
          raw: Json | null
          synced_at: string
          total: number | null
          total_with_discount: number | null
          unit_price: number | null
          unit_value_with_unit: string | null
        }
        Insert: {
          additional_info?: string | null
          analise_lucro?: Json | null
          description?: string | null
          discount?: number | null
          id?: string
          impostos?: Json | null
          item_status?: string | null
          nomus_item_id?: string | null
          nomus_product_id?: string | null
          nomus_proposal_id: string
          position?: number | null
          prazo_entrega_dias?: number | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          synced_at?: string
          total?: number | null
          total_with_discount?: number | null
          unit_price?: number | null
          unit_value_with_unit?: string | null
        }
        Update: {
          additional_info?: string | null
          analise_lucro?: Json | null
          description?: string | null
          discount?: number | null
          id?: string
          impostos?: Json | null
          item_status?: string | null
          nomus_item_id?: string | null
          nomus_product_id?: string | null
          nomus_proposal_id?: string
          position?: number | null
          prazo_entrega_dias?: number | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          synced_at?: string
          total?: number | null
          total_with_discount?: number | null
          unit_price?: number | null
          unit_value_with_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nomus_proposal_items_nomus_proposal_id_fkey"
            columns: ["nomus_proposal_id"]
            isOneToOne: false
            referencedRelation: "nomus_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_proposals: {
        Row: {
          cbs_recolher: number | null
          cliente_nome: string | null
          cliente_nomus_id: string | null
          cofins_recolher: number | null
          comissoes_venda: number | null
          condicao_pagamento_nome: string | null
          condicao_pagamento_nomus_id: string | null
          contato_nome: string | null
          contato_nomus_id: string | null
          criada_em_nomus: string | null
          criada_por_nomus: string | null
          custos_administrativos: number | null
          custos_cif: number | null
          custos_incidentes_lucro: number | null
          custos_materiais: number | null
          custos_mod: number | null
          custos_producao: number | null
          data_emissao: string | null
          despesas_acessorias: number | null
          detail_synced_at: string | null
          empresa_nome: string | null
          empresa_nomus_id: string | null
          frete_percentual: number | null
          frete_valor: number | null
          ibs_estadual_recolher: number | null
          ibs_recolher: number | null
          icms_recolher: number | null
          icms_st_recolher: number | null
          id: string
          ipi_recolher: number | null
          issqn_recolher: number | null
          layout_pdf: string | null
          lucro_antes_impostos: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_bruta_pct: number | null
          margem_liquida_pct: number | null
          nomus_id: string
          numero: string | null
          observacoes: string | null
          pedido_compra_cliente: string | null
          pis_recolher: number | null
          prazo_entrega_dias: number | null
          raw: Json | null
          representante_nome: string | null
          representante_nomus_id: string | null
          seguros_valor: number | null
          simples_nacional_recolher: number | null
          status_nomus: string | null
          synced_at: string
          tabela_preco_nome: string | null
          tabela_preco_nomus_id: string | null
          tipo_movimentacao: string | null
          total_tributacao: Json | null
          validade: string | null
          valor_descontos: number | null
          valor_liquido: number | null
          valor_produtos: number | null
          valor_total: number | null
          valor_total_com_desconto: number | null
          vendedor_nome: string | null
          vendedor_nomus_id: string | null
        }
        Insert: {
          cbs_recolher?: number | null
          cliente_nome?: string | null
          cliente_nomus_id?: string | null
          cofins_recolher?: number | null
          comissoes_venda?: number | null
          condicao_pagamento_nome?: string | null
          condicao_pagamento_nomus_id?: string | null
          contato_nome?: string | null
          contato_nomus_id?: string | null
          criada_em_nomus?: string | null
          criada_por_nomus?: string | null
          custos_administrativos?: number | null
          custos_cif?: number | null
          custos_incidentes_lucro?: number | null
          custos_materiais?: number | null
          custos_mod?: number | null
          custos_producao?: number | null
          data_emissao?: string | null
          despesas_acessorias?: number | null
          detail_synced_at?: string | null
          empresa_nome?: string | null
          empresa_nomus_id?: string | null
          frete_percentual?: number | null
          frete_valor?: number | null
          ibs_estadual_recolher?: number | null
          ibs_recolher?: number | null
          icms_recolher?: number | null
          icms_st_recolher?: number | null
          id?: string
          ipi_recolher?: number | null
          issqn_recolher?: number | null
          layout_pdf?: string | null
          lucro_antes_impostos?: number | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_bruta_pct?: number | null
          margem_liquida_pct?: number | null
          nomus_id: string
          numero?: string | null
          observacoes?: string | null
          pedido_compra_cliente?: string | null
          pis_recolher?: number | null
          prazo_entrega_dias?: number | null
          raw?: Json | null
          representante_nome?: string | null
          representante_nomus_id?: string | null
          seguros_valor?: number | null
          simples_nacional_recolher?: number | null
          status_nomus?: string | null
          synced_at?: string
          tabela_preco_nome?: string | null
          tabela_preco_nomus_id?: string | null
          tipo_movimentacao?: string | null
          total_tributacao?: Json | null
          validade?: string | null
          valor_descontos?: number | null
          valor_liquido?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          valor_total_com_desconto?: number | null
          vendedor_nome?: string | null
          vendedor_nomus_id?: string | null
        }
        Update: {
          cbs_recolher?: number | null
          cliente_nome?: string | null
          cliente_nomus_id?: string | null
          cofins_recolher?: number | null
          comissoes_venda?: number | null
          condicao_pagamento_nome?: string | null
          condicao_pagamento_nomus_id?: string | null
          contato_nome?: string | null
          contato_nomus_id?: string | null
          criada_em_nomus?: string | null
          criada_por_nomus?: string | null
          custos_administrativos?: number | null
          custos_cif?: number | null
          custos_incidentes_lucro?: number | null
          custos_materiais?: number | null
          custos_mod?: number | null
          custos_producao?: number | null
          data_emissao?: string | null
          despesas_acessorias?: number | null
          detail_synced_at?: string | null
          empresa_nome?: string | null
          empresa_nomus_id?: string | null
          frete_percentual?: number | null
          frete_valor?: number | null
          ibs_estadual_recolher?: number | null
          ibs_recolher?: number | null
          icms_recolher?: number | null
          icms_st_recolher?: number | null
          id?: string
          ipi_recolher?: number | null
          issqn_recolher?: number | null
          layout_pdf?: string | null
          lucro_antes_impostos?: number | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_bruta_pct?: number | null
          margem_liquida_pct?: number | null
          nomus_id?: string
          numero?: string | null
          observacoes?: string | null
          pedido_compra_cliente?: string | null
          pis_recolher?: number | null
          prazo_entrega_dias?: number | null
          raw?: Json | null
          representante_nome?: string | null
          representante_nomus_id?: string | null
          seguros_valor?: number | null
          simples_nacional_recolher?: number | null
          status_nomus?: string | null
          synced_at?: string
          tabela_preco_nome?: string | null
          tabela_preco_nomus_id?: string | null
          tipo_movimentacao?: string | null
          total_tributacao?: Json | null
          validade?: string | null
          valor_descontos?: number | null
          valor_liquido?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          valor_total_com_desconto?: number | null
          vendedor_nome?: string | null
          vendedor_nomus_id?: string | null
        }
        Relationships: []
      }
      nomus_receivables: {
        Row: {
          cliente_nomus_id: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id: string
          invoice_nomus_id: string | null
          nomus_id: string
          raw: Json | null
          status_nomus: string | null
          synced_at: string
          valor: number | null
        }
        Insert: {
          cliente_nomus_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          invoice_nomus_id?: string | null
          nomus_id: string
          raw?: Json | null
          status_nomus?: string | null
          synced_at?: string
          valor?: number | null
        }
        Update: {
          cliente_nomus_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          invoice_nomus_id?: string | null
          nomus_id?: string
          raw?: Json | null
          status_nomus?: string | null
          synced_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      nomus_representatives: {
        Row: {
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          nomus_id: string
          raw: Json | null
          region: string | null
          synced_at: string
        }
        Insert: {
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          nomus_id: string
          raw?: Json | null
          region?: string | null
          synced_at?: string
        }
        Update: {
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nomus_id?: string
          raw?: Json | null
          region?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      nomus_sellers: {
        Row: {
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          nomus_id: string
          raw: Json | null
          synced_at: string
        }
        Insert: {
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          nomus_id: string
          raw?: Json | null
          synced_at?: string
        }
        Update: {
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nomus_id?: string
          raw?: Json | null
          synced_at?: string
        }
        Relationships: []
      }
      nomus_settings: {
        Row: {
          auto_create_local_proposal: boolean
          auto_create_pedido_on_won: boolean
          auto_mark_won_on_pedido: boolean
          auto_push_followups: boolean
          auto_push_proposals: boolean
          base_url: string | null
          clients_direction: string
          created_at: string
          id: string
          is_enabled: boolean
          last_full_sync_at: string | null
          proposals_direction: string
          sync_clients: boolean
          sync_contacts: boolean
          sync_invoices: boolean
          sync_payment_terms: boolean
          sync_pedidos: boolean
          sync_price_tables: boolean
          sync_products: boolean
          sync_proposals: boolean
          sync_proposals_pull_interval_minutes: number
          sync_representatives: boolean
          sync_sellers: boolean
          updated_at: string
        }
        Insert: {
          auto_create_local_proposal?: boolean
          auto_create_pedido_on_won?: boolean
          auto_mark_won_on_pedido?: boolean
          auto_push_followups?: boolean
          auto_push_proposals?: boolean
          base_url?: string | null
          clients_direction?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_full_sync_at?: string | null
          proposals_direction?: string
          sync_clients?: boolean
          sync_contacts?: boolean
          sync_invoices?: boolean
          sync_payment_terms?: boolean
          sync_pedidos?: boolean
          sync_price_tables?: boolean
          sync_products?: boolean
          sync_proposals?: boolean
          sync_proposals_pull_interval_minutes?: number
          sync_representatives?: boolean
          sync_sellers?: boolean
          updated_at?: string
        }
        Update: {
          auto_create_local_proposal?: boolean
          auto_create_pedido_on_won?: boolean
          auto_mark_won_on_pedido?: boolean
          auto_push_followups?: boolean
          auto_push_proposals?: boolean
          base_url?: string | null
          clients_direction?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_full_sync_at?: string | null
          proposals_direction?: string
          sync_clients?: boolean
          sync_contacts?: boolean
          sync_invoices?: boolean
          sync_payment_terms?: boolean
          sync_pedidos?: boolean
          sync_price_tables?: boolean
          sync_products?: boolean
          sync_proposals?: boolean
          sync_proposals_pull_interval_minutes?: number
          sync_representatives?: boolean
          sync_sellers?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      nomus_sync_log: {
        Row: {
          created_at: string
          direction: string
          duration_ms: number | null
          entity: string
          error: string | null
          http_status: number | null
          id: string
          operation: string
          payload: Json | null
          request_path: string | null
          response: Json | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          duration_ms?: number | null
          entity: string
          error?: string | null
          http_status?: number | null
          id?: string
          operation: string
          payload?: Json | null
          request_path?: string | null
          response?: Json | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          duration_ms?: number | null
          entity?: string
          error?: string | null
          http_status?: number | null
          id?: string
          operation?: string
          payload?: Json | null
          request_path?: string | null
          response?: Json | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      nomus_sync_state: {
        Row: {
          entity: string
          last_cursor: string | null
          last_error: string | null
          last_synced_at: string | null
          running: boolean
          total_synced: number
          updated_at: string
        }
        Insert: {
          entity: string
          last_cursor?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          running?: boolean
          total_synced?: number
          updated_at?: string
        }
        Update: {
          entity?: string
          last_cursor?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          running?: boolean
          total_synced?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          job_title: string | null
          nomus_vendedor_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          job_title?: string | null
          nomus_vendedor_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string | null
          nomus_vendedor_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_competitors: {
        Row: {
          competitor_id: string
          competitor_lead_time: string | null
          competitor_payment_terms: string | null
          competitor_price: number | null
          competitor_solution: string | null
          competitor_warranty: string | null
          created_at: string
          differentials: string | null
          id: string
          notes: string | null
          outcome: string | null
          proposal_id: string
        }
        Insert: {
          competitor_id: string
          competitor_lead_time?: string | null
          competitor_payment_terms?: string | null
          competitor_price?: number | null
          competitor_solution?: string | null
          competitor_warranty?: string | null
          created_at?: string
          differentials?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          proposal_id: string
        }
        Update: {
          competitor_id?: string
          competitor_lead_time?: string | null
          competitor_payment_terms?: string | null
          competitor_price?: number | null
          competitor_solution?: string | null
          competitor_warranty?: string | null
          created_at?: string
          differentials?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_competitors_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_competitors_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_document_assets: {
        Row: {
          id: string
          kind: string
          mime_type: string | null
          proposal_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          kind: string
          mime_type?: string | null
          proposal_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          kind?: string
          mime_type?: string | null
          proposal_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_document_assets_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_documents: {
        Row: {
          attached_pdf_paths: string[]
          auto_filled_at: string | null
          context_data: Json
          cover_data: Json
          created_at: string
          custom_blocks: Json
          id: string
          last_edited_at: string
          last_edited_by: string | null
          manually_edited_fields: string[]
          pages: Json
          proposal_id: string
          scope_items: Json
          solution_data: Json
          template_id: string | null
          template_version: string
          updated_at: string
          warranty_text: Json
        }
        Insert: {
          attached_pdf_paths?: string[]
          auto_filled_at?: string | null
          context_data?: Json
          cover_data?: Json
          created_at?: string
          custom_blocks?: Json
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          manually_edited_fields?: string[]
          pages?: Json
          proposal_id: string
          scope_items?: Json
          solution_data?: Json
          template_id?: string | null
          template_version?: string
          updated_at?: string
          warranty_text?: Json
        }
        Update: {
          attached_pdf_paths?: string[]
          auto_filled_at?: string | null
          context_data?: Json
          cover_data?: Json
          created_at?: string
          custom_blocks?: Json
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          manually_edited_fields?: string[]
          pages?: Json
          proposal_id?: string
          scope_items?: Json
          solution_data?: Json
          template_id?: string | null
          template_version?: string
          updated_at?: string
          warranty_text?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proposal_documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string
          equipment_id: string | null
          id: string
          notes: string | null
          position: number | null
          proposal_id: string
          quantity: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          proposal_id: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          proposal_id?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_send_events: {
        Row: {
          channel: string
          delivery_status: string
          id: string
          message: string | null
          metadata: Json | null
          opened_at: string | null
          proposal_id: string
          recipient: string | null
          sent_at: string
          sent_by: string | null
          subject: string | null
          version_id: string | null
        }
        Insert: {
          channel: string
          delivery_status?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          opened_at?: string | null
          proposal_id: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string | null
          version_id?: string | null
        }
        Update: {
          channel?: string
          delivery_status?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          opened_at?: string | null
          proposal_id?: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_send_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_send_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "proposal_send_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_send_versions: {
        Row: {
          document_snapshot: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          is_current: boolean
          metadata: Json
          notes: string | null
          pdf_storage_path: string
          proposal_id: string
          proposal_snapshot: Json
          tables_snapshot: Json
          template_snapshot: Json | null
          version_number: number
        }
        Insert: {
          document_snapshot?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_current?: boolean
          metadata?: Json
          notes?: string | null
          pdf_storage_path: string
          proposal_id: string
          proposal_snapshot?: Json
          tables_snapshot?: Json
          template_snapshot?: Json | null
          version_number: number
        }
        Update: {
          document_snapshot?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_current?: boolean
          metadata?: Json
          notes?: string | null
          pdf_storage_path?: string
          proposal_id?: string
          proposal_snapshot?: Json
          tables_snapshot?: Json
          template_snapshot?: Json | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_send_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["proposal_status"] | null
          id: string
          notes: string | null
          proposal_id: string
          to_status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["proposal_status"] | null
          id?: string
          notes?: string | null
          proposal_id: string
          to_status: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["proposal_status"] | null
          id?: string
          notes?: string | null
          proposal_id?: string
          to_status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "proposal_status_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_tables: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          page_id: string | null
          proposal_id: string
          rows: Json
          settings: Json
          sort_order: number
          subtitle: string | null
          table_type: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          page_id?: string | null
          proposal_id: string
          rows?: Json
          settings?: Json
          sort_order?: number
          subtitle?: string | null
          table_type: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          page_id?: string | null
          proposal_id?: string
          rows?: Json
          settings?: Json
          sort_order?: number
          subtitle?: string | null
          table_type?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_tables_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          proposal_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_tasks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_template_assets: {
        Row: {
          asset_kind: string
          id: string
          label: string | null
          mime_type: string | null
          position: number | null
          size_bytes: number | null
          storage_path: string
          template_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_kind: string
          id?: string
          label?: string | null
          mime_type?: string | null
          position?: number | null
          size_bytes?: number | null
          storage_path: string
          template_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_kind?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          position?: number | null
          size_bytes?: number | null
          storage_path?: string
          template_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_template_assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          accent_color: string
          accent_color_2: string
          capa_subtitulo: string | null
          capa_tagline: string | null
          capa_titulo: string | null
          cases_itens: Json
          cases_subtitulo: string | null
          cases_titulo: string | null
          clientes_lista: Json
          clientes_titulo: string | null
          created_at: string
          created_by: string | null
          dados_bancarios: Json
          description: string | null
          empresa_cidade: string
          empresa_email: string
          empresa_nome: string
          empresa_site: string
          empresa_telefone: string
          escopo_apresentacao_itens: Json
          garantia_itens: Json
          garantia_texto: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          pages_config: Json
          prazo_entrega_padrao: string | null
          primary_color: string
          sobre_diferenciais: Json
          sobre_paragrafos: Json
          sobre_titulo: string | null
          updated_at: string
          validade_padrao_dias: number | null
        }
        Insert: {
          accent_color?: string
          accent_color_2?: string
          capa_subtitulo?: string | null
          capa_tagline?: string | null
          capa_titulo?: string | null
          cases_itens?: Json
          cases_subtitulo?: string | null
          cases_titulo?: string | null
          clientes_lista?: Json
          clientes_titulo?: string | null
          created_at?: string
          created_by?: string | null
          dados_bancarios?: Json
          description?: string | null
          empresa_cidade?: string
          empresa_email?: string
          empresa_nome?: string
          empresa_site?: string
          empresa_telefone?: string
          escopo_apresentacao_itens?: Json
          garantia_itens?: Json
          garantia_texto?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          pages_config?: Json
          prazo_entrega_padrao?: string | null
          primary_color?: string
          sobre_diferenciais?: Json
          sobre_paragrafos?: Json
          sobre_titulo?: string | null
          updated_at?: string
          validade_padrao_dias?: number | null
        }
        Update: {
          accent_color?: string
          accent_color_2?: string
          capa_subtitulo?: string | null
          capa_tagline?: string | null
          capa_titulo?: string | null
          cases_itens?: Json
          cases_subtitulo?: string | null
          cases_titulo?: string | null
          clientes_lista?: Json
          clientes_titulo?: string | null
          created_at?: string
          created_by?: string | null
          dados_bancarios?: Json
          description?: string | null
          empresa_cidade?: string
          empresa_email?: string
          empresa_nome?: string
          empresa_site?: string
          empresa_telefone?: string
          escopo_apresentacao_itens?: Json
          garantia_itens?: Json
          garantia_texto?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          pages_config?: Json
          prazo_entrega_padrao?: string | null
          primary_color?: string
          sobre_diferenciais?: Json
          sobre_paragrafos?: Json
          sobre_titulo?: string | null
          updated_at?: string
          validade_padrao_dias?: number | null
        }
        Relationships: []
      }
      proposal_timeline_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id: string
          metadata: Json | null
          next_contact_date: string | null
          next_step: string | null
          proposal_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json | null
          next_contact_date?: string | null
          next_step?: string | null
          proposal_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json | null
          next_contact_date?: string | null
          next_step?: string | null
          proposal_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_timeline_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          proposal_id: string
          reason: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          proposal_id: string
          reason?: string | null
          snapshot: Json
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          proposal_id?: string
          reason?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          closed_at: string | null
          closed_value: number | null
          commercial_notes: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          current_version: number
          delivery_term: string | null
          discount: number | null
          estimated_margin: number | null
          id: string
          lead_origin: string | null
          loss_reason: string | null
          next_followup_at: string | null
          nomus_id: string | null
          nomus_invoice_ids: string[] | null
          nomus_payment_term_name: string | null
          nomus_pedido_id: string | null
          nomus_price_table_name: string | null
          nomus_proposal_id: string | null
          nomus_seller_name: string | null
          nomus_synced_at: string | null
          number: string
          payment_term_id: string | null
          payment_terms: string | null
          price_table_id: string | null
          region: string | null
          sales_owner_id: string | null
          segment: string | null
          sent_at: string | null
          source: Database["public"]["Enums"]["proposal_source"]
          status: Database["public"]["Enums"]["proposal_status"]
          technical_notes: string | null
          technical_owner_id: string | null
          temperature:
            | Database["public"]["Enums"]["proposal_temperature"]
            | null
          title: string
          total_value: number | null
          updated_at: string
          valid_until: string | null
          win_probability: number | null
          win_reason: string | null
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          closed_value?: number | null
          commercial_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          delivery_term?: string | null
          discount?: number | null
          estimated_margin?: number | null
          id?: string
          lead_origin?: string | null
          loss_reason?: string | null
          next_followup_at?: string | null
          nomus_id?: string | null
          nomus_invoice_ids?: string[] | null
          nomus_payment_term_name?: string | null
          nomus_pedido_id?: string | null
          nomus_price_table_name?: string | null
          nomus_proposal_id?: string | null
          nomus_seller_name?: string | null
          nomus_synced_at?: string | null
          number?: string
          payment_term_id?: string | null
          payment_terms?: string | null
          price_table_id?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
          source?: Database["public"]["Enums"]["proposal_source"]
          status?: Database["public"]["Enums"]["proposal_status"]
          technical_notes?: string | null
          technical_owner_id?: string | null
          temperature?:
            | Database["public"]["Enums"]["proposal_temperature"]
            | null
          title: string
          total_value?: number | null
          updated_at?: string
          valid_until?: string | null
          win_probability?: number | null
          win_reason?: string | null
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          closed_value?: number | null
          commercial_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          delivery_term?: string | null
          discount?: number | null
          estimated_margin?: number | null
          id?: string
          lead_origin?: string | null
          loss_reason?: string | null
          next_followup_at?: string | null
          nomus_id?: string | null
          nomus_invoice_ids?: string[] | null
          nomus_payment_term_name?: string | null
          nomus_pedido_id?: string | null
          nomus_price_table_name?: string | null
          nomus_proposal_id?: string | null
          nomus_seller_name?: string | null
          nomus_synced_at?: string | null
          number?: string
          payment_term_id?: string | null
          payment_terms?: string | null
          price_table_id?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
          source?: Database["public"]["Enums"]["proposal_source"]
          status?: Database["public"]["Enums"]["proposal_status"]
          technical_notes?: string | null
          technical_owner_id?: string | null
          temperature?:
            | Database["public"]["Enums"]["proposal_temperature"]
            | null
          title?: string
          total_value?: number | null
          updated_at?: string
          valid_until?: string | null
          win_probability?: number | null
          win_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "nomus_payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _parse_nomus_date: { Args: { s: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      proposal_table_default_settings: {
        Args: { p_table_type: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "vendedor"
        | "gerente_comercial"
        | "engenharia"
        | "orcamentista"
        | "diretoria"
        | "administrativo"
        | "admin"
      proposal_source: "nomus" | "manual"
      proposal_status:
        | "rascunho"
        | "em_elaboracao"
        | "em_revisao_tecnica"
        | "em_revisao_comercial"
        | "em_revisao_financeira"
        | "aguardando_aprovacao"
        | "pronta_para_envio"
        | "enviada"
        | "visualizada"
        | "aguardando_retorno"
        | "em_negociacao"
        | "revisao_solicitada"
        | "reenviada"
        | "ganha"
        | "perdida"
        | "vencida"
        | "prorrogada"
        | "cancelada"
      proposal_temperature: "fria" | "morna" | "quente" | "muito_quente"
      task_priority: "baixa" | "media" | "alta" | "critica"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      timeline_event_type:
        | "criada"
        | "revisada"
        | "aprovada"
        | "enviada"
        | "visualizada_cliente"
        | "follow_up"
        | "reuniao"
        | "visita_tecnica"
        | "revisao_solicitada"
        | "concorrente_identificado"
        | "renegociada"
        | "ganha"
        | "perdida"
        | "vencida"
        | "prorrogada"
        | "observacao"
        | "tarefa_concluida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "vendedor",
        "gerente_comercial",
        "engenharia",
        "orcamentista",
        "diretoria",
        "administrativo",
        "admin",
      ],
      proposal_source: ["nomus", "manual"],
      proposal_status: [
        "rascunho",
        "em_elaboracao",
        "em_revisao_tecnica",
        "em_revisao_comercial",
        "em_revisao_financeira",
        "aguardando_aprovacao",
        "pronta_para_envio",
        "enviada",
        "visualizada",
        "aguardando_retorno",
        "em_negociacao",
        "revisao_solicitada",
        "reenviada",
        "ganha",
        "perdida",
        "vencida",
        "prorrogada",
        "cancelada",
      ],
      proposal_temperature: ["fria", "morna", "quente", "muito_quente"],
      task_priority: ["baixa", "media", "alta", "critica"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      timeline_event_type: [
        "criada",
        "revisada",
        "aprovada",
        "enviada",
        "visualizada_cliente",
        "follow_up",
        "reuniao",
        "visita_tecnica",
        "revisao_solicitada",
        "concorrente_identificado",
        "renegociada",
        "ganha",
        "perdida",
        "vencida",
        "prorrogada",
        "observacao",
        "tarefa_concluida",
      ],
    },
  },
} as const
