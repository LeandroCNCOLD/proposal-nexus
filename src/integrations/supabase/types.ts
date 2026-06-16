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
          mobile: string | null
          name: string
          nomus_id: string | null
          nomus_raw: Json | null
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name: string
          nomus_id?: string | null
          nomus_raw?: Json | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name?: string
          nomus_id?: string | null
          nomus_raw?: Json | null
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
          address: string | null
          address_complement: string | null
          address_number: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          district: string | null
          document: string | null
          email: string | null
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          merged_at: string | null
          merged_into_id: string | null
          municipal_registration: string | null
          name: string
          nomus_id: string | null
          nomus_raw: Json | null
          nomus_representative_id: string | null
          nomus_representative_name: string | null
          nomus_seller_id: string | null
          nomus_seller_name: string | null
          nomus_synced_at: string | null
          notes: string | null
          origin: string | null
          phone: string | null
          region: string | null
          segment: string | null
          state: string | null
          state_registration: string | null
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
          trade_name: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          municipal_registration?: string | null
          name: string
          nomus_id?: string | null
          nomus_raw?: Json | null
          nomus_representative_id?: string | null
          nomus_representative_name?: string | null
          nomus_seller_id?: string | null
          nomus_seller_name?: string | null
          nomus_synced_at?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          region?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          municipal_registration?: string | null
          name?: string
          nomus_id?: string | null
          nomus_raw?: Json | null
          nomus_representative_id?: string | null
          nomus_representative_name?: string | null
          nomus_seller_id?: string | null
          nomus_seller_name?: string | null
          nomus_synced_at?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          region?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_advanced_processes: {
        Row: {
          advanced_process_type: string
          air_changes_per_hour: number | null
          air_renewal_m3_h: number | null
          calculation_breakdown: Json | null
          calculation_result: Json | null
          chamber_volume_m3: number | null
          co2_generation_rate_m3_kg_h: number | null
          co2_limit_percent: number | null
          co2_target_percent: number | null
          created_at: string
          environment_id: string | null
          ethylene_exposure_time_h: number | null
          ethylene_renewal_after_application: boolean | null
          ethylene_target_ppm: number | null
          external_co2_percent: number | null
          external_relative_humidity: number | null
          external_temperature_c: number | null
          id: string
          internal_relative_humidity: number | null
          internal_temperature_c: number | null
          o2_target_percent: number | null
          process_time_h: number | null
          product_final_moisture: number | null
          product_id: string | null
          product_initial_moisture: number | null
          product_mass_kg: number | null
          product_name: string | null
          project_id: string
          purge_airflow_m3_h: number | null
          respiration_rate_w_kg: number | null
          scrubber_enabled: boolean | null
          stabilization_time_h: number | null
          storage_time_h: number | null
          target_relative_humidity: number | null
          target_temperature_c: number | null
          technical_notes: string | null
          updated_at: string
        }
        Insert: {
          advanced_process_type?: string
          air_changes_per_hour?: number | null
          air_renewal_m3_h?: number | null
          calculation_breakdown?: Json | null
          calculation_result?: Json | null
          chamber_volume_m3?: number | null
          co2_generation_rate_m3_kg_h?: number | null
          co2_limit_percent?: number | null
          co2_target_percent?: number | null
          created_at?: string
          environment_id?: string | null
          ethylene_exposure_time_h?: number | null
          ethylene_renewal_after_application?: boolean | null
          ethylene_target_ppm?: number | null
          external_co2_percent?: number | null
          external_relative_humidity?: number | null
          external_temperature_c?: number | null
          id?: string
          internal_relative_humidity?: number | null
          internal_temperature_c?: number | null
          o2_target_percent?: number | null
          process_time_h?: number | null
          product_final_moisture?: number | null
          product_id?: string | null
          product_initial_moisture?: number | null
          product_mass_kg?: number | null
          product_name?: string | null
          project_id: string
          purge_airflow_m3_h?: number | null
          respiration_rate_w_kg?: number | null
          scrubber_enabled?: boolean | null
          stabilization_time_h?: number | null
          storage_time_h?: number | null
          target_relative_humidity?: number | null
          target_temperature_c?: number | null
          technical_notes?: string | null
          updated_at?: string
        }
        Update: {
          advanced_process_type?: string
          air_changes_per_hour?: number | null
          air_renewal_m3_h?: number | null
          calculation_breakdown?: Json | null
          calculation_result?: Json | null
          chamber_volume_m3?: number | null
          co2_generation_rate_m3_kg_h?: number | null
          co2_limit_percent?: number | null
          co2_target_percent?: number | null
          created_at?: string
          environment_id?: string | null
          ethylene_exposure_time_h?: number | null
          ethylene_renewal_after_application?: boolean | null
          ethylene_target_ppm?: number | null
          external_co2_percent?: number | null
          external_relative_humidity?: number | null
          external_temperature_c?: number | null
          id?: string
          internal_relative_humidity?: number | null
          internal_temperature_c?: number | null
          o2_target_percent?: number | null
          process_time_h?: number | null
          product_final_moisture?: number | null
          product_id?: string | null
          product_initial_moisture?: number | null
          product_mass_kg?: number | null
          product_name?: string | null
          project_id?: string
          purge_airflow_m3_h?: number | null
          respiration_rate_w_kg?: number | null
          scrubber_enabled?: boolean | null
          stabilization_time_h?: number | null
          storage_time_h?: number | null
          target_relative_humidity?: number | null
          target_temperature_c?: number | null
          technical_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_advanced_processes_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_advanced_processes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "coldpro_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_advanced_processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_booster_models: {
        Row: {
          absorbed_power_kw: number | null
          active: boolean
          air_application_height_m: number | null
          air_throw_m: number | null
          airflow_m3_h: number | null
          created_at: string
          current_220_1f_a: number | null
          current_220_3f_a: number | null
          current_380_3f_a: number | null
          fan_description: string | null
          fan_diameter_mm: number | null
          id: string
          modelo: string
          raw: Json
          source_sheet: string | null
          updated_at: string
          voltage_220_1f_available: boolean
          voltage_220_3f_available: boolean
          voltage_380_3f_available: boolean
        }
        Insert: {
          absorbed_power_kw?: number | null
          active?: boolean
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          created_at?: string
          current_220_1f_a?: number | null
          current_220_3f_a?: number | null
          current_380_3f_a?: number | null
          fan_description?: string | null
          fan_diameter_mm?: number | null
          id?: string
          modelo: string
          raw?: Json
          source_sheet?: string | null
          updated_at?: string
          voltage_220_1f_available?: boolean
          voltage_220_3f_available?: boolean
          voltage_380_3f_available?: boolean
        }
        Update: {
          absorbed_power_kw?: number | null
          active?: boolean
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          created_at?: string
          current_220_1f_a?: number | null
          current_220_3f_a?: number | null
          current_380_3f_a?: number | null
          fan_description?: string | null
          fan_diameter_mm?: number | null
          id?: string
          modelo?: string
          raw?: Json
          source_sheet?: string | null
          updated_at?: string
          voltage_220_1f_available?: boolean
          voltage_220_3f_available?: boolean
          voltage_380_3f_available?: boolean
        }
        Relationships: []
      }
      coldpro_calculation_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          environment_id: string
          id: string
          input_hash: string
          is_baseline: boolean
          label: string
          result_id: string | null
          snapshot_data: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          environment_id: string
          id?: string
          input_hash?: string
          is_baseline?: boolean
          label?: string
          result_id?: string | null
          snapshot_data?: Json
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          environment_id?: string
          id?: string
          input_hash?: string
          is_baseline?: boolean
          label?: string
          result_id?: string | null
          snapshot_data?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_calculation_snapshots_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_calculation_snapshots_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "coldpro_results"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_catalog_import_rows: {
        Row: {
          created_at: string
          equipment_model_id: string | null
          error_message: string | null
          id: string
          import_id: string
          performance_point_id: string | null
          raw_data: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          equipment_model_id?: string | null
          error_message?: string | null
          id?: string
          import_id: string
          performance_point_id?: string | null
          raw_data: Json
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          equipment_model_id?: string | null
          error_message?: string | null
          id?: string
          import_id?: string
          performance_point_id?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_catalog_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "coldpro_catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_catalog_imports: {
        Row: {
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          filename: string
          finished_at: string | null
          id: string
          imported_by: string | null
          models_created: number
          models_updated: number
          performance_points_created: number
          sheet_name: string | null
          skipped_rows: number
          started_at: string | null
          status: string
          summary: Json
          total_rows: number
          valid_rows: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          filename: string
          finished_at?: string | null
          id?: string
          imported_by?: string | null
          models_created?: number
          models_updated?: number
          performance_points_created?: number
          sheet_name?: string | null
          skipped_rows?: number
          started_at?: string | null
          status?: string
          summary?: Json
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          filename?: string
          finished_at?: string | null
          id?: string
          imported_by?: string | null
          models_created?: number
          models_updated?: number
          performance_points_created?: number
          sheet_name?: string | null
          skipped_rows?: number
          started_at?: string | null
          status?: string
          summary?: Json
          total_rows?: number
          valid_rows?: number
        }
        Relationships: []
      }
      coldpro_climate_cache: {
        Row: {
          city_name: string
          created_at: string
          data_period_end: string | null
          data_period_start: string | null
          data_source: string
          humidity_avg_pct: number
          humidity_monthly: Json
          ibge_code: string
          id: string
          latitude: number
          longitude: number
          state_code: string
          temp_avg_c: number
          temp_max_c: number
          temp_min_c: number
          temperatures_monthly: Json
          updated_at: string
        }
        Insert: {
          city_name: string
          created_at?: string
          data_period_end?: string | null
          data_period_start?: string | null
          data_source?: string
          humidity_avg_pct: number
          humidity_monthly: Json
          ibge_code: string
          id?: string
          latitude: number
          longitude: number
          state_code: string
          temp_avg_c: number
          temp_max_c: number
          temp_min_c: number
          temperatures_monthly: Json
          updated_at?: string
        }
        Update: {
          city_name?: string
          created_at?: string
          data_period_end?: string | null
          data_period_start?: string | null
          data_source?: string
          humidity_avg_pct?: number
          humidity_monthly?: Json
          ibge_code?: string
          id?: string
          latitude?: number
          longitude?: number
          state_code?: string
          temp_avg_c?: number
          temp_max_c?: number
          temp_min_c?: number
          temperatures_monthly?: Json
          updated_at?: string
        }
        Relationships: []
      }
      coldpro_environment_products: {
        Row: {
          allow_phase_change: boolean
          ash_content_percent: number | null
          ashrae_density_kg_m3: number | null
          carbohydrate_content_percent: number | null
          characteristic_thickness_m: number | null
          created_at: string
          daily_movement_kg: number
          daily_turnover_percent: number
          default_convective_coefficient_w_m2_k: number | null
          density_kg_m3: number | null
          environment_id: string
          fat_content_percent: number | null
          fiber_content_percent: number | null
          freezable_water_content_percent: number | null
          freezing_batch_mass_kg: number
          freezing_batch_time_h: number
          freezing_temp_c: number | null
          frozen_water_fraction: number | null
          hourly_movement_kg: number
          id: string
          initial_freezing_temp_c: number | null
          inlet_temp_c: number
          is_freezing_inside_storage_room: boolean
          latent_heat_kcal_kg: number
          latent_heat_kj_kg: number | null
          mass_kg_day: number
          mass_kg_hour: number
          movement_basis: string
          notes: string | null
          outlet_temp_c: number
          packaging_inlet_temp_c: number | null
          packaging_mass_kg_day: number
          packaging_outlet_temp_c: number | null
          packaging_specific_heat_kcal_kg_c: number
          process_time_h: number
          product_id: string | null
          product_load_mode: string
          product_name: string
          protein_content_percent: number | null
          recovery_time_h: number
          respiration_rate_0c_mw_kg: number | null
          respiration_rate_0c_w_kg: number | null
          respiration_rate_10c_mw_kg: number | null
          respiration_rate_10c_w_kg: number | null
          respiration_rate_15c_mw_kg: number | null
          respiration_rate_15c_w_kg: number | null
          respiration_rate_20c_mw_kg: number | null
          respiration_rate_20c_w_kg: number | null
          respiration_rate_5c_mw_kg: number | null
          respiration_rate_5c_w_kg: number | null
          specific_heat_above_kcal_kg_c: number
          specific_heat_above_kj_kg_k: number | null
          specific_heat_below_kcal_kg_c: number
          specific_heat_below_kj_kg_k: number | null
          stored_mass_kg: number
          thermal_conductivity_frozen_w_m_k: number | null
          thermal_conductivity_unfrozen_w_m_k: number | null
          water_content_percent: number | null
        }
        Insert: {
          allow_phase_change?: boolean
          ash_content_percent?: number | null
          ashrae_density_kg_m3?: number | null
          carbohydrate_content_percent?: number | null
          characteristic_thickness_m?: number | null
          created_at?: string
          daily_movement_kg?: number
          daily_turnover_percent?: number
          default_convective_coefficient_w_m2_k?: number | null
          density_kg_m3?: number | null
          environment_id: string
          fat_content_percent?: number | null
          fiber_content_percent?: number | null
          freezable_water_content_percent?: number | null
          freezing_batch_mass_kg?: number
          freezing_batch_time_h?: number
          freezing_temp_c?: number | null
          frozen_water_fraction?: number | null
          hourly_movement_kg?: number
          id?: string
          initial_freezing_temp_c?: number | null
          inlet_temp_c?: number
          is_freezing_inside_storage_room?: boolean
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          mass_kg_day?: number
          mass_kg_hour?: number
          movement_basis?: string
          notes?: string | null
          outlet_temp_c?: number
          packaging_inlet_temp_c?: number | null
          packaging_mass_kg_day?: number
          packaging_outlet_temp_c?: number | null
          packaging_specific_heat_kcal_kg_c?: number
          process_time_h?: number
          product_id?: string | null
          product_load_mode?: string
          product_name: string
          protein_content_percent?: number | null
          recovery_time_h?: number
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_0c_w_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_10c_w_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_15c_w_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_20c_w_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          respiration_rate_5c_w_kg?: number | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          stored_mass_kg?: number
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          water_content_percent?: number | null
        }
        Update: {
          allow_phase_change?: boolean
          ash_content_percent?: number | null
          ashrae_density_kg_m3?: number | null
          carbohydrate_content_percent?: number | null
          characteristic_thickness_m?: number | null
          created_at?: string
          daily_movement_kg?: number
          daily_turnover_percent?: number
          default_convective_coefficient_w_m2_k?: number | null
          density_kg_m3?: number | null
          environment_id?: string
          fat_content_percent?: number | null
          fiber_content_percent?: number | null
          freezable_water_content_percent?: number | null
          freezing_batch_mass_kg?: number
          freezing_batch_time_h?: number
          freezing_temp_c?: number | null
          frozen_water_fraction?: number | null
          hourly_movement_kg?: number
          id?: string
          initial_freezing_temp_c?: number | null
          inlet_temp_c?: number
          is_freezing_inside_storage_room?: boolean
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          mass_kg_day?: number
          mass_kg_hour?: number
          movement_basis?: string
          notes?: string | null
          outlet_temp_c?: number
          packaging_inlet_temp_c?: number | null
          packaging_mass_kg_day?: number
          packaging_outlet_temp_c?: number | null
          packaging_specific_heat_kcal_kg_c?: number
          process_time_h?: number
          product_id?: string | null
          product_load_mode?: string
          product_name?: string
          protein_content_percent?: number | null
          recovery_time_h?: number
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_0c_w_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_10c_w_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_15c_w_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_20c_w_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          respiration_rate_5c_w_kg?: number | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          stored_mass_kg?: number
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          water_content_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_environment_products_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_environment_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "coldpro_products"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_environments: {
        Row: {
          air_changes_per_hour: number
          atmospheric_pressure_kpa: number | null
          ceiling_thickness_mm: number
          chamber_layout_type: string | null
          climate_region: string
          coldpro_project_id: string
          compressor_runtime_hours_day: number
          construction_faces: Json
          construction_load_kcal_h: number
          created_at: string
          defrost_kcal_h: number
          defrost_loss_factor: number
          dimension_a_m: number | null
          dimension_b_m: number | null
          dimension_c_m: number | null
          dimension_d_m: number | null
          dimension_e_m: number | null
          dimension_f_m: number | null
          door_height_m: number
          door_infiltration_m3_h: number
          door_open_seconds_per_opening: number
          door_openings_per_day: number
          door_operation_profile: string
          door_protection_type: string
          door_width_m: number
          environment_type: string
          evaporator_temp_c: number
          external_relative_humidity_percent: number | null
          external_temp_c: number
          fans_kcal_h: number
          floor_temp_c: number | null
          floor_thickness_mm: number
          fresh_air_m3_h: number
          has_floor_insulation: boolean
          height_m: number
          id: string
          infiltration_factor: number
          insulation_material_id: string | null
          internal_temp_c: number
          length_m: number
          lighting_hours_day: number
          lighting_power_w: number
          module_count: number | null
          motors_dissipation_factor: number
          motors_hours_day: number
          motors_power_kw: number
          name: string
          operation_hours_day: number
          other_kcal_h: number
          people_count: number
          people_hours_day: number
          relative_humidity_percent: number | null
          safety_factor_percent: number
          seed_final_moisture_percent: number
          seed_initial_moisture_percent: number
          seed_mass_kg: number
          seed_stabilization_time_h: number
          sort_order: number
          total_door_area_m2: number
          total_glass_area_m2: number
          total_panel_area_m2: number
          updated_at: string
          volume_m3: number
          wall_count: number | null
          wall_thickness_mm: number
          west_face_insolation: boolean | null
          width_m: number
        }
        Insert: {
          air_changes_per_hour?: number
          atmospheric_pressure_kpa?: number | null
          ceiling_thickness_mm?: number
          chamber_layout_type?: string | null
          climate_region?: string
          coldpro_project_id: string
          compressor_runtime_hours_day?: number
          construction_faces?: Json
          construction_load_kcal_h?: number
          created_at?: string
          defrost_kcal_h?: number
          defrost_loss_factor?: number
          dimension_a_m?: number | null
          dimension_b_m?: number | null
          dimension_c_m?: number | null
          dimension_d_m?: number | null
          dimension_e_m?: number | null
          dimension_f_m?: number | null
          door_height_m?: number
          door_infiltration_m3_h?: number
          door_open_seconds_per_opening?: number
          door_openings_per_day?: number
          door_operation_profile?: string
          door_protection_type?: string
          door_width_m?: number
          environment_type?: string
          evaporator_temp_c?: number
          external_relative_humidity_percent?: number | null
          external_temp_c?: number
          fans_kcal_h?: number
          floor_temp_c?: number | null
          floor_thickness_mm?: number
          fresh_air_m3_h?: number
          has_floor_insulation?: boolean
          height_m?: number
          id?: string
          infiltration_factor?: number
          insulation_material_id?: string | null
          internal_temp_c?: number
          length_m?: number
          lighting_hours_day?: number
          lighting_power_w?: number
          module_count?: number | null
          motors_dissipation_factor?: number
          motors_hours_day?: number
          motors_power_kw?: number
          name: string
          operation_hours_day?: number
          other_kcal_h?: number
          people_count?: number
          people_hours_day?: number
          relative_humidity_percent?: number | null
          safety_factor_percent?: number
          seed_final_moisture_percent?: number
          seed_initial_moisture_percent?: number
          seed_mass_kg?: number
          seed_stabilization_time_h?: number
          sort_order?: number
          total_door_area_m2?: number
          total_glass_area_m2?: number
          total_panel_area_m2?: number
          updated_at?: string
          volume_m3?: number
          wall_count?: number | null
          wall_thickness_mm?: number
          west_face_insolation?: boolean | null
          width_m?: number
        }
        Update: {
          air_changes_per_hour?: number
          atmospheric_pressure_kpa?: number | null
          ceiling_thickness_mm?: number
          chamber_layout_type?: string | null
          climate_region?: string
          coldpro_project_id?: string
          compressor_runtime_hours_day?: number
          construction_faces?: Json
          construction_load_kcal_h?: number
          created_at?: string
          defrost_kcal_h?: number
          defrost_loss_factor?: number
          dimension_a_m?: number | null
          dimension_b_m?: number | null
          dimension_c_m?: number | null
          dimension_d_m?: number | null
          dimension_e_m?: number | null
          dimension_f_m?: number | null
          door_height_m?: number
          door_infiltration_m3_h?: number
          door_open_seconds_per_opening?: number
          door_openings_per_day?: number
          door_operation_profile?: string
          door_protection_type?: string
          door_width_m?: number
          environment_type?: string
          evaporator_temp_c?: number
          external_relative_humidity_percent?: number | null
          external_temp_c?: number
          fans_kcal_h?: number
          floor_temp_c?: number | null
          floor_thickness_mm?: number
          fresh_air_m3_h?: number
          has_floor_insulation?: boolean
          height_m?: number
          id?: string
          infiltration_factor?: number
          insulation_material_id?: string | null
          internal_temp_c?: number
          length_m?: number
          lighting_hours_day?: number
          lighting_power_w?: number
          module_count?: number | null
          motors_dissipation_factor?: number
          motors_hours_day?: number
          motors_power_kw?: number
          name?: string
          operation_hours_day?: number
          other_kcal_h?: number
          people_count?: number
          people_hours_day?: number
          relative_humidity_percent?: number | null
          safety_factor_percent?: number
          seed_final_moisture_percent?: number
          seed_initial_moisture_percent?: number
          seed_mass_kg?: number
          seed_stabilization_time_h?: number
          sort_order?: number
          total_door_area_m2?: number
          total_glass_area_m2?: number
          total_panel_area_m2?: number
          updated_at?: string
          volume_m3?: number
          wall_count?: number | null
          wall_thickness_mm?: number
          west_face_insolation?: boolean | null
          width_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_environments_coldpro_project_id_fkey"
            columns: ["coldpro_project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_environments_insulation_material_id_fkey"
            columns: ["insulation_material_id"]
            isOneToOne: false
            referencedRelation: "coldpro_insulation_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_catalog: {
        Row: {
          active: boolean
          air_flow_m3_h: number
          air_throw_m: number | null
          ambient_temp_c: number | null
          application_type: string
          capacity_kcal_h: number
          capacity_kw: number
          compressor_type: string | null
          created_at: string
          defrost_type: string | null
          evaporation_temp_c: number | null
          id: string
          model: string
          refrigerant: string | null
          voltage: string | null
        }
        Insert: {
          active?: boolean
          air_flow_m3_h?: number
          air_throw_m?: number | null
          ambient_temp_c?: number | null
          application_type: string
          capacity_kcal_h: number
          capacity_kw: number
          compressor_type?: string | null
          created_at?: string
          defrost_type?: string | null
          evaporation_temp_c?: number | null
          id?: string
          model: string
          refrigerant?: string | null
          voltage?: string | null
        }
        Update: {
          active?: boolean
          air_flow_m3_h?: number
          air_throw_m?: number | null
          ambient_temp_c?: number | null
          application_type?: string
          capacity_kcal_h?: number
          capacity_kw?: number
          compressor_type?: string | null
          created_at?: string
          defrost_type?: string | null
          evaporation_temp_c?: number | null
          id?: string
          model?: string
          refrigerant?: string | null
          voltage?: string | null
        }
        Relationships: []
      }
      coldpro_equipment_compressors: {
        Row: {
          bitzer: string | null
          bitzer_secondary: string | null
          copeland: string | null
          copeland_secondary: string | null
          created_at: string
          danfoss_bock: string | null
          danfoss_secondary: string | null
          dorin: string | null
          equipment_model_id: string
          id: string
        }
        Insert: {
          bitzer?: string | null
          bitzer_secondary?: string | null
          copeland?: string | null
          copeland_secondary?: string | null
          created_at?: string
          danfoss_bock?: string | null
          danfoss_secondary?: string | null
          dorin?: string | null
          equipment_model_id: string
          id?: string
        }
        Update: {
          bitzer?: string | null
          bitzer_secondary?: string | null
          copeland?: string | null
          copeland_secondary?: string | null
          created_at?: string
          danfoss_bock?: string | null
          danfoss_secondary?: string | null
          dorin?: string | null
          equipment_model_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_compressors_equipment_model_id_fkey"
            columns: ["equipment_model_id"]
            isOneToOne: true
            referencedRelation: "coldpro_equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_condensers: {
        Row: {
          air_application_height_m: number | null
          air_throw_m: number | null
          airflow_m3_h: number | null
          calculated_internal_volume_l: number | null
          circuits: number | null
          complementary_source: string | null
          complementary_source_sheet: string | null
          condenser_model: string | null
          corrected_internal_volume_l: number | null
          created_at: string
          equipment_model_id: string
          estimated_refrigerant_charge_kg: number | null
          estimated_refrigerant_charge_note: string | null
          fan_diameter_mm: number | null
          fan_model: string | null
          fin_spacing_mm: number | null
          geometry: string | null
          id: string
          internal_volume_l: number | null
          occupancy_factor: number | null
          occupied_internal_volume_l: number | null
          refrigerant_density_kg_l: number | null
          refrigerant_occupancy_factor: number | null
          refrigerant_reference_temp_c: number | null
          rows: number | null
          total_tube_length_m: number | null
          total_tubes: number | null
          tube_count: number | null
          tube_diameter_in: number | null
          tube_diameter_mm: number | null
          tube_inner_diameter_mm: number | null
          tube_length_m: number | null
          tube_length_mm: number | null
          tube_outer_diameter_mm: number | null
          tube_thickness_mm: number | null
          tube_wall_thickness_mm: number | null
          tubes_per_circuit: number | null
          tubes_per_row: number | null
          volume_correction_factor: number | null
        }
        Insert: {
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          calculated_internal_volume_l?: number | null
          circuits?: number | null
          complementary_source?: string | null
          complementary_source_sheet?: string | null
          condenser_model?: string | null
          corrected_internal_volume_l?: number | null
          created_at?: string
          equipment_model_id: string
          estimated_refrigerant_charge_kg?: number | null
          estimated_refrigerant_charge_note?: string | null
          fan_diameter_mm?: number | null
          fan_model?: string | null
          fin_spacing_mm?: number | null
          geometry?: string | null
          id?: string
          internal_volume_l?: number | null
          occupancy_factor?: number | null
          occupied_internal_volume_l?: number | null
          refrigerant_density_kg_l?: number | null
          refrigerant_occupancy_factor?: number | null
          refrigerant_reference_temp_c?: number | null
          rows?: number | null
          total_tube_length_m?: number | null
          total_tubes?: number | null
          tube_count?: number | null
          tube_diameter_in?: number | null
          tube_diameter_mm?: number | null
          tube_inner_diameter_mm?: number | null
          tube_length_m?: number | null
          tube_length_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_thickness_mm?: number | null
          tube_wall_thickness_mm?: number | null
          tubes_per_circuit?: number | null
          tubes_per_row?: number | null
          volume_correction_factor?: number | null
        }
        Update: {
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          calculated_internal_volume_l?: number | null
          circuits?: number | null
          complementary_source?: string | null
          complementary_source_sheet?: string | null
          condenser_model?: string | null
          corrected_internal_volume_l?: number | null
          created_at?: string
          equipment_model_id?: string
          estimated_refrigerant_charge_kg?: number | null
          estimated_refrigerant_charge_note?: string | null
          fan_diameter_mm?: number | null
          fan_model?: string | null
          fin_spacing_mm?: number | null
          geometry?: string | null
          id?: string
          internal_volume_l?: number | null
          occupancy_factor?: number | null
          occupied_internal_volume_l?: number | null
          refrigerant_density_kg_l?: number | null
          refrigerant_occupancy_factor?: number | null
          refrigerant_reference_temp_c?: number | null
          rows?: number | null
          total_tube_length_m?: number | null
          total_tubes?: number | null
          tube_count?: number | null
          tube_diameter_in?: number | null
          tube_diameter_mm?: number | null
          tube_inner_diameter_mm?: number | null
          tube_length_m?: number | null
          tube_length_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_thickness_mm?: number | null
          tube_wall_thickness_mm?: number | null
          tubes_per_circuit?: number | null
          tubes_per_row?: number | null
          volume_correction_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_condensers_equipment_model_id_fkey"
            columns: ["equipment_model_id"]
            isOneToOne: true
            referencedRelation: "coldpro_equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_evaporators: {
        Row: {
          air_application_height_m: number | null
          air_throw_m: number | null
          airflow_m3_h: number | null
          calculated_internal_volume_l: number | null
          circuits: number | null
          complementary_source: string | null
          complementary_source_sheet: string | null
          corrected_internal_volume_l: number | null
          created_at: string
          effective_exchange_area_m2: number | null
          equipment_model_id: string
          estimated_exchange_area_m2: number | null
          estimated_refrigerant_charge_kg: number | null
          estimated_refrigerant_charge_note: string | null
          evaporator_model: string | null
          evaporator_quantity: number | null
          fan_diameter_mm: number | null
          fan_model: string | null
          fin_area_multiplier: number | null
          fin_efficiency_factor: number | null
          fin_spacing_mm: number | null
          geometry: string | null
          id: string
          internal_volume_l: number | null
          occupancy_factor: number | null
          occupied_internal_volume_l: number | null
          refrigerant_density_kg_l: number | null
          refrigerant_occupancy_factor: number | null
          refrigerant_reference_temp_c: number | null
          reheating: string | null
          rows: number | null
          surface_area_m2: number | null
          total_tube_length_m: number | null
          total_tubes: number | null
          tube_count: number | null
          tube_diameter_in: number | null
          tube_diameter_mm: number | null
          tube_external_area_m2: number | null
          tube_inner_diameter_mm: number | null
          tube_length_m: number | null
          tube_length_mm: number | null
          tube_outer_diameter_mm: number | null
          tube_thickness_mm: number | null
          tube_wall_thickness_mm: number | null
          tubes_per_circuit: number | null
          tubes_per_row: number | null
          volume_correction_factor: number | null
        }
        Insert: {
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          calculated_internal_volume_l?: number | null
          circuits?: number | null
          complementary_source?: string | null
          complementary_source_sheet?: string | null
          corrected_internal_volume_l?: number | null
          created_at?: string
          effective_exchange_area_m2?: number | null
          equipment_model_id: string
          estimated_exchange_area_m2?: number | null
          estimated_refrigerant_charge_kg?: number | null
          estimated_refrigerant_charge_note?: string | null
          evaporator_model?: string | null
          evaporator_quantity?: number | null
          fan_diameter_mm?: number | null
          fan_model?: string | null
          fin_area_multiplier?: number | null
          fin_efficiency_factor?: number | null
          fin_spacing_mm?: number | null
          geometry?: string | null
          id?: string
          internal_volume_l?: number | null
          occupancy_factor?: number | null
          occupied_internal_volume_l?: number | null
          refrigerant_density_kg_l?: number | null
          refrigerant_occupancy_factor?: number | null
          refrigerant_reference_temp_c?: number | null
          reheating?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          total_tube_length_m?: number | null
          total_tubes?: number | null
          tube_count?: number | null
          tube_diameter_in?: number | null
          tube_diameter_mm?: number | null
          tube_external_area_m2?: number | null
          tube_inner_diameter_mm?: number | null
          tube_length_m?: number | null
          tube_length_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_thickness_mm?: number | null
          tube_wall_thickness_mm?: number | null
          tubes_per_circuit?: number | null
          tubes_per_row?: number | null
          volume_correction_factor?: number | null
        }
        Update: {
          air_application_height_m?: number | null
          air_throw_m?: number | null
          airflow_m3_h?: number | null
          calculated_internal_volume_l?: number | null
          circuits?: number | null
          complementary_source?: string | null
          complementary_source_sheet?: string | null
          corrected_internal_volume_l?: number | null
          created_at?: string
          effective_exchange_area_m2?: number | null
          equipment_model_id?: string
          estimated_exchange_area_m2?: number | null
          estimated_refrigerant_charge_kg?: number | null
          estimated_refrigerant_charge_note?: string | null
          evaporator_model?: string | null
          evaporator_quantity?: number | null
          fan_diameter_mm?: number | null
          fan_model?: string | null
          fin_area_multiplier?: number | null
          fin_efficiency_factor?: number | null
          fin_spacing_mm?: number | null
          geometry?: string | null
          id?: string
          internal_volume_l?: number | null
          occupancy_factor?: number | null
          occupied_internal_volume_l?: number | null
          refrigerant_density_kg_l?: number | null
          refrigerant_occupancy_factor?: number | null
          refrigerant_reference_temp_c?: number | null
          reheating?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          total_tube_length_m?: number | null
          total_tubes?: number | null
          tube_count?: number | null
          tube_diameter_in?: number | null
          tube_diameter_mm?: number | null
          tube_external_area_m2?: number | null
          tube_inner_diameter_mm?: number | null
          tube_length_m?: number | null
          tube_length_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_thickness_mm?: number | null
          tube_wall_thickness_mm?: number | null
          tubes_per_circuit?: number | null
          tubes_per_row?: number | null
          volume_correction_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_evaporators_equipment_model_id_fkey"
            columns: ["equipment_model_id"]
            isOneToOne: true
            referencedRelation: "coldpro_equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_model_refrigerants: {
        Row: {
          compatibility_notes: string | null
          created_at: string
          equipment_model_id: string
          id: string
          is_primary: boolean
          refrigerant_id: string
          source: string | null
        }
        Insert: {
          compatibility_notes?: string | null
          created_at?: string
          equipment_model_id: string
          id?: string
          is_primary?: boolean
          refrigerant_id: string
          source?: string | null
        }
        Update: {
          compatibility_notes?: string | null
          created_at?: string
          equipment_model_id?: string
          id?: string
          is_primary?: boolean
          refrigerant_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_model_refrigerants_refrigerant_id_fkey"
            columns: ["refrigerant_id"]
            isOneToOne: false
            referencedRelation: "coldpro_refrigerants"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_models: {
        Row: {
          active: boolean
          application_summary: string | null
          application_type: string | null
          biblock_image_path: string | null
          biblock_image_paths: string[]
          catalog_variant_key: string | null
          commercial_description: string | null
          commercial_description_source: string | null
          commercial_features: Json
          commercial_highlights: Json
          created_at: string
          description_confidence: string | null
          description_source: string | null
          designacao_hp: string | null
          electrical_configuration: string | null
          frequency_hz: number | null
          gabinete: string | null
          gwp_ar6: number | null
          id: string
          linha: string | null
          modelo: string
          notes: string | null
          odp_ar6: number | null
          phase_count: number | null
          plugin_image_path: string | null
          plugin_image_paths: string[]
          raw: Json | null
          recommended_applications: string[]
          refrigerante: string | null
          smart_description: string | null
          source_import_id: string | null
          split_image_path: string | null
          split_image_paths: string[]
          technical_highlights: Json
          tipo_degelo: string | null
          tipo_gabinete: string | null
          updated_at: string
          voltage_value_v: number | null
        }
        Insert: {
          active?: boolean
          application_summary?: string | null
          application_type?: string | null
          biblock_image_path?: string | null
          biblock_image_paths?: string[]
          catalog_variant_key?: string | null
          commercial_description?: string | null
          commercial_description_source?: string | null
          commercial_features?: Json
          commercial_highlights?: Json
          created_at?: string
          description_confidence?: string | null
          description_source?: string | null
          designacao_hp?: string | null
          electrical_configuration?: string | null
          frequency_hz?: number | null
          gabinete?: string | null
          gwp_ar6?: number | null
          id?: string
          linha?: string | null
          modelo: string
          notes?: string | null
          odp_ar6?: number | null
          phase_count?: number | null
          plugin_image_path?: string | null
          plugin_image_paths?: string[]
          raw?: Json | null
          recommended_applications?: string[]
          refrigerante?: string | null
          smart_description?: string | null
          source_import_id?: string | null
          split_image_path?: string | null
          split_image_paths?: string[]
          technical_highlights?: Json
          tipo_degelo?: string | null
          tipo_gabinete?: string | null
          updated_at?: string
          voltage_value_v?: number | null
        }
        Update: {
          active?: boolean
          application_summary?: string | null
          application_type?: string | null
          biblock_image_path?: string | null
          biblock_image_paths?: string[]
          catalog_variant_key?: string | null
          commercial_description?: string | null
          commercial_description_source?: string | null
          commercial_features?: Json
          commercial_highlights?: Json
          created_at?: string
          description_confidence?: string | null
          description_source?: string | null
          designacao_hp?: string | null
          electrical_configuration?: string | null
          frequency_hz?: number | null
          gabinete?: string | null
          gwp_ar6?: number | null
          id?: string
          linha?: string | null
          modelo?: string
          notes?: string | null
          odp_ar6?: number | null
          phase_count?: number | null
          plugin_image_path?: string | null
          plugin_image_paths?: string[]
          raw?: Json | null
          recommended_applications?: string[]
          refrigerante?: string | null
          smart_description?: string | null
          source_import_id?: string | null
          split_image_path?: string | null
          split_image_paths?: string[]
          technical_highlights?: Json
          tipo_degelo?: string | null
          tipo_gabinete?: string | null
          updated_at?: string
          voltage_value_v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_models_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "coldpro_catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_performance_points: {
        Row: {
          additional_subcooling_k: number | null
          altitude_m: number | null
          compressor_capacity_kcal_h: number | null
          compressor_current_a: number | null
          compressor_power_kw: number | null
          condensation_temp_c: number | null
          cop: number | null
          cop_carnot: number | null
          created_at: string
          drain_diameter: string | null
          drain_quantity: number | null
          drain_water_l_h: number | null
          enthalpy_difference_kj_kg: number | null
          equipment_model_id: string
          estimated_current_a: number | null
          evaporation_temp_c: number | null
          evaporator_capacity_kcal_h: number | null
          external_humidity_percent: number | null
          external_temp_c: number | null
          fan_current_a: number | null
          fan_power_kw: number | null
          fluid_charge_kg: number | null
          global_cop: number | null
          heat_rejection_kcal_h: number | null
          humidity_room_percent: number | null
          id: string
          mass_flow_kg_h: number | null
          mass_flow_kg_s: number | null
          raw: Json | null
          refrigerant: string | null
          source_import_id: string | null
          source_sheet: string | null
          starting_current_a: number | null
          subcooling_k: number | null
          temperature_room_c: number | null
          total_power_kw: number | null
          total_superheat_k: number | null
          useful_superheat_k: number | null
          voltage: string | null
        }
        Insert: {
          additional_subcooling_k?: number | null
          altitude_m?: number | null
          compressor_capacity_kcal_h?: number | null
          compressor_current_a?: number | null
          compressor_power_kw?: number | null
          condensation_temp_c?: number | null
          cop?: number | null
          cop_carnot?: number | null
          created_at?: string
          drain_diameter?: string | null
          drain_quantity?: number | null
          drain_water_l_h?: number | null
          enthalpy_difference_kj_kg?: number | null
          equipment_model_id: string
          estimated_current_a?: number | null
          evaporation_temp_c?: number | null
          evaporator_capacity_kcal_h?: number | null
          external_humidity_percent?: number | null
          external_temp_c?: number | null
          fan_current_a?: number | null
          fan_power_kw?: number | null
          fluid_charge_kg?: number | null
          global_cop?: number | null
          heat_rejection_kcal_h?: number | null
          humidity_room_percent?: number | null
          id?: string
          mass_flow_kg_h?: number | null
          mass_flow_kg_s?: number | null
          raw?: Json | null
          refrigerant?: string | null
          source_import_id?: string | null
          source_sheet?: string | null
          starting_current_a?: number | null
          subcooling_k?: number | null
          temperature_room_c?: number | null
          total_power_kw?: number | null
          total_superheat_k?: number | null
          useful_superheat_k?: number | null
          voltage?: string | null
        }
        Update: {
          additional_subcooling_k?: number | null
          altitude_m?: number | null
          compressor_capacity_kcal_h?: number | null
          compressor_current_a?: number | null
          compressor_power_kw?: number | null
          condensation_temp_c?: number | null
          cop?: number | null
          cop_carnot?: number | null
          created_at?: string
          drain_diameter?: string | null
          drain_quantity?: number | null
          drain_water_l_h?: number | null
          enthalpy_difference_kj_kg?: number | null
          equipment_model_id?: string
          estimated_current_a?: number | null
          evaporation_temp_c?: number | null
          evaporator_capacity_kcal_h?: number | null
          external_humidity_percent?: number | null
          external_temp_c?: number | null
          fan_current_a?: number | null
          fan_power_kw?: number | null
          fluid_charge_kg?: number | null
          global_cop?: number | null
          heat_rejection_kcal_h?: number | null
          humidity_room_percent?: number | null
          id?: string
          mass_flow_kg_h?: number | null
          mass_flow_kg_s?: number | null
          raw?: Json | null
          refrigerant?: string | null
          source_import_id?: string | null
          source_sheet?: string | null
          starting_current_a?: number | null
          subcooling_k?: number | null
          temperature_room_c?: number | null
          total_power_kw?: number | null
          total_superheat_k?: number | null
          useful_superheat_k?: number | null
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_performance_points_equipment_model_id_fkey"
            columns: ["equipment_model_id"]
            isOneToOne: false
            referencedRelation: "coldpro_equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_equipment_performance_points_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "coldpro_catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_equipment_selections: {
        Row: {
          air_changes_hour: number
          air_flow_total_m3_h: number
          air_flow_unit_m3_h: number
          air_throw_m: number | null
          capacity_total_kcal_h: number
          capacity_unit_kcal_h: number
          cop: number | null
          created_at: string
          curve_condensation_temp_c: number | null
          curve_evaporation_temp_c: number | null
          curve_interpolated: boolean
          curve_metadata: Json
          curve_polynomial_r2: number | null
          curve_temperature_room_c: number | null
          environment_id: string
          equipment_id: string | null
          equipment_model_id: string | null
          id: string
          model: string
          notes: string | null
          quantity: number
          refrigerant: string | null
          selection_method: string
          surplus_kcal_h: number
          surplus_percent: number
          total_power_kw: number | null
        }
        Insert: {
          air_changes_hour?: number
          air_flow_total_m3_h?: number
          air_flow_unit_m3_h?: number
          air_throw_m?: number | null
          capacity_total_kcal_h?: number
          capacity_unit_kcal_h?: number
          cop?: number | null
          created_at?: string
          curve_condensation_temp_c?: number | null
          curve_evaporation_temp_c?: number | null
          curve_interpolated?: boolean
          curve_metadata?: Json
          curve_polynomial_r2?: number | null
          curve_temperature_room_c?: number | null
          environment_id: string
          equipment_id?: string | null
          equipment_model_id?: string | null
          id?: string
          model: string
          notes?: string | null
          quantity?: number
          refrigerant?: string | null
          selection_method?: string
          surplus_kcal_h?: number
          surplus_percent?: number
          total_power_kw?: number | null
        }
        Update: {
          air_changes_hour?: number
          air_flow_total_m3_h?: number
          air_flow_unit_m3_h?: number
          air_throw_m?: number | null
          capacity_total_kcal_h?: number
          capacity_unit_kcal_h?: number
          cop?: number | null
          created_at?: string
          curve_condensation_temp_c?: number | null
          curve_evaporation_temp_c?: number | null
          curve_interpolated?: boolean
          curve_metadata?: Json
          curve_polynomial_r2?: number | null
          curve_temperature_room_c?: number | null
          environment_id?: string
          equipment_id?: string | null
          equipment_model_id?: string | null
          id?: string
          model?: string
          notes?: string | null
          quantity?: number
          refrigerant?: string | null
          selection_method?: string
          surplus_kcal_h?: number
          surplus_percent?: number
          total_power_kw?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_equipment_selections_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_equipment_selections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_equipment_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_infiltration: {
        Row: {
          air_density_kg_m3: number | null
          air_renovation_m3_h: number
          air_volume_infiltrated_m3_h: number
          altitude_m: number
          created_at: string
          door_area_m2: number
          door_openings_per_day: number
          environment_id: string | null
          external_temp_c: number | null
          id: string
          internal_temp_c: number | null
          notes: string | null
          opening_factor: number
          project_id: string | null
          updated_at: string
        }
        Insert: {
          air_density_kg_m3?: number | null
          air_renovation_m3_h?: number
          air_volume_infiltrated_m3_h?: number
          altitude_m?: number
          created_at?: string
          door_area_m2?: number
          door_openings_per_day?: number
          environment_id?: string | null
          external_temp_c?: number | null
          id?: string
          internal_temp_c?: number | null
          notes?: string | null
          opening_factor?: number
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          air_density_kg_m3?: number | null
          air_renovation_m3_h?: number
          air_volume_infiltrated_m3_h?: number
          altitude_m?: number
          created_at?: string
          door_area_m2?: number
          door_openings_per_day?: number
          environment_id?: string | null
          external_temp_c?: number | null
          id?: string
          internal_temp_c?: number | null
          notes?: string | null
          opening_factor?: number
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_infiltration_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_infiltration_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_insulation_materials: {
        Row: {
          conductivity_kcal_h_m_c: number
          conductivity_w_m_k: number
          created_at: string
          default_thickness_mm: number | null
          id: string
          material_type: string
          name: string
          source: string | null
          source_reference: string | null
        }
        Insert: {
          conductivity_kcal_h_m_c: number
          conductivity_w_m_k: number
          created_at?: string
          default_thickness_mm?: number | null
          id?: string
          material_type: string
          name: string
          source?: string | null
          source_reference?: string | null
        }
        Update: {
          conductivity_kcal_h_m_c?: number
          conductivity_w_m_k?: number
          created_at?: string
          default_thickness_mm?: number | null
          id?: string
          material_type?: string
          name?: string
          source?: string | null
          source_reference?: string | null
        }
        Relationships: []
      }
      coldpro_internal_loads: {
        Row: {
          apply_respiration: boolean
          created_at: string
          defrost_factor: number
          environment_id: string | null
          fan_factor: number
          id: string
          lighting_area_m2: number
          lighting_use_factor: number
          lighting_w_m2: number
          motors_power_kw: number
          motors_use_factor: number
          notes: string | null
          operational_factor: number
          packaging_cp_kj_kg_k: number
          packaging_delta_t_k: number
          packaging_mass_kg: number
          people_load_w: number
          people_quantity: number
          people_use_factor: number
          project_id: string | null
          pull_down_kw: number
          respiration_mass_kg: number
          respiration_rate_w_kg: number
          safety_factor: number
          updated_at: string
        }
        Insert: {
          apply_respiration?: boolean
          created_at?: string
          defrost_factor?: number
          environment_id?: string | null
          fan_factor?: number
          id?: string
          lighting_area_m2?: number
          lighting_use_factor?: number
          lighting_w_m2?: number
          motors_power_kw?: number
          motors_use_factor?: number
          notes?: string | null
          operational_factor?: number
          packaging_cp_kj_kg_k?: number
          packaging_delta_t_k?: number
          packaging_mass_kg?: number
          people_load_w?: number
          people_quantity?: number
          people_use_factor?: number
          project_id?: string | null
          pull_down_kw?: number
          respiration_mass_kg?: number
          respiration_rate_w_kg?: number
          safety_factor?: number
          updated_at?: string
        }
        Update: {
          apply_respiration?: boolean
          created_at?: string
          defrost_factor?: number
          environment_id?: string | null
          fan_factor?: number
          id?: string
          lighting_area_m2?: number
          lighting_use_factor?: number
          lighting_w_m2?: number
          motors_power_kw?: number
          motors_use_factor?: number
          notes?: string | null
          operational_factor?: number
          packaging_cp_kj_kg_k?: number
          packaging_delta_t_k?: number
          packaging_mass_kg?: number
          people_load_w?: number
          people_quantity?: number
          people_use_factor?: number
          project_id?: string | null
          pull_down_kw?: number
          respiration_mass_kg?: number
          respiration_rate_w_kg?: number
          safety_factor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_internal_loads_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_internal_loads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_materials: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_thickness_mm: number | null
          density_kg_m3: number | null
          id: string
          name: string
          notes: string | null
          thermal_conductivity_w_m_k: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          default_thickness_mm?: number | null
          density_kg_m3?: number | null
          id?: string
          name: string
          notes?: string | null
          thermal_conductivity_w_m_k?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_thickness_mm?: number | null
          density_kg_m3?: number | null
          id?: string
          name?: string
          notes?: string | null
          thermal_conductivity_w_m_k?: number
          updated_at?: string
        }
        Relationships: []
      }
      coldpro_process_parameters: {
        Row: {
          air_temp_c: number | null
          air_velocity_m_s: number | null
          application_mode: string
          batch_mass_kg: number
          batch_time_h: number
          cp_above_kj_kg_k: number
          cp_below_kj_kg_k: number
          created_at: string
          environment_id: string | null
          freezable_fraction: number
          freezing_temp_c: number
          id: string
          inlet_temp_c: number
          latent_heat_kj_kg: number
          mass_kg: number
          notes: string | null
          operation_mode: string
          outlet_temp_c: number
          product_category: string | null
          product_density_kg_m3: number | null
          product_id: string | null
          product_name: string
          product_thermal_conductivity_w_m_k: number | null
          product_thickness_m: number | null
          production_kg_h: number
          project_id: string | null
          pull_down_kw: number
          retention_time_min: number | null
          specific_load_kj_kg: number | null
          updated_at: string
        }
        Insert: {
          air_temp_c?: number | null
          air_velocity_m_s?: number | null
          application_mode?: string
          batch_mass_kg?: number
          batch_time_h?: number
          cp_above_kj_kg_k?: number
          cp_below_kj_kg_k?: number
          created_at?: string
          environment_id?: string | null
          freezable_fraction?: number
          freezing_temp_c?: number
          id?: string
          inlet_temp_c?: number
          latent_heat_kj_kg?: number
          mass_kg?: number
          notes?: string | null
          operation_mode?: string
          outlet_temp_c?: number
          product_category?: string | null
          product_density_kg_m3?: number | null
          product_id?: string | null
          product_name?: string
          product_thermal_conductivity_w_m_k?: number | null
          product_thickness_m?: number | null
          production_kg_h?: number
          project_id?: string | null
          pull_down_kw?: number
          retention_time_min?: number | null
          specific_load_kj_kg?: number | null
          updated_at?: string
        }
        Update: {
          air_temp_c?: number | null
          air_velocity_m_s?: number | null
          application_mode?: string
          batch_mass_kg?: number
          batch_time_h?: number
          cp_above_kj_kg_k?: number
          cp_below_kj_kg_k?: number
          created_at?: string
          environment_id?: string | null
          freezable_fraction?: number
          freezing_temp_c?: number
          id?: string
          inlet_temp_c?: number
          latent_heat_kj_kg?: number
          mass_kg?: number
          notes?: string | null
          operation_mode?: string
          outlet_temp_c?: number
          product_category?: string | null
          product_density_kg_m3?: number | null
          product_id?: string | null
          product_name?: string
          product_thermal_conductivity_w_m_k?: number | null
          product_thickness_m?: number | null
          production_kg_h?: number
          project_id?: string | null
          pull_down_kw?: number
          retention_time_min?: number | null
          specific_load_kj_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_process_parameters_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_process_parameters_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "coldpro_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_process_parameters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_products: {
        Row: {
          allow_phase_change: boolean
          approximate_volume_cm3: number | null
          ash_content_percent: number | null
          carbohydrate_content_percent: number | null
          category: string | null
          characteristic_thickness_m: number | null
          characteristic_thickness_mm: number | null
          created_at: string
          data_confidence: string
          default_convective_coefficient_w_m2_k: number | null
          density_kg_m3: number | null
          fat_content_percent: number | null
          fiber_content_percent: number | null
          freezable_water_content_percent: number | null
          frozen_water_fraction: number | null
          geometry_shape: string | null
          height_or_thickness_mm: number | null
          id: string
          initial_freezing_temp_c: number | null
          is_ashrae_reference: boolean
          latent_heat_kcal_kg: number
          latent_heat_kj_kg: number | null
          length_mm: number | null
          name: string
          notes: string | null
          observations: string | null
          protein_content_percent: number | null
          respiration_rate_0c_mw_kg: number | null
          respiration_rate_0c_w_kg: number | null
          respiration_rate_10c_mw_kg: number | null
          respiration_rate_10c_w_kg: number | null
          respiration_rate_15c_mw_kg: number | null
          respiration_rate_15c_w_kg: number | null
          respiration_rate_20c_mw_kg: number | null
          respiration_rate_20c_w_kg: number | null
          respiration_rate_5c_mw_kg: number | null
          respiration_rate_5c_w_kg: number | null
          source: string | null
          source_compiled_at: string | null
          source_reference: string | null
          specific_heat_above_kcal_kg_c: number
          specific_heat_above_kj_kg_k: number | null
          specific_heat_below_kcal_kg_c: number
          specific_heat_below_kj_kg_k: number | null
          thermal_conductivity_frozen_w_m_k: number | null
          thermal_conductivity_unfrozen_w_m_k: number | null
          thermal_conductivity_w_m_k: number | null
          water_content_percent: number | null
          width_mm: number | null
        }
        Insert: {
          allow_phase_change?: boolean
          approximate_volume_cm3?: number | null
          ash_content_percent?: number | null
          carbohydrate_content_percent?: number | null
          category?: string | null
          characteristic_thickness_m?: number | null
          characteristic_thickness_mm?: number | null
          created_at?: string
          data_confidence?: string
          default_convective_coefficient_w_m2_k?: number | null
          density_kg_m3?: number | null
          fat_content_percent?: number | null
          fiber_content_percent?: number | null
          freezable_water_content_percent?: number | null
          frozen_water_fraction?: number | null
          geometry_shape?: string | null
          height_or_thickness_mm?: number | null
          id?: string
          initial_freezing_temp_c?: number | null
          is_ashrae_reference?: boolean
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          length_mm?: number | null
          name: string
          notes?: string | null
          observations?: string | null
          protein_content_percent?: number | null
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_0c_w_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_10c_w_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_15c_w_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_20c_w_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          respiration_rate_5c_w_kg?: number | null
          source?: string | null
          source_compiled_at?: string | null
          source_reference?: string | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          thermal_conductivity_w_m_k?: number | null
          water_content_percent?: number | null
          width_mm?: number | null
        }
        Update: {
          allow_phase_change?: boolean
          approximate_volume_cm3?: number | null
          ash_content_percent?: number | null
          carbohydrate_content_percent?: number | null
          category?: string | null
          characteristic_thickness_m?: number | null
          characteristic_thickness_mm?: number | null
          created_at?: string
          data_confidence?: string
          default_convective_coefficient_w_m2_k?: number | null
          density_kg_m3?: number | null
          fat_content_percent?: number | null
          fiber_content_percent?: number | null
          freezable_water_content_percent?: number | null
          frozen_water_fraction?: number | null
          geometry_shape?: string | null
          height_or_thickness_mm?: number | null
          id?: string
          initial_freezing_temp_c?: number | null
          is_ashrae_reference?: boolean
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          length_mm?: number | null
          name?: string
          notes?: string | null
          observations?: string | null
          protein_content_percent?: number | null
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_0c_w_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_10c_w_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_15c_w_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_20c_w_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          respiration_rate_5c_w_kg?: number | null
          source?: string | null
          source_compiled_at?: string | null
          source_reference?: string | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          thermal_conductivity_w_m_k?: number | null
          water_content_percent?: number | null
          width_mm?: number | null
        }
        Relationships: []
      }
      coldpro_projects: {
        Row: {
          application_type: string
          calculated_at: string | null
          cover_client_name: string | null
          cover_image_url: string | null
          cover_location: string | null
          cover_notes: string | null
          cover_project_name: string | null
          cover_responsible: string | null
          created_at: string
          customer_id: string | null
          id: string
          name: string
          notes: string | null
          proposal_id: string | null
          report_status: string | null
          report_template: string | null
          report_watermark_enabled: boolean | null
          report_watermark_text: string | null
          revision: number
          status: string
          updated_at: string
        }
        Insert: {
          application_type?: string
          calculated_at?: string | null
          cover_client_name?: string | null
          cover_image_url?: string | null
          cover_location?: string | null
          cover_notes?: string | null
          cover_project_name?: string | null
          cover_responsible?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name: string
          notes?: string | null
          proposal_id?: string | null
          report_status?: string | null
          report_template?: string | null
          report_watermark_enabled?: boolean | null
          report_watermark_text?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Update: {
          application_type?: string
          calculated_at?: string | null
          cover_client_name?: string | null
          cover_image_url?: string | null
          cover_location?: string | null
          cover_notes?: string | null
          cover_project_name?: string | null
          cover_responsible?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          proposal_id?: string | null
          report_status?: string | null
          report_template?: string | null
          report_watermark_enabled?: boolean | null
          report_watermark_text?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_projects_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_refrigerant_properties: {
        Row: {
          created_at: string
          id: string
          liquid_density_kg_l: number
          notes: string | null
          reference_temperature_c: number
          refrigerant: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          liquid_density_kg_l: number
          notes?: string | null
          reference_temperature_c: number
          refrigerant: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          liquid_density_kg_l?: number
          notes?: string | null
          reference_temperature_c?: number
          refrigerant?: string
          source?: string | null
        }
        Relationships: []
      }
      coldpro_refrigerants: {
        Row: {
          active: boolean
          ashrae_class: string | null
          boiling_point_c: number | null
          code: string
          composition: string | null
          created_at: string
          critical_temperature_c: number | null
          description: string | null
          family: string | null
          glide_k: number | null
          gwp_ar6: number | null
          id: string
          liquid_density_kg_l: number | null
          name: string
          notes: string | null
          odp_ar6: number | null
          oil_compatibility: string | null
          reference_temperature_c: number | null
          safety_class: string | null
          typical_applications: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ashrae_class?: string | null
          boiling_point_c?: number | null
          code: string
          composition?: string | null
          created_at?: string
          critical_temperature_c?: number | null
          description?: string | null
          family?: string | null
          glide_k?: number | null
          gwp_ar6?: number | null
          id?: string
          liquid_density_kg_l?: number | null
          name: string
          notes?: string | null
          odp_ar6?: number | null
          oil_compatibility?: string | null
          reference_temperature_c?: number | null
          safety_class?: string | null
          typical_applications?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ashrae_class?: string | null
          boiling_point_c?: number | null
          code?: string
          composition?: string | null
          created_at?: string
          critical_temperature_c?: number | null
          description?: string | null
          family?: string | null
          glide_k?: number | null
          gwp_ar6?: number | null
          id?: string
          liquid_density_kg_l?: number | null
          name?: string
          notes?: string | null
          odp_ar6?: number | null
          oil_compatibility?: string | null
          reference_temperature_c?: number | null
          safety_class?: string | null
          typical_applications?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coldpro_report_settings: {
        Row: {
          accent_color: string
          company_name: string
          cover_image_url: string | null
          created_at: string
          default_responsible: string | null
          default_status: string
          default_template: string
          footer_text: string | null
          id: string
          logo_url: string | null
          primary_color: string
          scope: string
          secondary_color: string
          show_watermark: boolean
          updated_at: string
          watermark_text: string | null
        }
        Insert: {
          accent_color?: string
          company_name?: string
          cover_image_url?: string | null
          created_at?: string
          default_responsible?: string | null
          default_status?: string
          default_template?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          scope?: string
          secondary_color?: string
          show_watermark?: boolean
          updated_at?: string
          watermark_text?: string | null
        }
        Update: {
          accent_color?: string
          company_name?: string
          cover_image_url?: string | null
          created_at?: string
          default_responsible?: string | null
          default_status?: string
          default_template?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          scope?: string
          secondary_color?: string
          show_watermark?: boolean
          updated_at?: string
          watermark_text?: string | null
        }
        Relationships: []
      }
      coldpro_reports: {
        Row: {
          calculation_memory: Json
          created_at: string
          created_by: string | null
          environment_id: string | null
          id: string
          project_id: string | null
          report_text: string
          result_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          calculation_memory?: Json
          created_at?: string
          created_by?: string | null
          environment_id?: string | null
          id?: string
          project_id?: string | null
          report_text?: string
          result_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          calculation_memory?: Json
          created_at?: string
          created_by?: string | null
          environment_id?: string | null
          id?: string
          project_id?: string | null
          report_text?: string
          result_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_reports_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_reports_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "coldpro_results"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_results: {
        Row: {
          calculation_breakdown: Json
          calculation_input: Json
          created_at: string
          defrost_kcal_h: number
          environment_id: string
          fans_kcal_h: number
          id: string
          infiltration_kcal_h: number
          lighting_kcal_h: number
          motors_kcal_h: number
          other_kcal_h: number
          packaging_kcal_h: number
          people_kcal_h: number
          product_kcal_h: number
          safety_factor_percent: number
          safety_kcal_h: number
          subtotal_kcal_h: number
          total_required_kcal_h: number
          total_required_kw: number
          total_required_tr: number
          transmission_kcal_h: number
          tunnel_internal_load_kcal_h: number
        }
        Insert: {
          calculation_breakdown?: Json
          calculation_input?: Json
          created_at?: string
          defrost_kcal_h?: number
          environment_id: string
          fans_kcal_h?: number
          id?: string
          infiltration_kcal_h?: number
          lighting_kcal_h?: number
          motors_kcal_h?: number
          other_kcal_h?: number
          packaging_kcal_h?: number
          people_kcal_h?: number
          product_kcal_h?: number
          safety_factor_percent?: number
          safety_kcal_h?: number
          subtotal_kcal_h?: number
          total_required_kcal_h?: number
          total_required_kw?: number
          total_required_tr?: number
          transmission_kcal_h?: number
          tunnel_internal_load_kcal_h?: number
        }
        Update: {
          calculation_breakdown?: Json
          calculation_input?: Json
          created_at?: string
          defrost_kcal_h?: number
          environment_id?: string
          fans_kcal_h?: number
          id?: string
          infiltration_kcal_h?: number
          lighting_kcal_h?: number
          motors_kcal_h?: number
          other_kcal_h?: number
          packaging_kcal_h?: number
          people_kcal_h?: number
          product_kcal_h?: number
          safety_factor_percent?: number
          safety_kcal_h?: number
          subtotal_kcal_h?: number
          total_required_kcal_h?: number
          total_required_kw?: number
          total_required_tr?: number
          transmission_kcal_h?: number
          tunnel_internal_load_kcal_h?: number
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_results_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_simulations: {
        Row: {
          alerts: Json
          avg_cop: number | null
          avg_internal_temp_c: number | null
          compressor_on_hours: number
          compressor_on_percent: number
          created_at: string
          created_by: string | null
          differential_c: number
          environment_id: string
          equipment_adequacy: string
          hours_above_setpoint: number
          hours_below_setpoint: number
          id: string
          is_latest: boolean
          max_internal_temp_c: number | null
          min_internal_temp_c: number | null
          name: string
          peak_load_kcal_h: number
          result_id: string | null
          setpoint_c: number
          simulation_data: Json
          simulation_period_days: number
          time_step_minutes: number
          total_energy_kwh: number
          updated_at: string
          version: number
          weather_profile: string
        }
        Insert: {
          alerts?: Json
          avg_cop?: number | null
          avg_internal_temp_c?: number | null
          compressor_on_hours?: number
          compressor_on_percent?: number
          created_at?: string
          created_by?: string | null
          differential_c?: number
          environment_id: string
          equipment_adequacy?: string
          hours_above_setpoint?: number
          hours_below_setpoint?: number
          id?: string
          is_latest?: boolean
          max_internal_temp_c?: number | null
          min_internal_temp_c?: number | null
          name?: string
          peak_load_kcal_h?: number
          result_id?: string | null
          setpoint_c?: number
          simulation_data?: Json
          simulation_period_days?: number
          time_step_minutes?: number
          total_energy_kwh?: number
          updated_at?: string
          version?: number
          weather_profile?: string
        }
        Update: {
          alerts?: Json
          avg_cop?: number | null
          avg_internal_temp_c?: number | null
          compressor_on_hours?: number
          compressor_on_percent?: number
          created_at?: string
          created_by?: string | null
          differential_c?: number
          environment_id?: string
          equipment_adequacy?: string
          hours_above_setpoint?: number
          hours_below_setpoint?: number
          id?: string
          is_latest?: boolean
          max_internal_temp_c?: number | null
          min_internal_temp_c?: number | null
          name?: string
          peak_load_kcal_h?: number
          result_id?: string | null
          setpoint_c?: number
          simulation_data?: Json
          simulation_period_days?: number
          time_step_minutes?: number
          total_energy_kwh?: number
          updated_at?: string
          version?: number
          weather_profile?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_simulations_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_simulations_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "coldpro_results"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_surfaces: {
        Row: {
          area_door_m2: number
          area_glass_m2: number
          area_total_m2: number
          created_at: string
          environment_id: string | null
          external_temp_c: number | null
          glass_type: string
          has_floor_insulation: boolean
          id: string
          label: string
          notes: string | null
          project_id: string | null
          soil_temp_c: number | null
          solar_factor: number
          solar_level: string
          sort_order: number
          surface_type: string
          u_door_w_m2k: number
          u_opaque_w_m2k: number
          updated_at: string
        }
        Insert: {
          area_door_m2?: number
          area_glass_m2?: number
          area_total_m2?: number
          created_at?: string
          environment_id?: string | null
          external_temp_c?: number | null
          glass_type?: string
          has_floor_insulation?: boolean
          id?: string
          label: string
          notes?: string | null
          project_id?: string | null
          soil_temp_c?: number | null
          solar_factor?: number
          solar_level?: string
          sort_order?: number
          surface_type: string
          u_door_w_m2k?: number
          u_opaque_w_m2k?: number
          updated_at?: string
        }
        Update: {
          area_door_m2?: number
          area_glass_m2?: number
          area_total_m2?: number
          created_at?: string
          environment_id?: string | null
          external_temp_c?: number | null
          glass_type?: string
          has_floor_insulation?: boolean
          id?: string
          label?: string
          notes?: string | null
          project_id?: string | null
          soil_temp_c?: number | null
          solar_factor?: number
          solar_level?: string
          sort_order?: number
          surface_type?: string
          u_door_w_m2k?: number
          u_opaque_w_m2k?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_surfaces_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_surfaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coldpro_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_thermal_materials: {
        Row: {
          category: string
          created_at: string
          density_kg_m3: number | null
          id: string
          is_insulation: boolean
          material_name: string
          max_temp_c: number | null
          min_temp_c: number | null
          notes: string | null
          thermal_conductivity_w_mk: number
          typical_thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          density_kg_m3?: number | null
          id?: string
          is_insulation?: boolean
          material_name: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          notes?: string | null
          thermal_conductivity_w_mk: number
          typical_thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          density_kg_m3?: number | null
          id?: string
          is_insulation?: boolean
          material_name?: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          notes?: string | null
          thermal_conductivity_w_mk?: number
          typical_thickness_mm?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      coldpro_tunnels: {
        Row: {
          air_delta_t_k: number
          air_density_kg_m3: number | null
          air_exposure_factor: number | null
          air_flow_method: string | null
          air_temp_c: number
          air_temp_source: string | null
          air_temp_step_c: number
          air_velocity_m_s: number
          air_velocity_step_m_s: number
          air_velocity_used_m_s: number | null
          airflow_m3_h: number
          airflow_source: string | null
          approved_air_delta_t_k: number | null
          approved_air_exposure_factor: number | null
          approved_air_flow_m3_h: number | null
          approved_air_temp_c: number | null
          approved_air_velocity_m_s: number | null
          approved_convective_coefficient_w_m2_k: number | null
          approved_estimated_time_min: number | null
          approved_packaging_type: string | null
          approved_process_status: string | null
          approved_thermal_penetration_factor: number | null
          approved_total_kcal_h: number | null
          approved_total_kw: number | null
          approved_total_tr: number | null
          arrangement_type: string
          ash_content_percent: number | null
          batch_mass_mode: string | null
          batch_time_h: number
          bed_area_m2: number | null
          bed_length_m: number | null
          bed_width_m: number | null
          belt_area_m2: number | null
          belt_calculated_flow_kg_h: number | null
          belt_calculated_retention_min: number | null
          belt_capacity_deviation_percent: number | null
          belt_effective_length_m: number | null
          belt_flow_by_retention_kg_h: number | null
          belt_flow_by_speed_kg_h: number | null
          belt_linear_load_kg_m: number | null
          belt_mass_on_belt_kg: number | null
          belt_motor_dissipation_factor: number | null
          belt_motor_inside_environment: boolean | null
          belt_motor_kw: number
          belt_nominal_capacity_kg_h: number | null
          belt_speed_m_min: number | null
          belt_surface_density_kg_m2: number | null
          belt_width_m: number | null
          block_exposure_factor: number | null
          blockage_factor: number | null
          box_height_m: number | null
          box_length_m: number | null
          box_packaging_weight_kg: number | null
          box_width_m: number | null
          boxes_count: number
          boxes_per_batch: number | null
          boxes_per_layer: number | null
          bulk_layer_height_m: number | null
          calculated_air_velocity_m_s: number | null
          calculated_at: string | null
          calculated_batch_mass_kg: number | null
          calculated_cart_mass_kg: number | null
          calculated_mass_kg_h: number | null
          calculated_pallet_mass_kg: number | null
          calculation_breakdown: Json | null
          calculation_log: Json | null
          calculation_warnings: Json | null
          carbohydrate_content_percent: number | null
          cart_structure_weight_kg: number | null
          characteristic_dimension_m: number | null
          containers_count: number | null
          continuous_mass_mode: string | null
          convective_coefficient_effective_w_m2_k: number | null
          convective_coefficient_manual_w_m2_k: number | null
          convective_coefficient_w_m2_k: number | null
          created_at: string
          cycles_per_hour: number
          density_kg_m3: number | null
          direct_batch_mass_kg: number | null
          distance_to_core_m: number | null
          engine_version: string | null
          environment_id: string
          equivalent_diameter_m: number | null
          equivalent_particle_diameter_m: number | null
          estimated_freezing_time_min: number | null
          fan_airflow_m3_h: number | null
          fat_content_percent: number | null
          feed_rate_kg_h: number | null
          fiber_content_percent: number | null
          free_air_area_m2: number | null
          freezable_water_content_percent: number | null
          freezing_temp_c: number | null
          frozen_water_fraction: number | null
          gross_air_area_m2: number | null
          id: string
          informed_air_flow_m3_h: number | null
          inlet_temp_c: number
          internal_fans_kw: number
          latent_heat_kcal_kg: number
          latent_heat_kj_kg: number | null
          layers_count: number
          mass_flow_mode: string | null
          mass_kg_hour: number
          max_air_temp_c: number
          max_air_velocity_m_s: number
          min_air_temp_c: number
          min_air_velocity_m_s: number
          missing_fields: Json | null
          notes: string | null
          number_of_carts: number | null
          number_of_layers: number | null
          number_of_pallets: number
          operation_mode: string
          optimization_attempts_count: number | null
          optimization_margin_percent: number | null
          optimization_memory: Json
          optimization_status: string | null
          other_internal_kw: number
          outlet_temp_c: number
          package_type: string | null
          packaging_mass_kg_hour: number
          packaging_mass_per_pallet_kg: number | null
          packaging_specific_heat_kcal_kg_c: number
          packaging_weight_kg: number | null
          pallet_base_weight_kg: number | null
          pallet_height_m: number
          pallet_length_m: number
          pallet_mass_kg: number
          pallet_width_m: number
          physical_model: string | null
          process_status: string | null
          process_time_min: number
          process_type: string
          product_diameter_m: number | null
          product_geometry: string | null
          product_height_m: number | null
          product_id: string | null
          product_length_m: number
          product_mass_per_pallet_kg: number | null
          product_name: string
          product_side_m: number | null
          product_thickness_m: number
          product_thickness_mm: number
          product_unit_weight_kg: number
          product_width_m: number
          protein_content_percent: number | null
          racks_count: number | null
          recommended_air_temp_c: number | null
          recommended_air_velocity_m_s: number | null
          recommended_airflow_m3_h: number | null
          respiration_rate_0c_mw_kg: number | null
          respiration_rate_10c_mw_kg: number | null
          respiration_rate_15c_mw_kg: number | null
          respiration_rate_20c_mw_kg: number | null
          respiration_rate_5c_mw_kg: number | null
          retention_status: string | null
          rows_per_meter: number | null
          specific_heat_above_kcal_kg_c: number
          specific_heat_above_kj_kg_k: number | null
          specific_heat_below_kcal_kg_c: number
          specific_heat_below_kj_kg_k: number | null
          spiral_turbulence_factor: number | null
          static_mass_kg: number | null
          static_mass_mode: string | null
          suggested_air_approach_k: number | null
          suggested_air_method: string | null
          suggested_air_temp_c: number | null
          superficial_air_velocity_m_s: number | null
          surface_exposure_model: string | null
          thermal_characteristic_dimension_m: number | null
          thermal_condition_approved: boolean | null
          thermal_condition_approved_at: string | null
          thermal_conductivity_frozen_w_m_k: number | null
          thermal_conductivity_unfrozen_w_m_k: number | null
          thermal_penetration_factor: number | null
          total_units_per_pallet: number | null
          tray_packaging_weight_kg: number | null
          tray_spacing_m: number
          tray_weight_kg: number | null
          trays_per_cart: number | null
          trays_per_hour: number | null
          tunnel_cross_section_height_m: number | null
          tunnel_cross_section_width_m: number | null
          tunnel_internal_load_kw: number | null
          tunnel_packaging_load_kw: number | null
          tunnel_product_load_kw: number | null
          tunnel_total_load_kcal_h: number | null
          tunnel_total_load_kw: number | null
          tunnel_total_load_tr: number | null
          tunnel_type: string
          unit_weight_kg: number
          units_per_box: number | null
          units_per_cycle: number
          units_per_hour: number | null
          units_per_pallet: number | null
          units_per_row: number | null
          units_per_tray: number | null
          updated_at: string
          used_mass_kg_h: number | null
          water_content_percent: number | null
        }
        Insert: {
          air_delta_t_k?: number
          air_density_kg_m3?: number | null
          air_exposure_factor?: number | null
          air_flow_method?: string | null
          air_temp_c?: number
          air_temp_source?: string | null
          air_temp_step_c?: number
          air_velocity_m_s?: number
          air_velocity_step_m_s?: number
          air_velocity_used_m_s?: number | null
          airflow_m3_h?: number
          airflow_source?: string | null
          approved_air_delta_t_k?: number | null
          approved_air_exposure_factor?: number | null
          approved_air_flow_m3_h?: number | null
          approved_air_temp_c?: number | null
          approved_air_velocity_m_s?: number | null
          approved_convective_coefficient_w_m2_k?: number | null
          approved_estimated_time_min?: number | null
          approved_packaging_type?: string | null
          approved_process_status?: string | null
          approved_thermal_penetration_factor?: number | null
          approved_total_kcal_h?: number | null
          approved_total_kw?: number | null
          approved_total_tr?: number | null
          arrangement_type?: string
          ash_content_percent?: number | null
          batch_mass_mode?: string | null
          batch_time_h?: number
          bed_area_m2?: number | null
          bed_length_m?: number | null
          bed_width_m?: number | null
          belt_area_m2?: number | null
          belt_calculated_flow_kg_h?: number | null
          belt_calculated_retention_min?: number | null
          belt_capacity_deviation_percent?: number | null
          belt_effective_length_m?: number | null
          belt_flow_by_retention_kg_h?: number | null
          belt_flow_by_speed_kg_h?: number | null
          belt_linear_load_kg_m?: number | null
          belt_mass_on_belt_kg?: number | null
          belt_motor_dissipation_factor?: number | null
          belt_motor_inside_environment?: boolean | null
          belt_motor_kw?: number
          belt_nominal_capacity_kg_h?: number | null
          belt_speed_m_min?: number | null
          belt_surface_density_kg_m2?: number | null
          belt_width_m?: number | null
          block_exposure_factor?: number | null
          blockage_factor?: number | null
          box_height_m?: number | null
          box_length_m?: number | null
          box_packaging_weight_kg?: number | null
          box_width_m?: number | null
          boxes_count?: number
          boxes_per_batch?: number | null
          boxes_per_layer?: number | null
          bulk_layer_height_m?: number | null
          calculated_air_velocity_m_s?: number | null
          calculated_at?: string | null
          calculated_batch_mass_kg?: number | null
          calculated_cart_mass_kg?: number | null
          calculated_mass_kg_h?: number | null
          calculated_pallet_mass_kg?: number | null
          calculation_breakdown?: Json | null
          calculation_log?: Json | null
          calculation_warnings?: Json | null
          carbohydrate_content_percent?: number | null
          cart_structure_weight_kg?: number | null
          characteristic_dimension_m?: number | null
          containers_count?: number | null
          continuous_mass_mode?: string | null
          convective_coefficient_effective_w_m2_k?: number | null
          convective_coefficient_manual_w_m2_k?: number | null
          convective_coefficient_w_m2_k?: number | null
          created_at?: string
          cycles_per_hour?: number
          density_kg_m3?: number | null
          direct_batch_mass_kg?: number | null
          distance_to_core_m?: number | null
          engine_version?: string | null
          environment_id: string
          equivalent_diameter_m?: number | null
          equivalent_particle_diameter_m?: number | null
          estimated_freezing_time_min?: number | null
          fan_airflow_m3_h?: number | null
          fat_content_percent?: number | null
          feed_rate_kg_h?: number | null
          fiber_content_percent?: number | null
          free_air_area_m2?: number | null
          freezable_water_content_percent?: number | null
          freezing_temp_c?: number | null
          frozen_water_fraction?: number | null
          gross_air_area_m2?: number | null
          id?: string
          informed_air_flow_m3_h?: number | null
          inlet_temp_c?: number
          internal_fans_kw?: number
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          layers_count?: number
          mass_flow_mode?: string | null
          mass_kg_hour?: number
          max_air_temp_c?: number
          max_air_velocity_m_s?: number
          min_air_temp_c?: number
          min_air_velocity_m_s?: number
          missing_fields?: Json | null
          notes?: string | null
          number_of_carts?: number | null
          number_of_layers?: number | null
          number_of_pallets?: number
          operation_mode?: string
          optimization_attempts_count?: number | null
          optimization_margin_percent?: number | null
          optimization_memory?: Json
          optimization_status?: string | null
          other_internal_kw?: number
          outlet_temp_c?: number
          package_type?: string | null
          packaging_mass_kg_hour?: number
          packaging_mass_per_pallet_kg?: number | null
          packaging_specific_heat_kcal_kg_c?: number
          packaging_weight_kg?: number | null
          pallet_base_weight_kg?: number | null
          pallet_height_m?: number
          pallet_length_m?: number
          pallet_mass_kg?: number
          pallet_width_m?: number
          physical_model?: string | null
          process_status?: string | null
          process_time_min?: number
          process_type?: string
          product_diameter_m?: number | null
          product_geometry?: string | null
          product_height_m?: number | null
          product_id?: string | null
          product_length_m?: number
          product_mass_per_pallet_kg?: number | null
          product_name?: string
          product_side_m?: number | null
          product_thickness_m?: number
          product_thickness_mm?: number
          product_unit_weight_kg?: number
          product_width_m?: number
          protein_content_percent?: number | null
          racks_count?: number | null
          recommended_air_temp_c?: number | null
          recommended_air_velocity_m_s?: number | null
          recommended_airflow_m3_h?: number | null
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          retention_status?: string | null
          rows_per_meter?: number | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          spiral_turbulence_factor?: number | null
          static_mass_kg?: number | null
          static_mass_mode?: string | null
          suggested_air_approach_k?: number | null
          suggested_air_method?: string | null
          suggested_air_temp_c?: number | null
          superficial_air_velocity_m_s?: number | null
          surface_exposure_model?: string | null
          thermal_characteristic_dimension_m?: number | null
          thermal_condition_approved?: boolean | null
          thermal_condition_approved_at?: string | null
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          thermal_penetration_factor?: number | null
          total_units_per_pallet?: number | null
          tray_packaging_weight_kg?: number | null
          tray_spacing_m?: number
          tray_weight_kg?: number | null
          trays_per_cart?: number | null
          trays_per_hour?: number | null
          tunnel_cross_section_height_m?: number | null
          tunnel_cross_section_width_m?: number | null
          tunnel_internal_load_kw?: number | null
          tunnel_packaging_load_kw?: number | null
          tunnel_product_load_kw?: number | null
          tunnel_total_load_kcal_h?: number | null
          tunnel_total_load_kw?: number | null
          tunnel_total_load_tr?: number | null
          tunnel_type?: string
          unit_weight_kg?: number
          units_per_box?: number | null
          units_per_cycle?: number
          units_per_hour?: number | null
          units_per_pallet?: number | null
          units_per_row?: number | null
          units_per_tray?: number | null
          updated_at?: string
          used_mass_kg_h?: number | null
          water_content_percent?: number | null
        }
        Update: {
          air_delta_t_k?: number
          air_density_kg_m3?: number | null
          air_exposure_factor?: number | null
          air_flow_method?: string | null
          air_temp_c?: number
          air_temp_source?: string | null
          air_temp_step_c?: number
          air_velocity_m_s?: number
          air_velocity_step_m_s?: number
          air_velocity_used_m_s?: number | null
          airflow_m3_h?: number
          airflow_source?: string | null
          approved_air_delta_t_k?: number | null
          approved_air_exposure_factor?: number | null
          approved_air_flow_m3_h?: number | null
          approved_air_temp_c?: number | null
          approved_air_velocity_m_s?: number | null
          approved_convective_coefficient_w_m2_k?: number | null
          approved_estimated_time_min?: number | null
          approved_packaging_type?: string | null
          approved_process_status?: string | null
          approved_thermal_penetration_factor?: number | null
          approved_total_kcal_h?: number | null
          approved_total_kw?: number | null
          approved_total_tr?: number | null
          arrangement_type?: string
          ash_content_percent?: number | null
          batch_mass_mode?: string | null
          batch_time_h?: number
          bed_area_m2?: number | null
          bed_length_m?: number | null
          bed_width_m?: number | null
          belt_area_m2?: number | null
          belt_calculated_flow_kg_h?: number | null
          belt_calculated_retention_min?: number | null
          belt_capacity_deviation_percent?: number | null
          belt_effective_length_m?: number | null
          belt_flow_by_retention_kg_h?: number | null
          belt_flow_by_speed_kg_h?: number | null
          belt_linear_load_kg_m?: number | null
          belt_mass_on_belt_kg?: number | null
          belt_motor_dissipation_factor?: number | null
          belt_motor_inside_environment?: boolean | null
          belt_motor_kw?: number
          belt_nominal_capacity_kg_h?: number | null
          belt_speed_m_min?: number | null
          belt_surface_density_kg_m2?: number | null
          belt_width_m?: number | null
          block_exposure_factor?: number | null
          blockage_factor?: number | null
          box_height_m?: number | null
          box_length_m?: number | null
          box_packaging_weight_kg?: number | null
          box_width_m?: number | null
          boxes_count?: number
          boxes_per_batch?: number | null
          boxes_per_layer?: number | null
          bulk_layer_height_m?: number | null
          calculated_air_velocity_m_s?: number | null
          calculated_at?: string | null
          calculated_batch_mass_kg?: number | null
          calculated_cart_mass_kg?: number | null
          calculated_mass_kg_h?: number | null
          calculated_pallet_mass_kg?: number | null
          calculation_breakdown?: Json | null
          calculation_log?: Json | null
          calculation_warnings?: Json | null
          carbohydrate_content_percent?: number | null
          cart_structure_weight_kg?: number | null
          characteristic_dimension_m?: number | null
          containers_count?: number | null
          continuous_mass_mode?: string | null
          convective_coefficient_effective_w_m2_k?: number | null
          convective_coefficient_manual_w_m2_k?: number | null
          convective_coefficient_w_m2_k?: number | null
          created_at?: string
          cycles_per_hour?: number
          density_kg_m3?: number | null
          direct_batch_mass_kg?: number | null
          distance_to_core_m?: number | null
          engine_version?: string | null
          environment_id?: string
          equivalent_diameter_m?: number | null
          equivalent_particle_diameter_m?: number | null
          estimated_freezing_time_min?: number | null
          fan_airflow_m3_h?: number | null
          fat_content_percent?: number | null
          feed_rate_kg_h?: number | null
          fiber_content_percent?: number | null
          free_air_area_m2?: number | null
          freezable_water_content_percent?: number | null
          freezing_temp_c?: number | null
          frozen_water_fraction?: number | null
          gross_air_area_m2?: number | null
          id?: string
          informed_air_flow_m3_h?: number | null
          inlet_temp_c?: number
          internal_fans_kw?: number
          latent_heat_kcal_kg?: number
          latent_heat_kj_kg?: number | null
          layers_count?: number
          mass_flow_mode?: string | null
          mass_kg_hour?: number
          max_air_temp_c?: number
          max_air_velocity_m_s?: number
          min_air_temp_c?: number
          min_air_velocity_m_s?: number
          missing_fields?: Json | null
          notes?: string | null
          number_of_carts?: number | null
          number_of_layers?: number | null
          number_of_pallets?: number
          operation_mode?: string
          optimization_attempts_count?: number | null
          optimization_margin_percent?: number | null
          optimization_memory?: Json
          optimization_status?: string | null
          other_internal_kw?: number
          outlet_temp_c?: number
          package_type?: string | null
          packaging_mass_kg_hour?: number
          packaging_mass_per_pallet_kg?: number | null
          packaging_specific_heat_kcal_kg_c?: number
          packaging_weight_kg?: number | null
          pallet_base_weight_kg?: number | null
          pallet_height_m?: number
          pallet_length_m?: number
          pallet_mass_kg?: number
          pallet_width_m?: number
          physical_model?: string | null
          process_status?: string | null
          process_time_min?: number
          process_type?: string
          product_diameter_m?: number | null
          product_geometry?: string | null
          product_height_m?: number | null
          product_id?: string | null
          product_length_m?: number
          product_mass_per_pallet_kg?: number | null
          product_name?: string
          product_side_m?: number | null
          product_thickness_m?: number
          product_thickness_mm?: number
          product_unit_weight_kg?: number
          product_width_m?: number
          protein_content_percent?: number | null
          racks_count?: number | null
          recommended_air_temp_c?: number | null
          recommended_air_velocity_m_s?: number | null
          recommended_airflow_m3_h?: number | null
          respiration_rate_0c_mw_kg?: number | null
          respiration_rate_10c_mw_kg?: number | null
          respiration_rate_15c_mw_kg?: number | null
          respiration_rate_20c_mw_kg?: number | null
          respiration_rate_5c_mw_kg?: number | null
          retention_status?: string | null
          rows_per_meter?: number | null
          specific_heat_above_kcal_kg_c?: number
          specific_heat_above_kj_kg_k?: number | null
          specific_heat_below_kcal_kg_c?: number
          specific_heat_below_kj_kg_k?: number | null
          spiral_turbulence_factor?: number | null
          static_mass_kg?: number | null
          static_mass_mode?: string | null
          suggested_air_approach_k?: number | null
          suggested_air_method?: string | null
          suggested_air_temp_c?: number | null
          superficial_air_velocity_m_s?: number | null
          surface_exposure_model?: string | null
          thermal_characteristic_dimension_m?: number | null
          thermal_condition_approved?: boolean | null
          thermal_condition_approved_at?: string | null
          thermal_conductivity_frozen_w_m_k?: number | null
          thermal_conductivity_unfrozen_w_m_k?: number | null
          thermal_penetration_factor?: number | null
          total_units_per_pallet?: number | null
          tray_packaging_weight_kg?: number | null
          tray_spacing_m?: number
          tray_weight_kg?: number | null
          trays_per_cart?: number | null
          trays_per_hour?: number | null
          tunnel_cross_section_height_m?: number | null
          tunnel_cross_section_width_m?: number | null
          tunnel_internal_load_kw?: number | null
          tunnel_packaging_load_kw?: number | null
          tunnel_product_load_kw?: number | null
          tunnel_total_load_kcal_h?: number | null
          tunnel_total_load_kw?: number | null
          tunnel_total_load_tr?: number | null
          tunnel_type?: string
          unit_weight_kg?: number
          units_per_box?: number | null
          units_per_cycle?: number
          units_per_hour?: number | null
          units_per_pallet?: number | null
          units_per_row?: number | null
          units_per_tray?: number | null
          updated_at?: string
          used_mass_kg_h?: number | null
          water_content_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_tunnels_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "coldpro_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      coldpro_wall_compositions: {
        Row: {
          created_at: string
          id: string
          layer_order: number
          material_id: string | null
          material_name: string
          notes: string | null
          surface_id: string
          thermal_conductivity_w_m_k: number
          thickness_m: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          layer_order?: number
          material_id?: string | null
          material_name: string
          notes?: string | null
          surface_id: string
          thermal_conductivity_w_m_k?: number
          thickness_m?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          layer_order?: number
          material_id?: string | null
          material_name?: string
          notes?: string | null
          surface_id?: string
          thermal_conductivity_w_m_k?: number
          thickness_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coldpro_wall_compositions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "coldpro_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coldpro_wall_compositions_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "coldpro_surfaces"
            referencedColumns: ["id"]
          },
        ]
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
      crm_activities: {
        Row: {
          assigned_to: string
          assigned_to_name: string | null
          client_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          description: string | null
          duration_min: number | null
          id: string
          lead_id: string | null
          outcome: string | null
          proposal_id: string | null
          reschedule_of: string | null
          scheduled_at: string
          status: string
          title: string
          type: string
          updated_at: string
          visibility: Database["public"]["Enums"]["productivity_visibility"]
        }
        Insert: {
          assigned_to: string
          assigned_to_name?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          proposal_id?: string | null
          reschedule_of?: string | null
          scheduled_at: string
          status?: string
          title: string
          type: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
        }
        Update: {
          assigned_to?: string
          assigned_to_name?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          proposal_id?: string | null
          reschedule_of?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_reschedule_of_fkey"
            columns: ["reschedule_of"]
            isOneToOne: false
            referencedRelation: "crm_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_agenda: {
        Row: {
          client_name: string
          closer_confirmou: boolean
          closer_confirmou_at: string | null
          closer_nome: string
          contato_cliente: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          data_proxima_acao: string | null
          duracao_min: number
          email_cliente: string | null
          id: string
          lembrete_enviado: boolean
          link_reuniao: string | null
          local: string | null
          observacoes: string | null
          pipeline_id: string | null
          proposal_number: string | null
          proxima_acao: string | null
          resultado: string | null
          sdr_nome: string | null
          status: string
          telefone_cliente: string | null
          tipo: string
          updated_at: string
          visibility: Database["public"]["Enums"]["productivity_visibility"]
        }
        Insert: {
          client_name: string
          closer_confirmou?: boolean
          closer_confirmou_at?: string | null
          closer_nome: string
          contato_cliente?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          data_proxima_acao?: string | null
          duracao_min?: number
          email_cliente?: string | null
          id?: string
          lembrete_enviado?: boolean
          link_reuniao?: string | null
          local?: string | null
          observacoes?: string | null
          pipeline_id?: string | null
          proposal_number?: string | null
          proxima_acao?: string | null
          resultado?: string | null
          sdr_nome?: string | null
          status?: string
          telefone_cliente?: string | null
          tipo: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
        }
        Update: {
          client_name?: string
          closer_confirmou?: boolean
          closer_confirmou_at?: string | null
          closer_nome?: string
          contato_cliente?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          data_proxima_acao?: string | null
          duracao_min?: number
          email_cliente?: string | null
          id?: string
          lembrete_enviado?: boolean
          link_reuniao?: string | null
          local?: string | null
          observacoes?: string | null
          pipeline_id?: string | null
          proposal_number?: string | null
          proxima_acao?: string | null
          resultado?: string | null
          sdr_nome?: string | null
          status?: string
          telefone_cliente?: string | null
          tipo?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
        }
        Relationships: []
      }
      crm_agenda_lembretes: {
        Row: {
          agenda_id: string | null
          canal: string
          enviado: boolean
          enviar_em: string
          id: string
          tipo: string
        }
        Insert: {
          agenda_id?: string | null
          canal?: string
          enviado?: boolean
          enviar_em: string
          id?: string
          tipo: string
        }
        Update: {
          agenda_id?: string | null
          canal?: string
          enviado?: boolean
          enviar_em?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_agenda_lembretes_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "crm_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_attachments: {
        Row: {
          id: string
          mime_type: string | null
          name: string
          process_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          mime_type?: string | null
          name: string
          process_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          mime_type?: string | null
          name?: string
          process_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_attachments_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_call_logs: {
        Row: {
          call_date: string
          call_time: string | null
          channel: string
          created_at: string
          duration_min: number | null
          encerrado_em: string | null
          id: string
          meeting_booked: boolean
          numero_discado: string | null
          observation: string | null
          pipeline_id: string | null
          proof_path: string | null
          proof_validated: boolean
          result: string | null
          sdr_id: string | null
          sdr_name: string
          temperature_after: string | null
        }
        Insert: {
          call_date?: string
          call_time?: string | null
          channel?: string
          created_at?: string
          duration_min?: number | null
          encerrado_em?: string | null
          id?: string
          meeting_booked?: boolean
          numero_discado?: string | null
          observation?: string | null
          pipeline_id?: string | null
          proof_path?: string | null
          proof_validated?: boolean
          result?: string | null
          sdr_id?: string | null
          sdr_name: string
          temperature_after?: string | null
        }
        Update: {
          call_date?: string
          call_time?: string | null
          channel?: string
          created_at?: string
          duration_min?: number | null
          encerrado_em?: string | null
          id?: string
          meeting_booked?: boolean
          numero_discado?: string | null
          observation?: string | null
          pipeline_id?: string | null
          proof_path?: string | null
          proof_validated?: boolean
          result?: string | null
          sdr_id?: string | null
          sdr_name?: string
          temperature_after?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_logs_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_call_script_templates: {
        Row: {
          closing: string
          created_at: string
          created_by: string | null
          description: string | null
          discovery_questions: Json
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          objections: Json
          opening: string
          updated_at: string
          whatsapp_followup: string
        }
        Insert: {
          closing?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_questions?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          objections?: Json
          opening?: string
          updated_at?: string
          whatsapp_followup?: string
        }
        Update: {
          closing?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_questions?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          objections?: Json
          opening?: string
          updated_at?: string
          whatsapp_followup?: string
        }
        Relationships: []
      }
      crm_campanhas: {
        Row: {
          ativo: boolean
          concorrente: string | null
          cor: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          fonte: string
          icone: string
          id: string
          nome: string
          readonly: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          concorrente?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          fonte?: string
          icone?: string
          id?: string
          nome: string
          readonly?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          concorrente?: string | null
          cor?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          fonte?: string
          icone?: string
          id?: string
          nome?: string
          readonly?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      crm_closer_metas: {
        Row: {
          closer_nome: string
          created_at: string
          id: string
          mes: string
          meta_ganhas: number
          meta_propostas: number
          meta_receita: number
          meta_reunioes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          closer_nome: string
          created_at?: string
          id?: string
          mes: string
          meta_ganhas?: number
          meta_propostas?: number
          meta_receita?: number
          meta_reunioes?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          closer_nome?: string
          created_at?: string
          id?: string
          mes?: string
          meta_ganhas?: number
          meta_propostas?: number
          meta_receita?: number
          meta_reunioes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_closer_metas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cobertura_historico: {
        Row: {
          ativas: number | null
          criado_em: string | null
          data: string
          frias: number | null
          id: string
          nunca_contatadas: number | null
          pct_ativa: number | null
          sem_cobertura: number | null
          total: number | null
          valor_ativo: number | null
          valor_total: number | null
        }
        Insert: {
          ativas?: number | null
          criado_em?: string | null
          data?: string
          frias?: number | null
          id?: string
          nunca_contatadas?: number | null
          pct_ativa?: number | null
          sem_cobertura?: number | null
          total?: number | null
          valor_ativo?: number | null
          valor_total?: number | null
        }
        Update: {
          ativas?: number | null
          criado_em?: string | null
          data?: string
          frias?: number | null
          id?: string
          nunca_contatadas?: number | null
          pct_ativa?: number | null
          sem_cobertura?: number | null
          total?: number | null
          valor_ativo?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      crm_followups: {
        Row: {
          created_at: string
          created_by: string | null
          done_at: string | null
          id: string
          note: string | null
          process_id: string
          scheduled_for: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          note?: string | null
          process_id: string
          scheduled_for: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          note?: string | null
          process_id?: string
          scheduled_for?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funnel_stages: {
        Row: {
          color: string | null
          created_at: string
          display_order: number
          etapa: string
          first_seen_at: string
          id: string
          is_hidden: boolean
          is_lost: boolean
          is_won: boolean
          last_seen_at: string
          tipo: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number
          etapa: string
          first_seen_at?: string
          id?: string
          is_hidden?: boolean
          is_lost?: boolean
          is_won?: boolean
          last_seen_at?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number
          etapa?: string
          first_seen_at?: string
          id?: string
          is_hidden?: boolean
          is_lost?: boolean
          is_won?: boolean
          last_seen_at?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          process_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          process_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_process_meta: {
        Row: {
          created_at: string
          decisor: string | null
          interesse: string | null
          probabilidade_label: string | null
          probabilidade_pct: number | null
          process_id: string
          projeto_estado: string | null
          segmento_override: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          decisor?: string | null
          interesse?: string | null
          probabilidade_label?: string | null
          probabilidade_pct?: number | null
          process_id: string
          projeto_estado?: string | null
          segmento_override?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          decisor?: string | null
          interesse?: string | null
          probabilidade_label?: string | null
          probabilidade_pct?: number | null
          process_id?: string
          projeto_estado?: string | null
          segmento_override?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_process_meta_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_process_proposals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          nomus_proposal_id: string | null
          process_id: string
          proposal_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          nomus_proposal_id?: string | null
          process_id: string
          proposal_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          nomus_proposal_id?: string | null
          process_id?: string
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_process_proposals_nomus_proposal_id_fkey"
            columns: ["nomus_proposal_id"]
            isOneToOne: false
            referencedRelation: "nomus_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_process_proposals_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_process_proposals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stage_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_etapa: string | null
          id: string
          process_id: string
          to_etapa: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_etapa?: string | null
          id?: string
          process_id: string
          to_etapa: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_etapa?: string | null
          id?: string
          process_id?: string
          to_etapa?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stage_changes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "nomus_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          push_token: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          push_token?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          push_token?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_user_funnels: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_weekly_reviews: {
        Row: {
          bottlenecks: string | null
          created_at: string
          hot_deals_count: number
          id: string
          learnings: string | null
          meetings_booked: number
          meetings_held: number
          next_week_plan: string | null
          total_calls: number
          week_start: string
        }
        Insert: {
          bottlenecks?: string | null
          created_at?: string
          hot_deals_count?: number
          id?: string
          learnings?: string | null
          meetings_booked?: number
          meetings_held?: number
          next_week_plan?: string | null
          total_calls?: number
          week_start: string
        }
        Update: {
          bottlenecks?: string | null
          created_at?: string
          hot_deals_count?: number
          id?: string
          learnings?: string | null
          meetings_booked?: number
          meetings_held?: number
          next_week_plan?: string | null
          total_calls?: number
          week_start?: string
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
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          line_id: string | null
          merged_at: string | null
          merged_into_id: string | null
          model: string
          nomus_id: string | null
          nomus_synced_at: string | null
          normalized_model: string | null
          normalized_model_code: string | null
          refrigerant: string | null
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          line_id?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          model: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          normalized_model?: string | null
          normalized_model_code?: string | null
          refrigerant?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          line_id?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          model?: string
          nomus_id?: string | null
          nomus_synced_at?: string | null
          normalized_model?: string | null
          normalized_model_code?: string | null
          refrigerant?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          tags?: string[] | null
          technical_notes?: string | null
          updated_at?: string
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "equipment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_lead_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          event_type: string
          id: string
          lead_id: string
          payload: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type: string
          id?: string
          lead_id: string
          payload?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lead_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_lead_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          aplicacao: string | null
          assigned_at: string | null
          assigned_to: string | null
          city: string | null
          client_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_at: string | null
          converted_to_sdr_lead_id: string | null
          created_at: string
          discard_reason: string | null
          first_response_at: string | null
          id: string
          internal_note: string | null
          lead_code: string
          lock_expires_at: string | null
          locked_at: string | null
          locked_by_sdr_id: string | null
          locked_by_sdr_name: string | null
          mensagem: string | null
          origem: string
          origem_detalhe: Json | null
          qualified_at: string | null
          received_at: string
          segmento: string | null
          state: string | null
          status: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at: string
        }
        Insert: {
          aplicacao?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_to_sdr_lead_id?: string | null
          created_at?: string
          discard_reason?: string | null
          first_response_at?: string | null
          id?: string
          internal_note?: string | null
          lead_code: string
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by_sdr_id?: string | null
          locked_by_sdr_name?: string | null
          mensagem?: string | null
          origem?: string
          origem_detalhe?: Json | null
          qualified_at?: string | null
          received_at?: string
          segmento?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at?: string
        }
        Update: {
          aplicacao?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_to_sdr_lead_id?: string | null
          created_at?: string
          discard_reason?: string | null
          first_response_at?: string | null
          id?: string
          internal_note?: string | null
          lead_code?: string
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by_sdr_id?: string | null
          locked_by_sdr_name?: string | null
          mensagem?: string | null
          origem?: string
          origem_detalhe?: Json | null
          qualified_at?: string | null
          received_at?: string
          segmento?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_converted_to_sdr_lead_id_fkey"
            columns: ["converted_to_sdr_lead_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_remarketing_queue: {
        Row: {
          added_by: string | null
          added_by_name: string | null
          campaign_name: string | null
          city: string | null
          client_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          lead_code: string | null
          mensagem: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          scheduled_for: string | null
          segmento: string | null
          source: string
          source_lead_id: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_by_name?: string | null
          campaign_name?: string | null
          city?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lead_code?: string | null
          mensagem?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          scheduled_for?: string | null
          segmento?: string | null
          source: string
          source_lead_id: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_by_name?: string | null
          campaign_name?: string | null
          city?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lead_code?: string | null
          mensagem?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          scheduled_for?: string | null
          segmento?: string | null
          source?: string
          source_lead_id?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      nomus_price_audit_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomus_price_audit_ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_audit_ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_price_audit_ai_sessions: {
        Row: {
          audit_snapshot: Json
          created_at: string
          id: string
          last_question: string | null
          last_response: string | null
          report_markdown: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_snapshot?: Json
          created_at?: string
          id?: string
          last_question?: string | null
          last_response?: string | null
          report_markdown?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_snapshot?: Json
          created_at?: string
          id?: string
          last_question?: string | null
          last_response?: string | null
          report_markdown?: string
          title?: string
          updated_at?: string
          user_id?: string
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
          ufs: string[]
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
          ufs?: string[]
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
          ufs?: string[]
        }
        Relationships: []
      }
      nomus_process_sync_jobs: {
        Row: {
          created_at: string
          current_page: number
          entity: string
          finished_at: string | null
          id: string
          last_error: string | null
          max_items: number
          page_size: number
          processed_items: number
          requested_by: string
          stages_discovered: number
          started_at: string | null
          status: string
          tipos: string[]
          updated_at: string
          upserted_items: number
        }
        Insert: {
          created_at?: string
          current_page?: number
          entity?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_items?: number
          page_size?: number
          processed_items?: number
          requested_by: string
          stages_discovered?: number
          started_at?: string | null
          status?: string
          tipos?: string[]
          updated_at?: string
          upserted_items?: number
        }
        Update: {
          created_at?: string
          current_page?: number
          entity?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_items?: number
          page_size?: number
          processed_items?: number
          requested_by?: string
          stages_discovered?: number
          started_at?: string | null
          status?: string
          tipos?: string[]
          updated_at?: string
          upserted_items?: number
        }
        Relationships: []
      }
      nomus_processes: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_criacao: string | null
          data_hora_programada: string | null
          descricao: string | null
          equipe: string | null
          etapa: string | null
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          id_prioridade: number | null
          is_active: boolean
          last_pull_error: string | null
          last_push_error: string | null
          last_pushed_at: string | null
          last_synced_at: string | null
          local_dirty: boolean
          nome: string | null
          nomus_id: string
          origem: string | null
          pessoa: string | null
          prioridade: string | null
          proposal_id: string | null
          proximo_contato: string | null
          raw: Json | null
          reportador: string | null
          responsavel: string | null
          sync_hash: string | null
          synced_at: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_criacao?: string | null
          data_hora_programada?: string | null
          descricao?: string | null
          equipe?: string | null
          etapa?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          id_prioridade?: number | null
          is_active?: boolean
          last_pull_error?: string | null
          last_push_error?: string | null
          last_pushed_at?: string | null
          last_synced_at?: string | null
          local_dirty?: boolean
          nome?: string | null
          nomus_id: string
          origem?: string | null
          pessoa?: string | null
          prioridade?: string | null
          proposal_id?: string | null
          proximo_contato?: string | null
          raw?: Json | null
          reportador?: string | null
          responsavel?: string | null
          sync_hash?: string | null
          synced_at?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_criacao?: string | null
          data_hora_programada?: string | null
          descricao?: string | null
          equipe?: string | null
          etapa?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          id_prioridade?: number | null
          is_active?: boolean
          last_pull_error?: string | null
          last_push_error?: string | null
          last_pushed_at?: string | null
          last_synced_at?: string | null
          local_dirty?: boolean
          nome?: string | null
          nomus_id?: string
          origem?: string | null
          pessoa?: string | null
          prioridade?: string | null
          proposal_id?: string | null
          proximo_contato?: string | null
          raw?: Json | null
          reportador?: string | null
          responsavel?: string | null
          sync_hash?: string | null
          synced_at?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nomus_product_equipment_links: {
        Row: {
          confidence_score: number
          created_at: string
          equipment_id: string | null
          id: string
          match_type: string
          nomus_product_id: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          equipment_id?: string | null
          id?: string
          match_type?: string
          nomus_product_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          confidence_score?: number
          created_at?: string
          equipment_id?: string | null
          id?: string
          match_type?: string
          nomus_product_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nomus_product_equipment_links_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_proposal_items: {
        Row: {
          additional_info: string | null
          analise_lucro: Json | null
          description: string | null
          discount: number | null
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          impostos: Json | null
          is_active: boolean
          item_status: string | null
          last_sync_run_id: string | null
          last_synced_at: string | null
          nomus_item_id: string | null
          nomus_product_id: string | null
          nomus_proposal_id: string
          normalized_model_code: string | null
          position: number | null
          prazo_entrega_dias: number | null
          price_table_id: string | null
          price_table_match_method: string | null
          price_table_name: string | null
          price_table_nomus_id: string | null
          product_code: string | null
          quantity: number | null
          raw: Json | null
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          impostos?: Json | null
          is_active?: boolean
          item_status?: string | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          nomus_item_id?: string | null
          nomus_product_id?: string | null
          nomus_proposal_id: string
          normalized_model_code?: string | null
          position?: number | null
          prazo_entrega_dias?: number | null
          price_table_id?: string | null
          price_table_match_method?: string | null
          price_table_name?: string | null
          price_table_nomus_id?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          impostos?: Json | null
          is_active?: boolean
          item_status?: string | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          nomus_item_id?: string | null
          nomus_product_id?: string | null
          nomus_proposal_id?: string
          normalized_model_code?: string | null
          position?: number | null
          prazo_entrega_dias?: number | null
          price_table_id?: string | null
          price_table_match_method?: string | null
          price_table_name?: string | null
          price_table_nomus_id?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          synced_at?: string
          total?: number | null
          total_with_discount?: number | null
          unit_price?: number | null
          unit_value_with_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nomus_proposal_items_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomus_proposal_items_nomus_proposal_id_fkey"
            columns: ["nomus_proposal_id"]
            isOneToOne: false
            referencedRelation: "nomus_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomus_proposal_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_tables"
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
          external_deleted_at: string | null
          external_updated_at: string | null
          frete_percentual: number | null
          frete_valor: number | null
          ibs_estadual_recolher: number | null
          ibs_recolher: number | null
          icms_recolher: number | null
          icms_st_recolher: number | null
          id: string
          ipi_recolher: number | null
          is_active: boolean
          issqn_recolher: number | null
          last_sync_run_id: string | null
          last_synced_at: string | null
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
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          frete_percentual?: number | null
          frete_valor?: number | null
          ibs_estadual_recolher?: number | null
          ibs_recolher?: number | null
          icms_recolher?: number | null
          icms_st_recolher?: number | null
          id?: string
          ipi_recolher?: number | null
          is_active?: boolean
          issqn_recolher?: number | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
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
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
          external_deleted_at?: string | null
          external_updated_at?: string | null
          frete_percentual?: number | null
          frete_valor?: number | null
          ibs_estadual_recolher?: number | null
          ibs_recolher?: number | null
          icms_recolher?: number | null
          icms_st_recolher?: number | null
          id?: string
          ipi_recolher?: number | null
          is_active?: boolean
          issqn_recolher?: number | null
          last_sync_run_id?: string | null
          last_synced_at?: string | null
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
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
        Relationships: [
          {
            foreignKeyName: "nomus_proposals_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
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
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          name: string
          nomus_id: string
          raw: Json | null
          region: string | null
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
          synced_at: string
        }
        Insert: {
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name: string
          nomus_id: string
          raw?: Json | null
          region?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          synced_at?: string
        }
        Update: {
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name?: string
          nomus_id?: string
          raw?: Json | null
          region?: string | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomus_representatives_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      nomus_sellers: {
        Row: {
          document: string | null
          email: string | null
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          name: string
          nomus_id: string
          raw: Json | null
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
          synced_at: string
        }
        Insert: {
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name: string
          nomus_id: string
          raw?: Json | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          synced_at?: string
        }
        Update: {
          document?: string | null
          email?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          name?: string
          nomus_id?: string
          raw?: Json | null
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomus_sellers_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
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
      outbound_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          entity_type: string
          external_id: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          local_id: string
          max_attempts: number
          next_attempt_at: string | null
          operation: string
          payload: Json
          processed_at: string | null
          source_system: string
          status: string
          sync_run_id: string | null
          target_system: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          entity_type: string
          external_id?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          local_id: string
          max_attempts?: number
          next_attempt_at?: string | null
          operation: string
          payload?: Json
          processed_at?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
          target_system?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          entity_type?: string
          external_id?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          local_id?: string
          max_attempts?: number
          next_attempt_at?: string | null
          operation?: string
          payload?: Json
          processed_at?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
          target_system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_sync_queue_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_condition_preset_installments: {
        Row: {
          created_at: string
          days: number
          description: string
          id: string
          percentage: number
          preset_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          description: string
          id?: string
          percentage: number
          preset_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          description?: string
          id?: string
          percentage?: number
          preset_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_condition_preset_installments_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "payment_condition_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_condition_presets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_source: string
          access_status: string
          avatar_url: string | null
          blocked_reason: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          must_change_password: boolean
          nomus_seller_id: string | null
          nomus_user_id: string | null
          nomus_vendedor_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          access_source?: string
          access_status?: string
          avatar_url?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          job_title?: string | null
          must_change_password?: boolean
          nomus_seller_id?: string | null
          nomus_user_id?: string | null
          nomus_vendedor_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          access_source?: string
          access_status?: string
          avatar_url?: string | null
          blocked_reason?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          nomus_seller_id?: string | null
          nomus_user_id?: string | null
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
          created_at: string
          id: string
          last_edited_at: string
          last_edited_by: string | null
          pages: Json
          proposal_id: string
          template_id: string | null
          template_version: string
          updated_at: string
        }
        Insert: {
          attached_pdf_paths?: string[]
          auto_filled_at?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          pages?: Json
          proposal_id: string
          template_id?: string | null
          template_version?: string
          updated_at?: string
        }
        Update: {
          attached_pdf_paths?: string[]
          auto_filled_at?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          pages?: Json
          proposal_id?: string
          template_id?: string | null
          template_version?: string
          updated_at?: string
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
      proposal_financial_history: {
        Row: {
          created_at: string
          id: string
          new_final_amount: number | null
          new_financial_additional_cost: number | null
          previous_final_amount: number | null
          previous_financial_additional_cost: number | null
          proposal_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_final_amount?: number | null
          new_financial_additional_cost?: number | null
          previous_final_amount?: number | null
          previous_financial_additional_cost?: number | null
          proposal_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_final_amount?: number | null
          new_financial_additional_cost?: number | null
          previous_final_amount?: number | null
          previous_financial_additional_cost?: number | null
          proposal_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_financial_history_proposal_id_fkey"
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
          external_deleted_at: string | null
          external_updated_at: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          merged_at: string | null
          merged_into_id: string | null
          nomus_item_id: string | null
          nomus_raw: Json | null
          nomus_synced_at: string | null
          notes: string | null
          position: number | null
          price_table_custo_cif: number | null
          price_table_custo_materiais: number | null
          price_table_custo_mod: number | null
          price_table_custo_producao_total: number | null
          price_table_custos_adm: number | null
          price_table_custos_venda: number | null
          price_table_id: string | null
          price_table_lucro_bruto: number | null
          price_table_lucro_liquido: number | null
          price_table_margem_contribuicao: number | null
          price_table_margem_desejada_pct: number | null
          price_table_match_method: string | null
          price_table_name: string | null
          price_table_nomus_id: string | null
          price_table_preco_calculado: number | null
          price_table_preco_liquido: number | null
          price_table_selected_at: string | null
          price_table_unit_price: number | null
          proposal_id: string
          quantity: number
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          equipment_id?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          nomus_item_id?: string | null
          nomus_raw?: Json | null
          nomus_synced_at?: string | null
          notes?: string | null
          position?: number | null
          price_table_custo_cif?: number | null
          price_table_custo_materiais?: number | null
          price_table_custo_mod?: number | null
          price_table_custo_producao_total?: number | null
          price_table_custos_adm?: number | null
          price_table_custos_venda?: number | null
          price_table_id?: string | null
          price_table_lucro_bruto?: number | null
          price_table_lucro_liquido?: number | null
          price_table_margem_contribuicao?: number | null
          price_table_margem_desejada_pct?: number | null
          price_table_match_method?: string | null
          price_table_name?: string | null
          price_table_nomus_id?: string | null
          price_table_preco_calculado?: number | null
          price_table_preco_liquido?: number | null
          price_table_selected_at?: string | null
          price_table_unit_price?: number | null
          proposal_id: string
          quantity?: number
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
          total_price?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          nomus_item_id?: string | null
          nomus_raw?: Json | null
          nomus_synced_at?: string | null
          notes?: string | null
          position?: number | null
          price_table_custo_cif?: number | null
          price_table_custo_materiais?: number | null
          price_table_custo_mod?: number | null
          price_table_custo_producao_total?: number | null
          price_table_custos_adm?: number | null
          price_table_custos_venda?: number | null
          price_table_id?: string | null
          price_table_lucro_bruto?: number | null
          price_table_lucro_liquido?: number | null
          price_table_margem_contribuicao?: number | null
          price_table_margem_desejada_pct?: number | null
          price_table_match_method?: string | null
          price_table_name?: string | null
          price_table_nomus_id?: string | null
          price_table_preco_calculado?: number | null
          price_table_preco_liquido?: number | null
          price_table_selected_at?: string | null
          price_table_unit_price?: number | null
          proposal_id?: string
          quantity?: number
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
            foreignKeyName: "proposal_items_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "nomus_price_tables"
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
          visibility: Database["public"]["Enums"]["productivity_visibility"]
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
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
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
          visibility?: Database["public"]["Enums"]["productivity_visibility"]
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
          pages_template: Json
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
          pages_template?: Json
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
          pages_template?: Json
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
          expected_closing_date: string | null
          external_deleted_at: string | null
          external_updated_at: string | null
          final_amount_with_financial_cost: number | null
          financial_additional_cost: number | null
          financial_avg_term_days: number | null
          financial_factor_pct: number | null
          financial_preset_id: string | null
          financial_rate_type: string | null
          id: string
          is_active: boolean
          last_sync_run_id: string | null
          last_synced_at: string | null
          lead_origin: string | null
          loss_competitor: string | null
          loss_notes: string | null
          loss_price_diff_pct: number | null
          loss_reason: string | null
          merged_at: string | null
          merged_into_id: string | null
          monthly_financial_rate_pct: number | null
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
          original_proposal_amount: number | null
          payment_condition_snapshot: Json | null
          payment_term_id: string | null
          payment_terms: string | null
          price_table_id: string | null
          region: string | null
          sales_owner_id: string | null
          segment: string | null
          sent_at: string | null
          source: Database["public"]["Enums"]["proposal_source"]
          status: Database["public"]["Enums"]["proposal_status"]
          sync_error_code: string | null
          sync_error_message: string | null
          sync_hash: string | null
          sync_status: string
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
          expected_closing_date?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          final_amount_with_financial_cost?: number | null
          financial_additional_cost?: number | null
          financial_avg_term_days?: number | null
          financial_factor_pct?: number | null
          financial_preset_id?: string | null
          financial_rate_type?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          lead_origin?: string | null
          loss_competitor?: string | null
          loss_notes?: string | null
          loss_price_diff_pct?: number | null
          loss_reason?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          monthly_financial_rate_pct?: number | null
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
          original_proposal_amount?: number | null
          payment_condition_snapshot?: Json | null
          payment_term_id?: string | null
          payment_terms?: string | null
          price_table_id?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
          source?: Database["public"]["Enums"]["proposal_source"]
          status?: Database["public"]["Enums"]["proposal_status"]
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
          expected_closing_date?: string | null
          external_deleted_at?: string | null
          external_updated_at?: string | null
          final_amount_with_financial_cost?: number | null
          financial_additional_cost?: number | null
          financial_avg_term_days?: number | null
          financial_factor_pct?: number | null
          financial_preset_id?: string | null
          financial_rate_type?: string | null
          id?: string
          is_active?: boolean
          last_sync_run_id?: string | null
          last_synced_at?: string | null
          lead_origin?: string | null
          loss_competitor?: string | null
          loss_notes?: string | null
          loss_price_diff_pct?: number | null
          loss_reason?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          monthly_financial_rate_pct?: number | null
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
          original_proposal_amount?: number | null
          payment_condition_snapshot?: Json | null
          payment_term_id?: string | null
          payment_terms?: string | null
          price_table_id?: string | null
          region?: string | null
          sales_owner_id?: string | null
          segment?: string | null
          sent_at?: string | null
          source?: Database["public"]["Enums"]["proposal_source"]
          status?: Database["public"]["Enums"]["proposal_status"]
          sync_error_code?: string | null
          sync_error_message?: string | null
          sync_hash?: string | null
          sync_status?: string
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
            foreignKeyName: "proposals_financial_preset_id_fkey"
            columns: ["financial_preset_id"]
            isOneToOne: false
            referencedRelation: "payment_condition_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_last_sync_run_id_fkey"
            columns: ["last_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
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
      role_module_access: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          module_key: string
          module_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          module_key: string
          module_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          module_key?: string
          module_path?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      role_permission_templates: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sdr_followups: {
        Row: {
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          id: string
          lead_id: string
          note: string | null
          scheduled_at: string
          sdr_id: string | null
          sdr_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          lead_id: string
          note?: string | null
          scheduled_at: string
          sdr_id?: string | null
          sdr_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          scheduled_at?: string
          sdr_id?: string | null
          sdr_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_lead_edits: {
        Row: {
          created_at: string
          edited_by: string | null
          edited_by_name: string | null
          field: string
          id: string
          lead_id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          reverted_from_edit_id: string | null
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          edited_by_name?: string | null
          field: string
          id?: string
          lead_id: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          reverted_from_edit_id?: string | null
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          edited_by_name?: string | null
          field?: string
          id?: string
          lead_id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          reverted_from_edit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_lead_edits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_lead_edits_reverted_from_edit_id_fkey"
            columns: ["reverted_from_edit_id"]
            isOneToOne: false
            referencedRelation: "sdr_lead_edits"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_lead_tratativas: {
        Row: {
          body: string
          channel: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          file_mime: string | null
          file_name: string | null
          file_size: number | null
          id: string
          lead_id: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          lead_id: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          lead_id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_lead_tratativas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sdr_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_leads: {
        Row: {
          bant_authority: string | null
          bant_budget: string | null
          bant_need: string | null
          bant_score: number | null
          bant_timeline: string | null
          call_observation: string | null
          call_result: string | null
          campanha_id: string | null
          city: string | null
          client_name: string
          closer_confirmed: string
          closer_id: string | null
          closer_name: string | null
          cnpj: string | null
          contact_email: string | null
          contact_mobile: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          delivery_term: string | null
          discount_pct: number | null
          expected_closing: string | null
          expected_closing_date: string | null
          expected_delivery: string | null
          first_opened_by_seller_at: string | null
          handoff_notes: string | null
          handoff_status: string
          id: string
          internal_note: string | null
          last_contact_at: string | null
          lead_code: string
          lead_tipo: Database["public"]["Enums"]["sdr_lead_tipo"] | null
          lock_expires_at: string | null
          locked_at: string | null
          locked_by_sdr_id: string | null
          locked_by_sdr_name: string | null
          loss_competitor: string | null
          loss_notes: string | null
          loss_price_diff_pct: number | null
          loss_reason: string | null
          meeting_date: string | null
          meeting_scheduled: boolean
          next_contact_at: string | null
          next_step: string | null
          nomus_updated_at: string | null
          origem: string
          origem_detalhe: Json | null
          priority: string
          priority_level: number
          probability_pct: number | null
          proposal_date: string | null
          proposal_desc: string | null
          proposal_status: string | null
          proposal_title: string | null
          proposal_version: number | null
          razao_social: string | null
          received_at: string
          sdr_id: string | null
          sdr_name: string | null
          sdr_status: string
          state: string | null
          temperature: string
          transferred_at: string | null
          transferred_by: string | null
          transferred_to_seller_id: string | null
          transferred_to_seller_name: string | null
          updated_at: string
          validity_days: number | null
          value: number
          value_range: string | null
        }
        Insert: {
          bant_authority?: string | null
          bant_budget?: string | null
          bant_need?: string | null
          bant_score?: number | null
          bant_timeline?: string | null
          call_observation?: string | null
          call_result?: string | null
          campanha_id?: string | null
          city?: string | null
          client_name: string
          closer_confirmed?: string
          closer_id?: string | null
          closer_name?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_mobile?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_term?: string | null
          discount_pct?: number | null
          expected_closing?: string | null
          expected_closing_date?: string | null
          expected_delivery?: string | null
          first_opened_by_seller_at?: string | null
          handoff_notes?: string | null
          handoff_status?: string
          id?: string
          internal_note?: string | null
          last_contact_at?: string | null
          lead_code: string
          lead_tipo?: Database["public"]["Enums"]["sdr_lead_tipo"] | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by_sdr_id?: string | null
          locked_by_sdr_name?: string | null
          loss_competitor?: string | null
          loss_notes?: string | null
          loss_price_diff_pct?: number | null
          loss_reason?: string | null
          meeting_date?: string | null
          meeting_scheduled?: boolean
          next_contact_at?: string | null
          next_step?: string | null
          nomus_updated_at?: string | null
          origem?: string
          origem_detalhe?: Json | null
          priority?: string
          priority_level?: number
          probability_pct?: number | null
          proposal_date?: string | null
          proposal_desc?: string | null
          proposal_status?: string | null
          proposal_title?: string | null
          proposal_version?: number | null
          razao_social?: string | null
          received_at?: string
          sdr_id?: string | null
          sdr_name?: string | null
          sdr_status?: string
          state?: string | null
          temperature?: string
          transferred_at?: string | null
          transferred_by?: string | null
          transferred_to_seller_id?: string | null
          transferred_to_seller_name?: string | null
          updated_at?: string
          validity_days?: number | null
          value?: number
          value_range?: string | null
        }
        Update: {
          bant_authority?: string | null
          bant_budget?: string | null
          bant_need?: string | null
          bant_score?: number | null
          bant_timeline?: string | null
          call_observation?: string | null
          call_result?: string | null
          campanha_id?: string | null
          city?: string | null
          client_name?: string
          closer_confirmed?: string
          closer_id?: string | null
          closer_name?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_mobile?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_term?: string | null
          discount_pct?: number | null
          expected_closing?: string | null
          expected_closing_date?: string | null
          expected_delivery?: string | null
          first_opened_by_seller_at?: string | null
          handoff_notes?: string | null
          handoff_status?: string
          id?: string
          internal_note?: string | null
          last_contact_at?: string | null
          lead_code?: string
          lead_tipo?: Database["public"]["Enums"]["sdr_lead_tipo"] | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by_sdr_id?: string | null
          locked_by_sdr_name?: string | null
          loss_competitor?: string | null
          loss_notes?: string | null
          loss_price_diff_pct?: number | null
          loss_reason?: string | null
          meeting_date?: string | null
          meeting_scheduled?: boolean
          next_contact_at?: string | null
          next_step?: string | null
          nomus_updated_at?: string | null
          origem?: string
          origem_detalhe?: Json | null
          priority?: string
          priority_level?: number
          probability_pct?: number | null
          proposal_date?: string | null
          proposal_desc?: string | null
          proposal_status?: string | null
          proposal_title?: string | null
          proposal_version?: number | null
          razao_social?: string | null
          received_at?: string
          sdr_id?: string | null
          sdr_name?: string | null
          sdr_status?: string
          state?: string | null
          temperature?: string
          transferred_at?: string | null
          transferred_by?: string | null
          transferred_to_seller_id?: string | null
          transferred_to_seller_name?: string | null
          updated_at?: string
          validity_days?: number | null
          value?: number
          value_range?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_leads_campanha_fk"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "crm_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_score_weights: {
        Row: {
          id: number
          mkt_descarte_sem_motivo: number
          mkt_qualificado: number
          mkt_sla_bonus: number
          mkt_triado: number
          ranking_visivel_sdr: boolean
          sdr_handoff_aceito: number
          sdr_reuniao_agendada: number
          sdr_tratativa: number
          sla_mkt_minutos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          mkt_descarte_sem_motivo?: number
          mkt_qualificado?: number
          mkt_sla_bonus?: number
          mkt_triado?: number
          ranking_visivel_sdr?: boolean
          sdr_handoff_aceito?: number
          sdr_reuniao_agendada?: number
          sdr_tratativa?: number
          sla_mkt_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          mkt_descarte_sem_motivo?: number
          mkt_qualificado?: number
          mkt_sla_bonus?: number
          mkt_triado?: number
          ranking_visivel_sdr?: boolean
          sdr_handoff_aceito?: number
          sdr_reuniao_agendada?: number
          sdr_tratativa?: number
          sla_mkt_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_score_weights_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_checkpoints: {
        Row: {
          created_at: string
          cursor_payload: Json
          entity_type: string
          error_message: string | null
          id: string
          last_external_id: string | null
          last_page: number
          last_updated_at: string | null
          source_system: string
          status: string
          sync_run_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor_payload?: Json
          entity_type: string
          error_message?: string | null
          id?: string
          last_external_id?: string | null
          last_page?: number
          last_updated_at?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor_payload?: Json
          entity_type?: string
          error_message?: string | null
          id?: string
          last_external_id?: string | null
          last_page?: number
          last_updated_at?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_checkpoints_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_entity_policies: {
        Row: {
          backoff_multiplier: number
          created_at: string
          data_temperature: string
          default_window_days: number | null
          entity_type: string
          id: string
          is_active: boolean
          max_attempts: number
          max_requests_per_minute: number
          priority: number
          retry_after_seconds: number
          source_system: string
          sync_frequency: string
          timeout_ms: number
          updated_at: string
        }
        Insert: {
          backoff_multiplier?: number
          created_at?: string
          data_temperature?: string
          default_window_days?: number | null
          entity_type: string
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_requests_per_minute?: number
          priority?: number
          retry_after_seconds?: number
          source_system?: string
          sync_frequency?: string
          timeout_ms?: number
          updated_at?: string
        }
        Update: {
          backoff_multiplier?: number
          created_at?: string
          data_temperature?: string
          default_window_days?: number | null
          entity_type?: string
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_requests_per_minute?: number
          priority?: number
          retry_after_seconds?: number
          source_system?: string
          sync_frequency?: string
          timeout_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_error_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          is_retryable: boolean
          severity: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          is_retryable?: boolean
          severity?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          is_retryable?: boolean
          severity?: string
        }
        Relationships: []
      }
      sync_field_changes: {
        Row: {
          created_at: string
          entity_type: string
          external_id: string | null
          field_name: string
          id: string
          local_id: string | null
          new_value: Json | null
          origin: string
          previous_value: Json | null
          source_system: string
          sync_run_id: string | null
        }
        Insert: {
          created_at?: string
          entity_type: string
          external_id?: string | null
          field_name: string
          id?: string
          local_id?: string | null
          new_value?: Json | null
          origin: string
          previous_value?: Json | null
          source_system?: string
          sync_run_id?: string | null
        }
        Update: {
          created_at?: string
          entity_type?: string
          external_id?: string | null
          field_name?: string
          id?: string
          local_id?: string | null
          new_value?: Json | null
          origin?: string
          previous_value?: Json | null
          source_system?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_field_changes_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_field_mappings: {
        Row: {
          created_at: string
          entity_type: string
          external_field: string
          id: string
          is_active: boolean
          is_required: boolean
          local_field: string
          master_source: string
          source_system: string
          transformation: string | null
          version: number
        }
        Insert: {
          created_at?: string
          entity_type: string
          external_field: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          local_field: string
          master_source?: string
          source_system?: string
          transformation?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          entity_type?: string
          external_field?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          local_field?: string
          master_source?: string
          source_system?: string
          transformation?: string | null
          version?: number
        }
        Relationships: []
      }
      sync_locks: {
        Row: {
          acquired_at: string
          acquired_by: string | null
          entity_type: string
          expires_at: string
          heartbeat_at: string
          lock_key: string
          source_system: string
          sync_run_id: string | null
        }
        Insert: {
          acquired_at?: string
          acquired_by?: string | null
          entity_type: string
          expires_at?: string
          heartbeat_at?: string
          lock_key: string
          source_system?: string
          sync_run_id?: string | null
        }
        Update: {
          acquired_at?: string
          acquired_by?: string | null
          entity_type?: string
          expires_at?: string
          heartbeat_at?: string
          lock_key?: string
          source_system?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_locks_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_merge_suggestions: {
        Row: {
          confidence_score: number
          created_at: string
          duplicate_record_id: string
          entity_type: string
          id: string
          merged_at: string | null
          merged_by: string | null
          primary_record_id: string | null
          reason: string
          relationships: Json
          status: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          duplicate_record_id: string
          entity_type: string
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          primary_record_id?: string | null
          reason: string
          relationships?: Json
          status?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          duplicate_record_id?: string
          entity_type?: string
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          primary_record_id?: string | null
          reason?: string
          relationships?: Json
          status?: string
        }
        Relationships: []
      }
      sync_pending_issues: {
        Row: {
          created_at: string
          details: string | null
          entity_type: string
          external_id: string | null
          id: string
          issue_type: string
          local_id: string | null
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_system: string
          status: string
          sync_run_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          entity_type: string
          external_id?: string | null
          id?: string
          issue_type: string
          local_id?: string | null
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_system?: string
          status?: string
          sync_run_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          entity_type?: string
          external_id?: string | null
          id?: string
          issue_type?: string
          local_id?: string | null
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_system?: string
          status?: string
          sync_run_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_pending_issues_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_protected_fields: {
        Row: {
          created_at: string
          entity_type: string
          field_name: string
          id: string
          is_active: boolean
          reason: string | null
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_name: string
          id?: string
          is_active?: boolean
          reason?: string | null
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_name?: string
          id?: string
          is_active?: boolean
          reason?: string | null
        }
        Relationships: []
      }
      sync_quality_reports: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          metrics: Json
          source_system: string
          sync_run_id: string | null
        }
        Insert: {
          created_at?: string
          entity_type?: string
          id?: string
          metrics?: Json
          source_system?: string
          sync_run_id?: string | null
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          metrics?: Json
          source_system?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_quality_reports_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_quarantine: {
        Row: {
          created_at: string
          entity_type: string
          error_code: string | null
          external_id: string | null
          id: string
          normalized_payload: Json | null
          raw_payload: Json | null
          reason: string
          reprocess_sync_run_id: string | null
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_system: string
          status: string
          sync_run_id: string | null
        }
        Insert: {
          created_at?: string
          entity_type: string
          error_code?: string | null
          external_id?: string | null
          id?: string
          normalized_payload?: Json | null
          raw_payload?: Json | null
          reason: string
          reprocess_sync_run_id?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
        }
        Update: {
          created_at?: string
          entity_type?: string
          error_code?: string | null
          external_id?: string | null
          id?: string
          normalized_payload?: Json | null
          raw_payload?: Json | null
          reason?: string
          reprocess_sync_run_id?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_system?: string
          status?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_quarantine_error_code_fkey"
            columns: ["error_code"]
            isOneToOne: false
            referencedRelation: "sync_error_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sync_quarantine_reprocess_sync_run_id_fkey"
            columns: ["reprocess_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_quarantine_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_row_logs: {
        Row: {
          action: string
          created_at: string
          entity_type: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          id: string
          local_id: string | null
          new_hash: string | null
          previous_hash: string | null
          raw_payload: Json | null
          reprocess_status: string | null
          reprocessed_at: string | null
          reprocessed_sync_run_id: string | null
          status: string
          sync_run_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_type: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          local_id?: string | null
          new_hash?: string | null
          previous_hash?: string | null
          raw_payload?: Json | null
          reprocess_status?: string | null
          reprocessed_at?: string | null
          reprocessed_sync_run_id?: string | null
          status: string
          sync_run_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_type?: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          local_id?: string | null
          new_hash?: string | null
          previous_hash?: string | null
          raw_payload?: Json | null
          reprocess_status?: string | null
          reprocessed_at?: string | null
          reprocessed_sync_run_id?: string | null
          status?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_row_logs_reprocessed_sync_run_id_fkey"
            columns: ["reprocessed_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_row_logs_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          created_by: string | null
          dry_run: boolean
          entity_type: string
          error_message: string | null
          finished_at: string | null
          id: string
          lock_key: string | null
          parent_sync_run_id: string | null
          source_system: string
          started_at: string
          status: string
          total_errors: number
          total_inserted: number
          total_no_change: number
          total_quarantined: number
          total_received: number
          total_skipped: number
          total_updated: number
        }
        Insert: {
          created_by?: string | null
          dry_run?: boolean
          entity_type: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          lock_key?: string | null
          parent_sync_run_id?: string | null
          source_system?: string
          started_at?: string
          status?: string
          total_errors?: number
          total_inserted?: number
          total_no_change?: number
          total_quarantined?: number
          total_received?: number
          total_skipped?: number
          total_updated?: number
        }
        Update: {
          created_by?: string | null
          dry_run?: boolean
          entity_type?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          lock_key?: string | null
          parent_sync_run_id?: string | null
          source_system?: string
          started_at?: string
          status?: string
          total_errors?: number
          total_inserted?: number
          total_no_change?: number
          total_quarantined?: number
          total_received?: number
          total_skipped?: number
          total_updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_parent_sync_run_id_fkey"
            columns: ["parent_sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          nomus_user_id: string | null
          notes: string | null
          source: string
          status: string
          suggested_role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          nomus_user_id?: string | null
          notes?: string | null
          source?: string
          status?: string
          suggested_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nomus_user_id?: string | null
          notes?: string | null
          source?: string
          status?: string
          suggested_role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_to: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link_to?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link_to?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          effect: string
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effect: string
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effect?: string
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: []
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
      crm_analise_perdas: {
        Row: {
          com_concorrente: number | null
          loss_competitor: string | null
          loss_reason: string | null
          pct: number | null
          perdas_mes_atual: number | null
          ticket_medio: number | null
          total: number | null
          valor_total_perdido: number | null
        }
        Relationships: []
      }
      crm_cobertura_carteira: {
        Row: {
          alta_prioridade_descoberta: number | null
          ativas: number | null
          calculado_em: string | null
          frias: number | null
          max_dias_sem_contato: number | null
          media_dias_sem_contato: number | null
          nunca_contatadas: number | null
          pct_ativa: number | null
          pct_fria: number | null
          pct_nunca_contatada: number | null
          pct_sem_cobertura: number | null
          quentes_descobertos: number | null
          sem_cobertura: number | null
          total: number | null
          valor_alta_prioridade_descoberta: number | null
          valor_ativo: number | null
          valor_frio: number | null
          valor_nunca_contatado: number | null
          valor_sem_cobertura: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      crm_cobertura_por_sdr: {
        Row: {
          alta_prioridade_descoberta: number | null
          ativos: number | null
          frios: number | null
          locked_by_sdr_id: string | null
          pct_cobertura: number | null
          quentes_descobertos: number | null
          sdr_nome: string | null
          sem_cobertura: number | null
          status_meta: string | null
          total_leads: number | null
          valor_ativo: number | null
          valor_carteira: number | null
        }
        Relationships: []
      }
      crm_forecast_mensal: {
        Row: {
          closer_name: string | null
          mes: string | null
          probabilidade_media: number | null
          propostas: number | null
          valor_ponderado: number | null
          valor_previsto: number | null
        }
        Relationships: []
      }
      crm_pipeline_ponderado: {
        Row: {
          closer_name: string | null
          leads_com_closer: number | null
          pct_realizacao: number | null
          pipeline_bruto: number | null
          pipeline_ponderado: number | null
          probabilidade_media: number | null
          total_leads: number | null
          valor_frio: number | null
          valor_morno: number | null
          valor_muito_quente: number | null
          valor_quente: number | null
        }
        Relationships: []
      }
      v_proposal_lead_matches: {
        Row: {
          client_name: string | null
          cnpj_digits: string | null
          lead_code: string | null
          lead_id: string | null
          match_type: string | null
          proposal_id: string | null
          proposal_title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _parse_nomus_date: { Args: { s: string }; Returns: string }
      accept_handoff_lead: { Args: { _lead_id: string }; Returns: undefined }
      assign_lead_to_sdr: {
        Args: { _lead_id: string; _sdr_id: string }
        Returns: undefined
      }
      assign_marketing_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: undefined
      }
      can_access_proposal: { Args: { _proposal_id: string }; Returns: boolean }
      can_manage_user_access: { Args: { _user_id: string }; Returns: boolean }
      claim_marketing_lead: { Args: { _lead_id: string }; Returns: undefined }
      claim_sdr_lead: { Args: { _lead_id: string }; Returns: undefined }
      close_sdr_lead: {
        Args: { _lead_id: string; _note?: string; _reason: string }
        Returns: undefined
      }
      coldpro_calculate_coil_volume_l: {
        Args: {
          p_correction_factor?: number
          p_inner_diameter_mm: number
          p_total_tube_length_m: number
        }
        Returns: number
      }
      coldpro_calculate_tube_volume_l: {
        Args: {
          p_inner_diameter_mm: number
          p_tube_count?: number
          p_tube_length_m: number
        }
        Returns: number
      }
      coldpro_default_fin_multiplier: {
        Args: { p_fin_spacing_mm: number }
        Returns: number
      }
      coldpro_parse_coil_model: { Args: { p_model: string }; Returns: Json }
      coldpro_refrigerant_density_nearest: {
        Args: { p_refrigerant: string; p_temperature_c: number }
        Returns: {
          liquid_density_kg_l: number
          reference_temperature_c: number
        }[]
      }
      convert_marketing_lead_to_sdr: {
        Args: { _lead_id: string; _sdr_id?: string }
        Returns: string
      }
      discard_marketing_lead: {
        Args: { _lead_id: string; _reason: string }
        Returns: undefined
      }
      enqueue_remarketing: {
        Args: {
          _campaign?: string
          _lead_id: string
          _reason?: string
          _scheduled_for?: string
          _source: string
        }
        Returns: string
      }
      get_team_members_by_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      handoff_lead_to_seller:
        | { Args: { _lead_id: string; _seller_id: string }; Returns: undefined }
        | {
            Args: {
              _handoff_notes?: string
              _lead_id: string
              _meeting_at?: string
              _seller_id: string
            }
            Returns: undefined
          }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_sdr_leads_batch: { Args: { payload: Json }; Returns: number }
      is_team_manager: { Args: { _user_id: string }; Returns: boolean }
      mark_lead_nomus_updated: {
        Args: { _lead_id: string }
        Returns: undefined
      }
      mark_lead_opened_by_seller: {
        Args: { _lead_id: string }
        Returns: undefined
      }
      mark_marketing_lead_first_response: {
        Args: { _lead_id: string }
        Returns: undefined
      }
      next_funnel_stage_order: { Args: { _tipo: string }; Returns: number }
      proposal_table_default_settings: {
        Args: { p_table_type: string }
        Returns: Json
      }
      proposals_for_seller: {
        Args: { _user_id: string }
        Returns: {
          proposal_id: string
        }[]
      }
      release_expired_locks: { Args: never; Returns: undefined }
      release_marketing_lead: { Args: { _lead_id: string }; Returns: undefined }
      release_sdr_lead: { Args: { _lead_id: string }; Returns: undefined }
      renew_marketing_lead_lock: {
        Args: { _lead_id: string }
        Returns: undefined
      }
      request_handoff_info: {
        Args: { _lead_id: string; _question: string }
        Returns: undefined
      }
      revert_sdr_lead_edit: { Args: { _edit_id: string }; Returns: undefined }
      salvar_snapshot_cobertura: { Args: never; Returns: undefined }
      sdr_lead_history: {
        Args: { _lead_id: string }
        Returns: {
          autor: string
          data: string
          fonte: string
          observacao: string
          resultado: string
        }[]
      }
      suggest_sdr_for_assignment: {
        Args: never
        Returns: {
          active_count: number
          email: string
          full_name: string
          user_id: string
        }[]
      }
      suggest_seller_for_handoff: {
        Args: never
        Returns: {
          active_count: number
          email: string
          full_name: string
          user_id: string
        }[]
      }
      sync_digits_only: { Args: { value: string }; Returns: string }
      sync_jsonb_hash: { Args: { payload: Json }; Returns: string }
      sync_normalize_cn_cold_model: { Args: { value: string }; Returns: string }
      sync_normalize_model: { Args: { value: string }; Returns: string }
      sync_normalize_text: { Args: { value: string }; Returns: string }
      transfer_proposal_owner: {
        Args: { _kind?: string; _new_user_id: string; _proposal_id: string }
        Returns: undefined
      }
      transfer_sdr_lead: {
        Args: { _lead_id: string; _new_sdr_id: string }
        Returns: undefined
      }
      update_sdr_lead_fields: {
        Args: { _changes: Json; _lead_id: string; _reason?: string }
        Returns: undefined
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
        | "coldpro"
        | "sdr"
        | "marketing"
      marketing_lead_status:
        | "novo"
        | "em_analise"
        | "tentando_contato"
        | "qualificado"
        | "convertido"
        | "descartado"
      productivity_visibility: "private" | "shared"
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
      sdr_lead_tipo:
        | "cnsync"
        | "nomus"
        | "campanha"
        | "inbound"
        | "indicacao"
        | "manual"
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
        | "transferencia"
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
        "coldpro",
        "sdr",
        "marketing",
      ],
      marketing_lead_status: [
        "novo",
        "em_analise",
        "tentando_contato",
        "qualificado",
        "convertido",
        "descartado",
      ],
      productivity_visibility: ["private", "shared"],
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
      sdr_lead_tipo: [
        "cnsync",
        "nomus",
        "campanha",
        "inbound",
        "indicacao",
        "manual",
      ],
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
        "transferencia",
      ],
    },
  },
} as const
