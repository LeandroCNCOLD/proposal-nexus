/**
 * Serviço de integração com a API Histórica do Open-Meteo (ERA5 Seamless).
 * Busca dados horários de temperatura e umidade para os últimos 14 anos (2010-2023),
 * processa e gera um perfil climático consolidado mensal (12x24).
 */

export interface RawClimateProfile {
  city_name: string;
  state_code: string;
  ibge_code: string;
  latitude: number;
  longitude: number;
  temperatures_monthly: number[][]; // 12 meses x 24 horas
  humidity_monthly: number[][];     // 12 meses x 24 horas
  temp_max_c: number;
  temp_min_c: number;
  temp_avg_c: number;
  humidity_avg_pct: number;
}

export class OpenMeteoService {
  /**
   * Busca dados climáticos na API do Open-Meteo, processa e retorna um perfil consolidado.
   * Utiliza os últimos 14 anos fechados (2010 a 2023) do modelo ERA5 Seamless.
   */
  static async fetchClimateProfile(
    latitude: number,
    longitude: number,
    ibgeCode: string,
    cityName: string,
    stateCode: string
  ): Promise<RawClimateProfile> {
    const startDate = '2010-01-01';
    const endDate = '2023-12-31';

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m&timezone=UTC&models=era5_seamless`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao buscar dados climáticos: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time || !data.hourly.temperature_2m || !data.hourly.relative_humidity_2m) {
      throw new Error('Formato de resposta inválido da API Open-Meteo');
    }

    return this.processHourlyData(
      data.hourly.time,
      data.hourly.temperature_2m,
      data.hourly.relative_humidity_2m,
      ibgeCode,
      cityName,
      stateCode,
      latitude,
      longitude
    );
  }

  /**
   * Processa a série temporal de 14 anos em um perfil mensal consolidado (12 meses x 24 horas)
   */
  private static processHourlyData(
    times: string[],
    temperatures: (number | null)[],
    humidities: (number | null)[],
    ibgeCode: string,
    cityName: string,
    stateCode: string,
    latitude: number,
    longitude: number
  ): RawClimateProfile {
    // Matriz de acumulação: [mês 0-11][hora 0-23] = { sumT: 0, sumH: 0, count: 0 }
    const matrix: { sumT: number; sumH: number; count: number }[][] = Array.from({ length: 12 }, () =>
      Array.from({ length: 24 }, () => ({ sumT: 0, sumH: 0, count: 0 }))
    );

    let globalMax = -999;
    let globalMin = 999;
    let globalSumT = 0;
    let globalSumH = 0;
    let globalCount = 0;

    // Iterar sobre todos os pontos da série temporal
    for (let i = 0; i < times.length; i++) {
      const t = temperatures[i];
      const h = humidities[i];

      if (t === null || h === null) continue;

      // time format: "YYYY-MM-DDTHH:00"
      const timeStr = times[i];
      const month = parseInt(timeStr.substring(5, 7), 10) - 1; // 0-11
      const hour = parseInt(timeStr.substring(11, 13), 10);    // 0-23

      if (month >= 0 && month <= 11 && hour >= 0 && hour <= 23) {
        matrix[month][hour].sumT += t;
        matrix[month][hour].sumH += h;
        matrix[month][hour].count += 1;

        if (t > globalMax) globalMax = t;
        if (t < globalMin) globalMin = t;
        globalSumT += t;
        globalSumH += h;
        globalCount += 1;
      }
    }

    if (globalCount === 0) {
      throw new Error('Nenhum dado climático válido encontrado no período.');
    }

    // Construir os arrays finais
    const temperaturesMonthly: number[][] = [];
    const humidityMonthly: number[][] = [];

    for (let m = 0; m < 12; m++) {
      const rowT: number[] = [];
      const rowH: number[] = [];

      for (let h = 0; h < 24; h++) {
        const cell = matrix[m][h];
        if (cell.count > 0) {
          rowT.push(Math.round((cell.sumT / cell.count) * 10) / 10);
          rowH.push(Math.round(cell.sumH / cell.count));
        } else {
          // Fallback improvável para série de 14 anos
          rowT.push(globalSumT / globalCount);
          rowH.push(Math.round(globalSumH / globalCount));
        }
      }

      temperaturesMonthly.push(rowT);
      humidityMonthly.push(rowH);
    }

    return {
      ibge_code: ibgeCode,
      city_name: cityName,
      state_code: stateCode,
      latitude,
      longitude,
      temperatures_monthly: temperaturesMonthly,
      humidity_monthly: humidityMonthly,
      temp_max_c: Math.round(globalMax * 10) / 10,
      temp_min_c: Math.round(globalMin * 10) / 10,
      temp_avg_c: Math.round((globalSumT / globalCount) * 10) / 10,
      humidity_avg_pct: Math.round(globalSumH / globalCount),
    };
  }
}
