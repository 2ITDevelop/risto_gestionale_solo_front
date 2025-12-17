import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/api';
import type {
  Sala,
  CreateSalaDto,
  Tavolo,
  ZonaSala,
  SalaConfiguration,
  Turno,
  CreateSalaConfigurationDto,
  Reservation,
} from '@/types';

export const salaApi = {
  // Get all rooms
  getAll: (): Promise<Sala[]> =>
    apiClient.get<Sala[]>(API_ENDPOINTS.sala.base),

  // Get room by name
  getByName: (nomeSala: string): Promise<Sala> =>
    apiClient.get<Sala>(API_ENDPOINTS.sala.byName(nomeSala)),

  // Create a new room
  create: (data: CreateSalaDto): Promise<Sala> =>
    apiClient.post<Sala, CreateSalaDto>(API_ENDPOINTS.sala.base, data),

  // Update room zones (NB: backend si aspetta { nome, zone })
  updateZones: (nomeSala: string, zones: ZonaSala[]): Promise<Sala> =>
    apiClient.put<Sala, { nome: string; zone: ZonaSala[] }>(
      API_ENDPOINTS.sala.zones(nomeSala),
      {
        nome: nomeSala,
        zone: zones,
      }
    ),

  // Delete a room
  delete: (nomeSala: string): Promise<void> =>
    apiClient.delete<void>(API_ENDPOINTS.sala.byName(nomeSala)),

  // Save room configuration
  saveConfiguration: (config: CreateSalaConfigurationDto): Promise<void> =>
    apiClient.post<void, CreateSalaConfigurationDto>(
      API_ENDPOINTS.sala.configurations,
      config
    ),

  // Get tables for a specific room/date/turno
  getTables: (nomeSala: string, date: string, turno: Turno): Promise<Tavolo[]> =>
    apiClient.get<Tavolo[]>(API_ENDPOINTS.sala.tables(nomeSala, date, turno)),

  // Create table (singolo)
  createTables: (nomeSala: string, date: string, turno: Turno, table: Tavolo): Promise<Tavolo> =>
    apiClient.post<Tavolo, Tavolo>(API_ENDPOINTS.sala.tables(nomeSala, date, turno), table),

  // Delete a specific table
  deleteTable: (nomeSala: string, date: string, turno: Turno, x: number, y: number): Promise<void> =>
    apiClient.delete<void>(API_ENDPOINTS.sala.tableByPosition(nomeSala, date, turno, x, y)),

  // Assign a reservation to a table
  assignReservation: (
    nomeSala: string,
    date: string,
    turno: Turno,
    x: number,
    y: number,
    nomePrenotazione: string
  ): Promise<Tavolo> =>
    apiClient.post<Tavolo>(
      API_ENDPOINTS.sala.assignReservation(nomeSala, date, turno, x, y, nomePrenotazione)
    ),

  // Get reservations for a table group
  getGroupReservations: (
    nomeSala: string,
    date: string,
    turno: Turno,
    x: number,
    y: number
  ): Promise<Reservation[]> =>
    apiClient.get<Reservation[]>(API_ENDPOINTS.sala.groupReservationsByTable(nomeSala, date, turno, x, y)),

  // Delete a reservation from the whole group of a table
  deleteGroupReservation: (
    nomeSala: string,
    date: string,
    turno: Turno,
    x: number,
    y: number,
    nomePrenotazione: string
  ) =>
    apiClient.delete(
      API_ENDPOINTS.sala.deleteGroupReservation(nomeSala, date, turno, x, y, nomePrenotazione)
    ),

  // Get configuration (ritorna direttamente SalaConfiguration)
  getConfiguration: (nomeSala: string, date: string, turno: Turno): Promise<SalaConfiguration> =>
    apiClient.get<SalaConfiguration>(API_ENDPOINTS.sala.configuration(nomeSala, date, turno)),

  // Get total available seats
  getTotalSeats: (nomeSala: string, date: string, turno: Turno): Promise<number> =>
    apiClient.get<number>(API_ENDPOINTS.sala.totalSeats(nomeSala, date, turno)),
};
