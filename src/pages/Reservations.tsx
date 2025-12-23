import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Trash2, 
  Phone, 
  Users, 
  Calendar,
  Filter,
  X
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/DatePicker';
import { TurnoSelector } from '@/components/TurnoSelector';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useReservationsByDate, useDeleteReservation } from '@/hooks/use-reservations';
import { workingDaysApi } from '@/api/working-days';
import { salaApi } from '@/api/sala';
import { workingDayKeys } from '@/hooks/use-working-days';
import { salaKeys } from '@/hooks/use-sala';
import { formatDateForApi, formatDateForDisplay } from '@/lib/date-utils';
import type { Turno, Reservation } from '@/types';
import { cn } from '@/lib/utils';

// helper per dedurre il turno dall’orario (HH:mm)
function getTurnoFromOrario(orario: string): Turno {
  const [hh] = orario.split(':').map(Number);
  return hh < 15 ? 'PRANZO' : 'CENA';
}

export default function Reservations() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTurno, setSelectedTurno] = useState<Turno | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ date: string; nome: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const prefetchNewReservationData = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: workingDayKeys.all,
      queryFn: workingDaysApi.getAll,
    });
    queryClient.prefetchQuery({
      queryKey: salaKeys.all,
      queryFn: salaApi.getAll,
    });
  }, [queryClient]);

  useEffect(() => {
    prefetchNewReservationData();
  }, [prefetchNewReservationData]);
  
  const dateApi = formatDateForApi(selectedDate);
  
  const { 
    data: reservationsRaw, 
    isLoading, 
    error,
    refetch 
  } = useReservationsByDate(dateApi);
  
  const deleteReservation = useDeleteReservation();

  // Normalizziamo i dati a un array sicuro
  const reservations: Reservation[] = Array.isArray(reservationsRaw) ? reservationsRaw : [];

  // Filter reservations
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations];
    
    // Filter by turno
    if (selectedTurno !== 'ALL') {
      filtered = filtered.filter(r => getTurnoFromOrario(r.orario) === selectedTurno);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.nome.toLowerCase().includes(query) ||
        r.numeroTelefono?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [reservations, selectedTurno, searchQuery]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    await deleteReservation.mutateAsync(deleteTarget);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return <PageLoader text="Caricamento prenotazioni..." />;
  }

  if (error) {
    return (
      <ErrorDisplay 
        message="Impossibile caricare le prenotazioni."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prenotazioni</h1>
          <p className="text-muted-foreground">
            {formatDateForDisplay(selectedDate)}
          </p>
        </div>
        <Button asChild onMouseEnter={prefetchNewReservationData}>
          <Link to="/reservations/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuova Prenotazione
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <DatePicker 
                date={selectedDate} 
                onDateChange={(d) => d && setSelectedDate(d)} 
              />
              
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, telefono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'bg-secondary')}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            
            {showFilters && (
              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Turno:</span>
                <div className="flex gap-2">
                  <Button
                    variant={selectedTurno === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTurno('ALL')}
                  >
                    Tutti
                  </Button>
                  <Button
                    variant={selectedTurno === 'PRANZO' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTurno('PRANZO')}
                  >
                    Pranzo
                  </Button>
                  <Button
                    variant={selectedTurno === 'CENA' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTurno('CENA')}
                  >
                    Cena
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle>Lista Prenotazioni</CardTitle>
          <CardDescription>
            {filteredReservations.length} prenotazioni trovate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReservations.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Nessuna prenotazione"
              description={
                searchQuery 
                  ? "Nessuna prenotazione corrisponde alla tua ricerca."
                  : "Non ci sono prenotazioni per questa data."
              }
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Cancella ricerca
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/reservations/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi prenotazione
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((reservation, index) => (
                <ReservationRow 
                  key={`${reservation.nome}-${index}`} 
                  reservation={reservation}
                  onDelete={() => setDeleteTarget({ date: reservation.date, nome: reservation.nome })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la prenotazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare la prenotazione di <strong>{deleteTarget?.nome}</strong>.
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReservation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReservationRow({ 
  reservation, 
  onDelete 
}: { 
  reservation: Reservation; 
  onDelete: () => void;
}) {
  const turno = getTurnoFromOrario(reservation.orario);

  return (
    <div className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-foreground">{reservation.nome}</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Users className="h-3 w-3 mr-1" />
              {reservation.numPersone}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                turno === 'PRANZO' 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-indigo-100 text-indigo-800'
              )}
            >
              {turno === 'PRANZO' ? 'Pranzo' : 'Cena'}
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
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
