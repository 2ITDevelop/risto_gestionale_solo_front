import { apiClient } from './client';
import { API_ENDPOINTS } from '@/config/api';
import type { WorkingDay, CreateWorkingDayDto, WorkingDayType } from '@/types';

export const workingDaysApi = {
  // Get all working days
  getAll: () => apiClient.get<WorkingDay[]>(API_ENDPOINTS.workingDays.base),
  
  // Get working days by type
  getByType: (type: WorkingDayType) =>
    apiClient.get<WorkingDay[]>(API_ENDPOINTS.workingDays.byType(type)),
  
  // Create a new working day
  create: (data: CreateWorkingDayDto) =>
    apiClient.post<WorkingDay, CreateWorkingDayDto>(API_ENDPOINTS.workingDays.base, data),
  
  // Delete template working day by type
  deleteTemplate: (type: WorkingDayType) =>
    apiClient.delete<void>(API_ENDPOINTS.workingDays.deleteTemplate(type)),
  
  // Delete special working day
  deleteSpecial: (type: WorkingDayType, date: string) =>
    apiClient.delete<void>(API_ENDPOINTS.workingDays.deleteSpecial(type, date)),
};
