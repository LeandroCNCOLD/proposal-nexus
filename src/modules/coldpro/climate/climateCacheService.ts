/**
 * Serviço de Cache Climático
 * Gerencia a tabela coldpro_climate_cache no Supabase.
 */

import { supabase } from "@/integrations/supabase/client";
import { OpenMeteoService, RawClimateProfile } from "./openMeteoService";

export class ClimateCacheService {
  /**
   * Busca um perfil climático no cache local (Supabase).
   * Se não existir, chama a API Open-Meteo, salva no cache e retorna.
   */
  static async getOrFetchProfile(
    ibgeCode: string,
    cityName: string,
    stateCode: string,
    latitude: number,
    longitude: number
  ): Promise<RawClimateProfile> {
    // 1. Tentar buscar no cache do Supabase
    try {
      const { data: cached, error } = await supabase
        .from('coldpro_climate_cache')
        .select('*')
        .eq('ibge_code', ibgeCode)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao consultar cache climático:', error);
      }

      if (cached) {
        return {
          ibge_code: cached.ibge_code,
          city_name: cached.city_name,
          state_code: cached.state_code,
          latitude: cached.latitude,
          longitude: cached.longitude,
          temperatures_monthly: cached.temperatures_monthly as number[][],
          humidity_monthly: cached.humidity_monthly as number[][],
          temp_max_c: cached.temp_max_c,
          temp_min_c: cached.temp_min_c,
          temp_avg_c: cached.temp_avg_c,
          humidity_avg_pct: cached.humidity_avg_pct,
        };
      }
    } catch (e) {
      console.warn('Falha na conexão com Supabase para cache climático:', e);
    }

    // 2. Se não encontrou no cache, buscar na API Open-Meteo
    console.log(`Perfil climático para ${cityName} (${ibgeCode}) não encontrado no cache. Buscando na API Open-Meteo...`);
    const newProfile = await OpenMeteoService.fetchClimateProfile(
      latitude,
      longitude,
      ibgeCode,
      cityName,
      stateCode
    );

    // 3. Salvar no cache de forma assíncrona (não bloqueia o retorno)
    this.saveToCache(newProfile).catch(e => 
      console.warn('Erro ao salvar perfil no cache climático:', e)
    );

    return newProfile;
  }

  /**
   * Salva um novo perfil no cache do Supabase
   */
  private static async saveToCache(profile: RawClimateProfile): Promise<void> {
    const { error } = await supabase
      .from('coldpro_climate_cache')
      .upsert({
        ibge_code: profile.ibge_code,
        city_name: profile.city_name,
        state_code: profile.state_code,
        latitude: profile.latitude,
        longitude: profile.longitude,
        temperatures_monthly: profile.temperatures_monthly,
        humidity_monthly: profile.humidity_monthly,
        temp_max_c: profile.temp_max_c,
        temp_min_c: profile.temp_min_c,
        temp_avg_c: profile.temp_avg_c,
        humidity_avg_pct: profile.humidity_avg_pct,
        data_source: 'open-meteo-era5',
        data_period_start: '2010-01-01',
        data_period_end: '2023-12-31'
      }, {
        onConflict: 'ibge_code'
      });

    if (error) {
      throw error;
    }
  }
}
