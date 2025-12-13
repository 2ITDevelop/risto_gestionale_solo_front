// API Configuration
// Change this URL to point to your backend server
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://risto-api-522460212064.europe-west1.run.app';

export const API_ENDPOINTS = {
  // Prenotazioni (Reservations)
  reservations: {
    base: '/api/prenotazioni',
    byDate: (date: string) => `/api/prenotazioni/${date}`,
    byDateAndName: (date: string, nome: string) => `/api/prenotazioni/${date}/${encodeURIComponent(nome)}`,
  },
  
  // Sala (Rooms)
  sala: {
    base: '/api/sala',
    byName: (nomeSala: string) => `/api/sala/${encodeURIComponent(nomeSala)}`,
    zones: (nomeSala: string) => `/api/sala/${encodeURIComponent(nomeSala)}/zone`,
    configurations: '/api/sala/configurazioni',
    tables: (nomeSala: string, date: string, turno: string) => 
      `/api/sala/tavoli/${encodeURIComponent(nomeSala)}/${date}/${turno}`,
    tableByPosition: (nomeSala: string, date: string, turno: string, x: number, y: number) =>
      `/api/sala/tavoli/${encodeURIComponent(nomeSala)}/${date}/${turno}/${x}/${y}`,
    assignReservation: (nomeSala: string, date: string, turno: string, x: number, y: number, nomePrenotazione: string) =>
      `/api/sala/tavoli/${encodeURIComponent(nomeSala)}/${date}/${turno}/${x}/${y}/assegna-prenotazione/${encodeURIComponent(nomePrenotazione)}`,
    reservationGroups: (nomeSala: string, date: string, turno: string) =>
      `/api/sala/tavoli/${encodeURIComponent(nomeSala)}/${date}/${turno}/prenotazioni-gruppo`,
    configuration: (nomeSala: string, date: string, turno: string) =>
      `/api/sala/configurazioni/${encodeURIComponent(nomeSala)}/${date}/${turno}`,
    seatGroups: (nomeSala: string, date: string, turno: string) =>
      `/api/sala/posti/${encodeURIComponent(nomeSala)}/${date}/${turno}/gruppi`,
    totalSeats: (nomeSala: string, date: string, turno: string) =>
      `/api/sala/posti/${encodeURIComponent(nomeSala)}/${date}/${turno}/totale`,
  },
  
  // Working Days
  workingDays: {
    base: '/api/working-days',
    byType: (type: string) => `/api/working-days/type/${type}`,
    deleteTemplate: (type: string) => `/api/working-days/template/${type}`,
    deleteSpecial: (type: string, date: string) => `/api/working-days/special/${type}/${date}`,
  },
} as const;
