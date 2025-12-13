import { format, parse, isValid, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

// Format date for API calls (ISO format)
export const formatDateForApi = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Parse date from API response
export const parseDateFromApi = (dateString: string): Date => {
  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : new Date();
};

// Format date for display (Italian locale)
export const formatDateForDisplay = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseDateFromApi(date) : date;
  return format(d, 'EEEE d MMMM yyyy', { locale: it });
};

// Format date short
export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseDateFromApi(date) : date;
  return format(d, 'dd/MM/yyyy');
};

// Get today's date in API format
export const getTodayApiFormat = (): string => {
  return formatDateForApi(new Date());
};

// Check if date is today
export const isToday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? parseDateFromApi(date) : date;
  const today = new Date();
  return format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
};

// Format time for display
export const formatTime = (time: string | undefined): string => {
  if (!time) return '';
  try {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  } catch {
    return time;
  }
};

// Get day of week
export const getDayOfWeek = (date: Date): string => {
  return format(date, 'EEEE', { locale: it });
};
