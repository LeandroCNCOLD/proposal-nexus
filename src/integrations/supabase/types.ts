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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string | null
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
          number: string
          payment_terms: string | null
          region: string | null
          sales_owner_id: string | null
          segment: string | null
          sent_at: string | null
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
          number?: string
          payment_terms?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
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
          number?: string
          payment_terms?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
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
