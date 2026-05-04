/**
 * Serviço de Geração de Eventos de Abertura de Portas
 * Cria um cronograma detalhado de aberturas de porta baseado na frequência,
 * duração e turno de operação informados pelo usuário.
 */

import { DoorOpeningEvent } from "../types/coldRoomSimulation.types";

export interface DoorScheduleInput {
  door_id: string;
  opening_area_m2: number;
  protection_type: "none" | "curtain" | "air_curtain" | "antechamber" | "fast_door";
  
  // Novos parâmetros de perfil
  openings_per_hour: number;
  duration_seconds_per_opening: number;
  
  // Janela de operação (ex: 8 às 18h)
  active_start_hour: number;
  active_end_hour: number;
  
  // Quantos dias simular
  simulation_days: number;
}

export class DoorLoadService {
  /**
   * Gera a lista completa de eventos de abertura de porta para o período simulado.
   * Distribui as aberturas uniformemente dentro do horário ativo.
   */
  static generateDoorEvents(inputs: DoorScheduleInput[]): DoorOpeningEvent[] {
    const events: DoorOpeningEvent[] = [];
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0); // Começa à meia-noite do dia atual
    
    for (const input of inputs) {
      if (input.openings_per_hour <= 0 || input.duration_seconds_per_opening <= 0) {
        continue;
      }
      
      const intervalMinutes = 60 / input.openings_per_hour;
      
      for (let day = 0; day < input.simulation_days; day++) {
        // Para cada hora ativa do dia
        for (let hour = input.active_start_hour; hour < input.active_end_hour; hour++) {
          
          // Distribuir as aberturas dentro da hora
          for (let i = 0; i < input.openings_per_hour; i++) {
            const eventTime = new Date(baseDate);
            eventTime.setDate(baseDate.getDate() + day);
            eventTime.setHours(hour);
            eventTime.setMinutes(Math.round(i * intervalMinutes));
            
            events.push({
              timestamp: eventTime.toISOString(),
              door_id: input.door_id,
              duration_seconds: input.duration_seconds_per_opening,
              opening_area_m2: input.opening_area_m2,
              protection_type: input.protection_type
            });
          }
        }
      }
    }
    
    // Ordenar cronologicamente
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
