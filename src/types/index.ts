// ===============================
// Enum types (uguali al backend)
// ===============================

// Turno.java
export type Turno = 'PRANZO' | 'CENA';

// StatoTavolo.java
export type TableStatus = 'LIBERO' | 'RISERVATO' | 'OCCUPATO';

// WorkingDayType.java
export type WorkingDayType = 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'SPECIAL';

// TipoZona.java
export type TipoZona = 'SPAZIO_VIVIBILE' | 'SPAZIO_NON_VIVIBILE';


// ===================================
// Modelli API 1:1 con le entity Java
// ===================================

// Prenotazione.java
export interface Reservation {
  nome: string;
  numPersone: number;
  date: string;          // yyyy-MM-dd (LocalDate, @JsonFormat)
  orario: string;        // HH:mm (LocalTime, @JsonFormat)
  numeroTelefono?: string;
  nota?: string;
}

// lato back usi sempre Prenotazione come body, quindi puoi
// riusare lo stesso tipo per il create:
export type CreateReservationDto = Reservation;


// Tavolo.java
export interface Tavolo {
  x: number;
  y: number;
  stato: TableStatus;
  // tutto il resto (id, capacita, ecc.) è solo frontend, NON arriva dal back
}


// ZonaSala.java
export interface ZonaSala {
  x: number;
  y: number;
  tipo: TipoZona;
  base: number;
  altezza: number;
}

// Sala.java
export interface Sala {
  nome: string;
  zone: ZonaSala[];
}

// CreateSala: lato back puoi usare la stessa shape della Sala
export type CreateSalaDto = Sala;


// ConfigurazioneSala.java
export interface SalaConfiguration {
  data: string;      // yyyy-MM-dd
  turno: Turno;
  sala: Sala;
  tavoli?: Tavolo[];
}

// 👇 DTO usato per la chiamata POST /api/sala/configurazioni
export interface CreateSalaConfigurationDto {
  data: string;      // yyyy-MM-dd
  turno: Turno;
  sala: { nome: string };   // solo il nome basta al backend
}


// WorkingDay.java
export interface WorkingDay {
  type: WorkingDayType;  // campo "type" nella entity
  g1: boolean;           // primo turno aperto (ex apertoLunch)
  g2: boolean;           // secondo turno aperto (ex apertoDinner)

  // orari con pattern HH:mm (LocalTime con @JsonFormat)
  a1?: string;           // apertura primo turno
  c1?: string;           // chiusura primo turno
  a2?: string;           // apertura secondo turno
  c2?: string;           // chiusura secondo turno

  // usato per i giorni SPECIAL (WorkingDayController usa LocalDate)
  data?: string;         // yyyy-MM-dd
}

export type CreateWorkingDayDto = WorkingDay;


// ===================================
// Tipi solo frontend (dashboard, UI)
// ===================================

// Questi non esistono lato back, puoi tenerli come sono
// o adattarli come ti pare: non impattano le API.

export interface ReservationSummary {
  totalReservations: number;
  totalSeats: number;
  bySala: Record<string, { reservations: number; seats: number }>;
  byTurno: Record<Turno, { reservations: number; seats: number }>;
}

export interface TableSummary {
  total: number;
  free: number;
  reserved: number;
  occupied: number;
  blocked: number;  // solo lato UI, NON mappato su StatoTavolo
}

// Template configurazione sala (backend)
export interface SalaTemplateHeader {
  nomeSala: string;
  nomeTemplate: string;
}

export interface SalaTemplate {
  nomeSala: string;
  nomeTemplate: string;
  sala?: Sala;
  tavoli?: Tavolo[];
}
