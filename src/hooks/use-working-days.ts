import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workingDaysApi } from '@/api/working-days';
import type { WorkingDay, WorkingDayType, CreateWorkingDayDto } from '@/types';
import { toast } from '@/hooks/use-toast';

export const workingDayKeys = {
  all: ['workingDays'] as const,
  byType: (type: WorkingDayType) => ['workingDays', type] as const,
};

export function useWorkingDays() {
  return useQuery({
    queryKey: workingDayKeys.all,
    queryFn: workingDaysApi.getAll,
  });
}

export function useWorkingDaysByType(type: WorkingDayType) {
  return useQuery({
    queryKey: workingDayKeys.byType(type),
    queryFn: () => workingDaysApi.getByType(type),
    enabled: !!type,
  });
}

export function useCreateWorkingDay() {
  const queryClient = useQueryClient();

  return useMutation<WorkingDay, Error, CreateWorkingDayDto>({
    mutationFn: (data) => workingDaysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingDayKeys.all });
      toast({
        title: 'Configurazione salvata',
        description: 'Il giorno lavorativo è stato configurato correttamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile salvare il giorno lavorativo.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTemplateWorkingDay() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, WorkingDayType>({
    mutationFn: (type) => workingDaysApi.deleteTemplate(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingDayKeys.all });
      toast({
        title: 'Template eliminato',
        description: 'La configurazione del giorno è stata rimossa.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile eliminare il template.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSpecialWorkingDay() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { type: WorkingDayType; date: string }>({
    mutationFn: ({ type, date }) => workingDaysApi.deleteSpecial(type, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workingDayKeys.all });
      toast({
        title: 'Giorno speciale eliminato',
        description: 'La configurazione del giorno speciale è stata rimossa.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile eliminare il giorno speciale.',
        variant: 'destructive',
      });
    },
  });
}
