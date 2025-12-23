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
  SalaTemplateHeader,
  SalaTemplate,
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
  templates: (nomeSala: string) => ['sala', 'templates', nomeSala] as const,
  template: (nomeSala: string, nomeTemplate: string) => ['sala', 'template', nomeSala, nomeTemplate] as const,
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

export function useSalaTemplates(nomeSala: string | undefined) {
  const enabled = !!nomeSala && nomeSala.trim().length > 0;

  return useQuery<SalaTemplateHeader[], ApiError>({
    queryKey: enabled ? salaKeys.templates(nomeSala) : ['sala', 'templates', 'disabled'],
    queryFn: () => salaApi.getTemplates(nomeSala as string),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSalaTemplate(nomeSala: string | undefined, nomeTemplate: string | undefined) {
  const enabled =
    !!nomeSala && nomeSala.trim().length > 0 && !!nomeTemplate && nomeTemplate.trim().length > 0;

  return useQuery<SalaTemplate, ApiError>({
    queryKey: enabled
      ? salaKeys.template(nomeSala as string, nomeTemplate as string)
      : ['sala', 'template', 'disabled'],
    queryFn: () => salaApi.getTemplate(nomeSala as string, nomeTemplate as string),
    enabled,
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

export function useCreateTemplateFromConfig() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { nomeSala: string; nomeTemplate: string; date: string; turno: Turno }>({
    mutationFn: ({ nomeSala, nomeTemplate, date, turno }) =>
      salaApi.createTemplateFromConfig(nomeSala, nomeTemplate, date, turno),
    onSuccess: async (_void, v) => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.templates(v.nomeSala) });
      toast({
        title: 'Template creato',
        description: `Template "${v.nomeTemplate}" creato dalla configurazione selezionata.`,
      });
    },
    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile creare il template.',
        variant: 'destructive',
      });
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { nomeSala: string; nomeTemplate: string; date: string; turno: Turno }>({
    mutationFn: ({ nomeSala, nomeTemplate, date, turno }) =>
      salaApi.applyTemplate(nomeSala, nomeTemplate, date, turno),
    onSuccess: async (_void, v) => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.tables(v.nomeSala, v.date, v.turno) });
      await queryClient.invalidateQueries({ queryKey: salaKeys.configuration(v.nomeSala, v.date, v.turno) });
      toast({
        title: 'Template applicato',
        description: `Template "${v.nomeTemplate}" applicato a ${v.date} (${v.turno}).`,
      });
    },
    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile applicare il template.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { nomeSala: string; nomeTemplate: string }>({
    mutationFn: ({ nomeSala, nomeTemplate }) => salaApi.deleteTemplate(nomeSala, nomeTemplate),
    onSuccess: async (_void, v) => {
      await queryClient.invalidateQueries({ queryKey: salaKeys.templates(v.nomeSala) });
      toast({
        title: 'Template eliminato',
        description: `Template "${v.nomeTemplate}" eliminato.`,
      });
    },
    onError: (e) => {
      const err = unknownToApiError(e);
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile eliminare il template.',
        variant: 'destructive',
      });
    },
  });
}
