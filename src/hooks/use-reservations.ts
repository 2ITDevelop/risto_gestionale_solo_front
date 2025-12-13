import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '@/api/reservations';
import type { Reservation, CreateReservationDto } from '@/types';
import { toast } from '@/hooks/use-toast';

export const reservationKeys = {
  all: ['reservations'] as const,
  byDate: (date: string) => ['reservations', date] as const,
  byDateAndName: (date: string, nome: string) => ['reservations', date, nome] as const,
};

export function useReservations() {
  return useQuery({
    queryKey: reservationKeys.all,
    queryFn: reservationsApi.getAll,
  });
}

export function useReservationsByDate(date: string) {
  return useQuery({
    queryKey: reservationKeys.byDate(date),
    queryFn: () => reservationsApi.getByDate(date),
    enabled: !!date,
  });
}

export function useReservation(date: string, nome: string) {
  return useQuery({
    queryKey: reservationKeys.byDateAndName(date, nome),
    queryFn: () => reservationsApi.getByDateAndName(date, nome),
    enabled: !!date && !!nome,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  
  return useMutation<Reservation, Error, CreateReservationDto>({
    mutationFn: (data) => reservationsApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationKeys.byDate(variables.date) });
      toast({
        title: 'Prenotazione creata',
        description: `Prenotazione per ${variables.nome} creata con successo.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile creare la prenotazione.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { date: string; nome: string }>({
    mutationFn: ({ date, nome }) => reservationsApi.delete(date, nome),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationKeys.byDate(variables.date) });
      toast({
        title: 'Prenotazione eliminata',
        description: 'La prenotazione è stata eliminata con successo.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile eliminare la prenotazione.',
        variant: 'destructive',
      });
    },
  });
}
