import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/api';
import type { Reservation, CreateReservationDto } from '@/types';

export const reservationsApi = {
  // Get all reservations
  getAll: () => apiClient.get<Reservation[]>(API_ENDPOINTS.reservations.base),
  
  // Get reservations by date
  getByDate: (date: string) => 
    apiClient.get<Reservation[]>(API_ENDPOINTS.reservations.byDate(date)),
  
  // Get specific reservation by date and name
  getByDateAndName: (date: string, nome: string) =>
    apiClient.get<Reservation>(API_ENDPOINTS.reservations.byDateAndName(date, nome)),
  
  // Create a new reservation
  create: (data: CreateReservationDto) =>
    apiClient.post<Reservation, CreateReservationDto>(API_ENDPOINTS.reservations.base, data),
  
  // Delete a reservation
  delete: (date: string, nome: string) =>
    apiClient.delete<void>(API_ENDPOINTS.reservations.byDateAndName(date, nome)),
};
