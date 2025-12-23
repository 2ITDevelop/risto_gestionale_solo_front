import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaApi } from '@/api/sala';
import type {
  Sala,
  CreateSalaDto,
  ZonaSala,
  Tavolo,
  Turno,
  SalaConfiguration,
  CreateSalaConfigurationDto,
  Reservation,
} from '@/types';
import { toast } from '@/hooks/use-toast';

/**
 * Il tuo ApiClient lancia errori con shape:
 * { message: string; status: number }
 */
export type ApiError = {
  message: string;
  status: number;
};

const isApiError = (e: unknown): e is ApiError => {
  if (typeof e !== 'object' || e === null) return false;
  const r = e as Record<string, unknown>;
  return typeof r.message === 'string' && typeof r.status === 'number';
};

const unknownToApiError = (e: unknown): ApiError => {
  if (isApiError(e)) return e;
  return { message: 'Errore sconosciuto', status: 0 };
};

export const salaKeys = {
  all: ['sala'] as const,
  byName: (name: string) => ['sala', name] as const,

  tables: (nomeSala: string, date: string, turno: Turno) =>
    ['sala', 'tables', nomeSala, date, turno] as const,

  groupReservations: (nomeSala: string, date: string, turno: Turno, x: number, y: number) =>
    ['sala', 'groupReservations', nomeSala, date, turno, x, y] as const,

  totalSeats: (nomeSala: string, date: string, turno: Turno) =>
    ['sala', 'totalSeats', nomeSala, date, turno] as const,

  configuration: (nomeSala: string, date: string, turno: Turno) =>
    ['sala', 'configuration', nomeSala, date, turno] as const,
};

export function useSalas() {
  return useQuery<Sala[], ApiError>({
    queryKey: salaKeys.all,
    queryFn: salaApi.getAll,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSala(nomeSala: string) {
  return useQuery<Sala, ApiError>({
    queryKey: salaKeys.byName(nomeSala),
    queryFn: () => salaApi.getByName(nomeSala),
    enabled: nomeSala.trim().length > 0,
  });
}

export function useTables(nomeSala: string, date: string, turno: Turno) {
  return useQuery<Tavolo[], ApiError>({
    queryKey: salaKeys.tables(nomeSala, date, turno),
    queryFn: () => salaApi.getTables(nomeSala, date, turno),
    enabled: nomeSala.trim().length > 0 && date.trim().length > 0 && !!turno,
  });
}

export function useGroupReservations(nomeSala: string, date: string, turno: Turno, x?: number, y?: number) {
  const isEnabled =
    nomeSala.trim().length > 0 && date.trim().length > 0 && !!turno && typeof x === 'number' && typeof y === 'number';

  return useQuery<Reservation[], ApiError>({
    queryKey: isEnabled && typeof x === 'number' && typeof y === 'number'
      ? salaKeys.groupReservations(nomeSala, date, turno, x, y)
      : ['sala', 'groupReservations', 'disabled'],
    queryFn: () => salaApi.getGroupReservations(nomeSala, date, turno, x as number, y as number),
    enabled: isEnabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useTotalSeats(nomeSala: string, date: string, turno: Turno) {
  return useQuery<number, ApiError>({
    queryKey: salaKeys.totalSeats(nomeSala, date, turno),
    queryFn: () => salaApi.getTotalSeats(nomeSala, date, turno),
    enabled: nomeSala.trim().length > 0 && date.trim().length > 0 && !!turno,
  });
}

export function useCreateSala() {
  const queryClient = useQueryClient();

  return useMutation<Sala, ApiError, CreateSalaDto>({
    mutationFn: (data) => salaApi.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.all });
      toast({
        title: 'Sala creata',
        description: 'La nuova sala è stata creata con successo.',
      });
    },
    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile creare la sala.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateZones() {
  const queryClient = useQueryClient();

  return useMutation<Sala, ApiError, { nomeSala: string; zones: ZonaSala[] }>({
    mutationFn: ({ nomeSala, zones }) => salaApi.updateZones(nomeSala, zones),

    onSuccess: async (updatedSala, variables) => {
      // 1) cache sala singola
      queryClient.setQueryData<Sala>(salaKeys.byName(variables.nomeSala), updatedSala);

      // 2) cache lista sale
      queryClient.setQueryData<Sala[] | undefined>(salaKeys.all, (old) => {
        if (!old) return old;
        return old.map((s) => (s.nome === updatedSala.nome ? updatedSala : s));
      });

      // 3) per sicurezza (se altre schermate dipendono da refetch), invalido
      await queryClient.invalidateQueries({ queryKey: salaKeys.all });
      await queryClient.invalidateQueries({ queryKey: salaKeys.byName(variables.nomeSala) });

      toast({
        title: 'Zone aggiornate',
        description: 'Le zone della sala sono state aggiornate.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile aggiornare le zone.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSala() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (nomeSala) => salaApi.delete(nomeSala),

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.all });
      toast({
        title: 'Sala eliminata',
        description: 'La sala è stata eliminata con successo.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile eliminare la sala.',
        variant: 'destructive',
      });
    },
  });
}

export function useCreateTables() {
  const queryClient = useQueryClient();

  return useMutation<Tavolo, ApiError, { nomeSala: string; date: string; turno: Turno; table: Tavolo }>({
    mutationFn: ({ nomeSala, date, turno, table }) =>
      salaApi.createTables(nomeSala, date, turno, table),

    onSuccess: async (_created, v) => {
      await queryClient.invalidateQueries({
        queryKey: salaKeys.tables(v.nomeSala, v.date, v.turno),
      });
      toast({
        title: 'Tavolo creato',
        description: 'Il tavolo è stato creato con successo.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile creare il tavolo.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { nomeSala: string; date: string; turno: Turno; x: number; y: number }>({
    mutationFn: ({ nomeSala, date, turno, x, y }) =>
      salaApi.deleteTable(nomeSala, date, turno, x, y),

    onSuccess: async (_void, v) => {
      await queryClient.invalidateQueries({
        queryKey: salaKeys.tables(v.nomeSala, v.date, v.turno),
      });
      toast({
        title: 'Tavolo eliminato',
        description: 'Il tavolo è stato eliminato.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile eliminare il tavolo.',
        variant: 'destructive',
      });
    },
  });
}

export function useAssignReservation() {
  const queryClient = useQueryClient();

  return useMutation<
    Tavolo,
    ApiError,
    { nomeSala: string; date: string; turno: Turno; x: number; y: number; nomePrenotazione: string }
  >({
    mutationFn: ({ nomeSala, date, turno, x, y, nomePrenotazione }) =>
      salaApi.assignReservation(nomeSala, date, turno, x, y, nomePrenotazione),

    onSuccess: async (updated, v) => {
      // aggiorna subito la cache dei tavoli con la risposta del backend
      queryClient.setQueryData<Tavolo[] | undefined>(salaKeys.tables(v.nomeSala, v.date, v.turno), (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.x === v.x && t.y === v.y
            ? { ...t, ...updated }
            : t
        );
      });

      await queryClient.invalidateQueries({
        queryKey: salaKeys.tables(v.nomeSala, v.date, v.turno),
      });
      await queryClient.invalidateQueries({
        queryKey: salaKeys.groupReservations(v.nomeSala, v.date, v.turno, v.x, v.y),
      });
      toast({
        title: 'Prenotazione assegnata',
        description: 'Prenotazione assegnata al tavolo con successo.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile assegnare la prenotazione.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteGroupReservation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    ApiError,
    { nomeSala: string; date: string; turno: Turno; x: number; y: number; nomePrenotazione: string }
  >({
    mutationFn: ({ nomeSala, date, turno, x, y, nomePrenotazione }) =>
      salaApi.deleteGroupReservation(nomeSala, date, turno, x, y, nomePrenotazione),

    onSuccess: async (_void, v) => {
      // Aggiorna subito la cache locale per evitare liste stale in dialog
      queryClient.setQueryData<Reservation[] | undefined>(
        salaKeys.groupReservations(v.nomeSala, v.date, v.turno, v.x, v.y),
        (old) => old?.filter((r) => r.nome !== v.nomePrenotazione)
      );

      await queryClient.invalidateQueries({
        queryKey: salaKeys.groupReservations(v.nomeSala, v.date, v.turno, v.x, v.y),
      });
      await queryClient.invalidateQueries({
        queryKey: salaKeys.tables(v.nomeSala, v.date, v.turno),
      });
      toast({
        title: 'Prenotazione rimossa',
        description: 'Prenotazione eliminata dal gruppo di tavoli.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile rimuovere la prenotazione.',
        variant: 'destructive',
      });
    },
  });
}

export function useSaveConfiguration() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, CreateSalaConfigurationDto>({
    mutationFn: (config) => salaApi.saveConfiguration(config),

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.all });
      toast({
        title: 'Configurazione salvata',
        description: 'La configurazione della sala è stata salvata.',
      });
    },

    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile salvare la configurazione.',
        variant: 'destructive',
      });
    },
  });
}

export function useSalaConfigurationCheck(nomeSala: string | undefined, date: string, turno: Turno) {
  return useQuery<SalaConfiguration | null, ApiError>({
    queryKey: nomeSala ? salaKeys.configuration(nomeSala, date, turno) : ['sala', 'configuration', 'disabled'],
    enabled: !!nomeSala && nomeSala.trim().length > 0,

    queryFn: async () => {
      if (!nomeSala) return null;
      try {
        return await salaApi.getConfiguration(nomeSala, date, turno);
      } catch (e: unknown) {
        const err = unknownToApiError(e);
        if (err.status === 404) return null;
        throw err;
      }
    },
  });
}
