/**
 * Serviço de integração com a API do ViaCEP
 * Responsável por buscar informações de endereço a partir do CEP,
 * incluindo o código IBGE do município, que é a chave primária
 * para a busca no banco de dados climáticos.
 */

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface GeocodedAddress extends ViaCepResponse {
  latitude?: number;
  longitude?: number;
}

export class CepService {
  /**
   * Busca os dados de um CEP na API do ViaCEP
   * @param cep CEP (apenas números ou formato XXXXX-XXX)
   * @returns Dados do endereço ou null se não encontrado
   */
  static async fetchAddressByCep(cep: string): Promise<GeocodedAddress | null> {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      throw new Error('CEP inválido. O CEP deve conter 8 dígitos.');
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error(`Erro na API ViaCEP: ${response.statusText}`);
      }

      const data = await response.json();

      // ViaCEP retorna { erro: "true" } quando o CEP não existe
      if (data.erro) {
        return null;
      }

      const address = data as GeocodedAddress;
      
      // Buscar latitude/longitude via Open-Meteo Geocoding API
      try {
        const query = encodeURIComponent(`${address.localidade}, ${address.uf}, Brasil`);
        const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=pt&format=json`);
        
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData.results && geoData.results.length > 0) {
            address.latitude = geoData.results[0].latitude;
            address.longitude = geoData.results[0].longitude;
          }
        }
      } catch (geoError) {
        console.warn('Aviso: Falha ao buscar coordenadas geográficas para o CEP', geoError);
      }

      return address;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      throw error;
    }
  }

  /**
   * Formata um CEP para exibição (XXXXX-XXX)
   */
  static formatCep(cep: string): string {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      return `${clean.substring(0, 5)}-${clean.substring(5, 8)}`;
    }
    return cep;
  }
}
