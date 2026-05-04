/**
 * Serviço de acesso ao banco de dados climáticos dos municípios brasileiros
 * 
 * Este serviço gerencia a busca e extração dos perfis climáticos gerados a partir
 * de dados ERA5 (Open-Meteo) para os 5.571 municípios do Brasil.
 */

// Interface do perfil armazenado no JSON
export interface RawClimateProfile {
  n: string; // Nome
  uf: string; // UF
  lat: number; // Latitude
  lon: number; // Longitude
  t: number[][]; // Temperatura (12 meses x 24 horas)
  rh: number[][]; // Umidade Relativa (12 meses x 24 horas)
  s: {
    mx: number; // Max temp
    mn: number; // Min temp
    av: number; // Avg temp
  };
}

// Interface tipada para o frontend
export interface BrazilClimateProfile {
  ibgeCode: string;
  cityName: string;
  state: string;
  latitude: number;
  longitude: number;
  temperatures: number[][]; // 12 meses (0-11) x 24 horas (0-23)
  humidities: number[][];   // 12 meses (0-11) x 24 horas (0-23)
  stats: {
    maxTemp: number;
    minTemp: number;
    avgTemp: number;
  };
}

export class BrazilClimateService {
  // Cache em memória para não baixar o JSON múltiplas vezes
  private static climateDataCache: Record<string, RawClimateProfile> | null = null;
  private static isFetching = false;
  private static fetchPromise: Promise<Record<string, RawClimateProfile>> | null = null;

  /**
   * Carrega o banco de dados climáticos
   * O arquivo JSON de 12MB deve estar hospedado publicamente (ex: Supabase Storage)
   * ou incluído na pasta public do projeto.
   */
  private static async loadDatabase(): Promise<Record<string, RawClimateProfile>> {
    if (this.climateDataCache) {
      return this.climateDataCache;
    }

    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isFetching = true;
    
    this.fetchPromise = new Promise(async (resolve, reject) => {
      try {
        // O arquivo JSON deve estar em public/data/brazil-climate-profiles.json
        // ou ser carregado via URL do Supabase Storage
        const response = await fetch('/data/brazil-climate-profiles.json');
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar banco climático: ${response.statusText}`);
        }
        
        const data = await response.json();
        this.climateDataCache = data;
        resolve(data);
      } catch (error) {
        console.error('Falha ao carregar brazil-climate-profiles.json', error);
        reject(error);
      } finally {
        this.isFetching = false;
      }
    });

    return this.fetchPromise;
  }

  /**
   * Busca o perfil climático pelo código IBGE do município
   * @param ibgeCode Código IBGE de 7 dígitos
   */
  static async getProfileByIbge(ibgeCode: string): Promise<BrazilClimateProfile | null> {
    try {
      const db = await this.loadDatabase();
      
      // Alguns sistemas usam IBGE de 6 dígitos, outros de 7
      // O banco foi gerado com o código oficial de 7 dígitos
      let targetCode = ibgeCode;
      
      const rawProfile = db[targetCode];
      
      if (!rawProfile) {
        console.warn(`Perfil climático não encontrado para o IBGE ${targetCode}`);
        return null;
      }
      
      return this.mapRawToProfile(targetCode, rawProfile);
    } catch (error) {
      console.error(`Erro ao buscar perfil para IBGE ${ibgeCode}:`, error);
      return null;
    }
  }

  /**
   * Mapeia o formato otimizado do JSON para a interface TypeScript
   */
  private static mapRawToProfile(ibgeCode: string, raw: RawClimateProfile): BrazilClimateProfile {
    return {
      ibgeCode,
      cityName: raw.n,
      state: raw.uf,
      latitude: raw.lat,
      longitude: raw.lon,
      temperatures: raw.t,
      humidities: raw.rh,
      stats: {
        maxTemp: raw.s.mx,
        minTemp: raw.s.mn,
        avgTemp: raw.s.av
      }
    };
  }

  /**
   * Busca cidades pelo nome (útil para autocomplete se o CEP falhar)
   */
  static async searchCitiesByName(query: string, limit = 10): Promise<Array<{ibge: string, name: string, uf: string}>> {
    if (query.length < 3) return [];
    
    try {
      const db = await this.loadDatabase();
      const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const results = [];
      
      for (const [ibge, data] of Object.entries(db)) {
        const normalizedName = data.n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (normalizedName.includes(normalizedQuery)) {
          results.push({
            ibge,
            name: data.n,
            uf: data.uf
          });
          
          if (results.length >= limit) break;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Erro ao buscar cidades:', error);
      return [];
    }
  }
}
