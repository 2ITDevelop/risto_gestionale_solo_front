import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  CalendarDays, 
  Users, 
  LayoutGrid, 
  Clock,
  ArrowRight,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { TurnoSelector } from '@/components/TurnoSelector';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { useReservationsByDate } from '@/hooks/use-reservations';
import { useSalas } from '@/hooks/use-sala';
import { formatDateForApi, formatDateForDisplay, isToday } from '@/lib/date-utils';
import type { Turno, Reservation, ReservationSummary } from '@/types';

// helper: deduco il turno dall’orario (HH:mm)
function getTurnoFromOrario(orario: string): Turno {
  const [hh] = orario.split(':').map(Number);
  return hh < 15 ? 'PRANZO' : 'CENA';
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTurno, setSelectedTurno] = useState<Turno>('PRANZO');
  
  const dateApi = formatDateForApi(selectedDate);
  
  const { 
    data: reservations,
    isLoading: reservationsLoading, 
    error: reservationsError,
    refetch: refetchReservations 
  } = useReservationsByDate(dateApi);
  
  const { data: salas, isLoading: salasLoading } = useSalas();

  // Summary sicuro anche se reservations è undefined o non è un array
  const summary = useMemo<ReservationSummary>(() => {
    const list: Reservation[] = Array.isArray(reservations) ? reservations : [];

    const result: ReservationSummary = {
      totalReservations: list.length,
      totalSeats: list.reduce((sum, r) => sum + r.numPersone, 0),
      bySala: {}, // il back non manda la sala nella Reservation, quindi resta vuoto
      byTurno: {
        PRANZO: { reservations: 0, seats: 0 },
        CENA: { reservations: 0, seats: 0 },
      },
    };
    
    list.forEach((r) => {
      const turno = getTurnoFromOrario(r.orario);
      result.byTurno[turno].reservations++;
      result.byTurno[turno].seats += r.numPersone;
    });
    
    return result;
  }, [reservations]);

  // Lista prenotazioni per turno selezionato, sicura
  const currentTurnoReservations: Reservation[] = useMemo(
    () =>
      Array.isArray(reservations)
        ? reservations.filter((r) => getTurnoFromOrario(r.orario) === selectedTurno)
        : [],
    [reservations, selectedTurno]
  );

  // Loader iniziale
  if (reservationsLoading || salasLoading) {
    return <PageLoader text="Caricamento dashboard..." />;
  }

  // Stato di errore (es. backend spento / fetch fallita)
  if (reservationsError) {
    return (
      <ErrorDisplay 
        message="Impossibile caricare le prenotazioni."
        onRetry={() => refetchReservations()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {isToday(selectedDate) ? 'Oggi, ' : ''}
            {formatDateForDisplay(selectedDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DatePicker 
            date={selectedDate} 
            onDateChange={(d) => d && setSelectedDate(d)} 
          />
          <Button asChild>
            <Link to="/reservations/new">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Prenotazione
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalReservations}</p>
                <p className="text-xs text-muted-foreground">Prenotazioni</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.totalSeats}</p>
                <p className="text-xs text-muted-foreground">Coperti totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-status-reserved/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-status-reserved" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.byTurno.PRANZO.reservations}
                </p>
                <p className="text-xs text-muted-foreground">Pranzo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.byTurno.CENA.reservations}
                </p>
                <p className="text-xs text-muted-foreground">Cena</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="glass-card hover:shadow-medium transition-shadow cursor-pointer group">
          <Link to="/reservations/new">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Nuova Prenotazione</p>
                  <p className="text-xs text-muted-foreground">Aggiungi cliente</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Link>
        </Card>
        
        <Card className="glass-card hover:shadow-medium transition-shadow cursor-pointer group">
          <Link to="/rooms">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Mappa Sale</p>
                  <p className="text-xs text-muted-foreground">Gestisci tavoli</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Link>
        </Card>
        
        <Card className="glass-card hover:shadow-medium transition-shadow cursor-pointer group">
          <Link to="/working-days">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Giorni Lavorativi</p>
                  <p className="text-xs text-muted-foreground">Gestisci orari</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Reservations List */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Prenotazioni</CardTitle>
              <CardDescription>
                {currentTurnoReservations.length} prenotazioni per{' '}
                {selectedTurno === 'PRANZO' ? 'pranzo' : 'cena'}
              </CardDescription>
            </div>
            <TurnoSelector value={selectedTurno} onChange={setSelectedTurno} />
          </div>
        </CardHeader>
        <CardContent>
          {currentTurnoReservations.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nessuna prenotazione"
              description={`Non ci sono prenotazioni per ${
                selectedTurno === 'PRANZO' ? 'pranzo' : 'cena'
              } in questa data.`}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/reservations/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi prenotazione
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {currentTurnoReservations.map((reservation, index) => (
                <ReservationCard key={`${reservation.nome}-${index}`} reservation={reservation} />
              ))}
              
              <Link 
                to="/reservations" 
                className="flex items-center justify-center gap-2 p-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                Vedi tutte le prenotazioni
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{reservation.nome}</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {reservation.numPersone}{' '}
              {reservation.numPersone === 1 ? 'persona' : 'persone'}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {reservation.numeroTelefono && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {reservation.numeroTelefono}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
