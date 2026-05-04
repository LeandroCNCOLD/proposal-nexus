/**
 * SERVIÇO DE PERFIL CLIMÁTICO SINTÉTICO
 * Gera perfis horários de temperatura, umidade e radiação solar
 * para uso no simulador dinâmico de câmara fria.
 */

import type { ExternalClimatePoint, WeatherProfileType } from "../types/coldRoomSimulation.types";
import { ClimateCacheService } from "../../climate/climateCacheService";

interface WeatherProfileInput {
  type: WeatherProfileType;
  simulation_days: number;
  step_minutes: number;
  /** Temperatura máxima do dia (°C) — padrão por tipo */
  custom_max_temp_c?: number;
  /** Temperatura mínima do dia (°C) — padrão por tipo */
  custom_min_temp_c?: number;
  /** Umidade relativa média (%) */
  custom_humidity_pct?: number;
}

const PROFILE_DEFAULTS: Record<WeatherProfileType, { maxTemp: number; minTemp: number; humidity: number; solar: number }> = {
  hot_day:   { maxTemp: 38, minTemp: 26, humidity: 55, solar: 900 },
  cold_day:  { maxTemp: 18, minTemp: 8,  humidity: 70, solar: 400 },
  rainy_day: { maxTemp: 24, minTemp: 18, humidity: 92, solar: 150 },
  dry_day:   { maxTemp: 35, minTemp: 22, humidity: 35, solar: 850 },
  humid_day: { maxTemp: 30, minTemp: 24, humidity: 88, solar: 500 },
  annual:    { maxTemp: 35, minTemp: 15, humidity: 65, solar: 700 },
  manual:    { maxTemp: 30, minTemp: 20, humidity: 65, solar: 600 },
};

/**
 * Curva senoidal de temperatura ao longo do dia.
 * Pico às 15h, mínimo às 5h.
 */
function hourlyTemp(hour: number, maxTemp: number, minTemp: number): number {
  const amplitude = (maxTemp - minTemp) / 2;
  const mean = (maxTemp + minTemp) / 2;
  // Pico às 15h (hora 15), mínimo às 5h (hora 5)
  const phase = ((hour - 15) * Math.PI) / 12;
  return mean + amplitude * Math.cos(phase);
}

/**
 * Irradiância solar simplificada (W/m²) por hora do dia.
 * Zero à noite, pico ao meio-dia.
 */
function hourlySolar(hour: number, maxSolar: number, rainy: boolean): number {
  if (rainy) return Math.max(0, maxSolar * 0.15);
  if (hour < 6 || hour >= 19) return 0;
  const solarHour = hour - 6; // 0 a 13
  return Math.max(0, maxSolar * Math.sin((solarHour / 13) * Math.PI));
}

/**
 * Umidade relativa varia inversamente com a temperatura.
 */
function hourlyHumidity(hour: number, baseHumidity: number, maxTemp: number, minTemp: number): number {
  const tempNow = hourlyTemp(hour, maxTemp, minTemp);
  const tempRange = maxTemp - minTemp;
  const humidityVariation = tempRange > 0 ? ((maxTemp - tempNow) / tempRange) * 15 : 0;
  return Math.min(99, Math.max(20, baseHumidity + humidityVariation));
}

/**
 * Para simulação anual, varia a temperatura máxima ao longo dos meses.
 * Modelo simplificado para clima tropical brasileiro.
 */
function annualMaxTemp(dayOfYear: number, baseMax: number): number {
  // Verão (jan/fev) quente, inverno (jun/jul) mais frio
  const phase = ((dayOfYear - 15) * 2 * Math.PI) / 365;
  return baseMax + 4 * Math.cos(phase);
}

export async function generateWeatherProfile(
  input: WeatherProfileInput,
  ibgeCode?: string,
  cityName?: string,
  stateCode?: string,
  latitude?: number,
  longitude?: number
): Promise<ExternalClimatePoint[]> {
  // Se houver dados de localização e o tipo for anual/manual, tentar usar dados reais
  if (ibgeCode && latitude && longitude && (input.type === "annual" || input.type === "manual")) {
    try {
      const realProfile = await ClimateCacheService.getOrFetchProfile(
        ibgeCode,
        cityName || "Desconhecida",
        stateCode || "XX",
        latitude,
        longitude
      );
      if (realProfile) {
        return generateRealWeatherProfile(input, realProfile);
      }
    } catch (error) {
      console.error("Erro ao buscar perfil climático real, usando sintético como fallback:", error);
    }
  }

  // Fallback para perfil sintético
  return generateSyntheticWeatherProfile(input);
}

function generateRealWeatherProfile(
  input: WeatherProfileInput,
  realProfile: any
): ExternalClimatePoint[] {
  const stepsPerDay = Math.floor((24 * 60) / input.step_minutes);
  const totalSteps = stepsPerDay * input.simulation_days;
  const points: ExternalClimatePoint[] = [];

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < totalSteps; i++) {
    const minutesFromStart = i * input.step_minutes;
    const timestamp = new Date(startDate.getTime() + minutesFromStart * 60 * 1000);
    
    // Obter mês (0-11) e hora (0-23)
    const month = timestamp.getMonth();
    const hour = timestamp.getHours();
    
    // Buscar temperatura e umidade reais para este mês/hora
    const extTemp = realProfile.temperatures_monthly[month][hour];
    const rh = realProfile.humidity_monthly[month][hour];
    
    // Estimar radiação solar (simplificada baseada na hora e temperatura máxima do mês)
    const monthMaxTemp = Math.max(...realProfile.temperatures_monthly[month]);
    const maxSolar = monthMaxTemp > 30 ? 900 : 600;
    const isRainy = rh > 85;
    const solar = hourlySolar(hour, maxSolar, isRainy);

    let condition: ExternalClimatePoint["weather_condition"] = "sunny";
    if (hour < 6 || hour >= 20) condition = "night";
    else if (isRainy) condition = "rain";
    else if (extTemp < 20) condition = "cold";
    else if (extTemp > 33) condition = "hot";
    else if (solar < 300) condition = "cloudy";

    points.push({
      timestamp: timestamp.toISOString(),
      external_temperature_c: extTemp,
      external_relative_humidity_pct: rh,
      solar_radiation_w_m2: Math.round(solar),
      rain: isRainy,
      wind_speed_m_s: isRainy ? 3.5 : 1.5,
      weather_condition: condition,
    });
  }

  return points;
}

export function generateSyntheticWeatherProfile(input: WeatherProfileInput): ExternalClimatePoint[] {
  const defaults = PROFILE_DEFAULTS[input.type];
  const maxTemp = input.custom_max_temp_c ?? defaults.maxTemp;
  const minTemp = input.custom_min_temp_c ?? defaults.minTemp;
  const humidity = input.custom_humidity_pct ?? defaults.humidity;
  const maxSolar = defaults.solar;
  const isRainy = input.type === "rainy_day";

  const stepsPerDay = Math.floor((24 * 60) / input.step_minutes);
  const totalSteps = stepsPerDay * input.simulation_days;
  const points: ExternalClimatePoint[] = [];

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < totalSteps; i++) {
    const minutesFromStart = i * input.step_minutes;
    const timestamp = new Date(startDate.getTime() + minutesFromStart * 60 * 1000);
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
    const dayOfYear = Math.floor(minutesFromStart / (24 * 60));

    const effectiveMax = input.type === "annual" ? annualMaxTemp(dayOfYear, maxTemp) : maxTemp;
    const effectiveMin = input.type === "annual" ? annualMaxTemp(dayOfYear, minTemp) : minTemp;

    const extTemp = hourlyTemp(hour, effectiveMax, effectiveMin);
    const solar = hourlySolar(Math.floor(hour), maxSolar, isRainy);
    const rh = hourlyHumidity(Math.floor(hour), humidity, effectiveMax, effectiveMin);

    let condition: ExternalClimatePoint["weather_condition"] = "sunny";
    if (hour < 6 || hour >= 20) condition = "night";
    else if (isRainy) condition = "rain";
    else if (extTemp < 20) condition = "cold";
    else if (extTemp > 33) condition = "hot";
    else if (solar < 300) condition = "cloudy";

    points.push({
      timestamp: timestamp.toISOString(),
      external_temperature_c: Math.round(extTemp * 10) / 10,
      external_relative_humidity_pct: Math.round(rh),
      solar_radiation_w_m2: Math.round(solar),
      rain: isRainy,
      wind_speed_m_s: isRainy ? 3.5 : 1.5,
      weather_condition: condition,
    });
  }

  return points;
}
