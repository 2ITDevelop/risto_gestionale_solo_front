import { useState } from 'react';
import { Plus, Trash2, Calendar, Sun, Moon, Star, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/DatePicker';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { 
  useWorkingDays, 
  useCreateWorkingDay, 
  useDeleteTemplateWorkingDay,
  useDeleteSpecialWorkingDay 
} from '@/hooks/use-working-days';
import { formatDateForApi, formatDateShort } from '@/lib/date-utils';
import type { WorkingDay, WorkingDayType, CreateWorkingDayDto } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const typeLabels: Record<WorkingDayType, string> = {
  WEEKDAY: 'Giorni Feriali',
  SATURDAY: 'Sabato',
  SUNDAY: 'Domenica',
  SPECIAL: 'Giorni Speciali',
};

// niente React.ElementType qui, così evitiamo errori di tipo
const typeIcons: Record<WorkingDayType, LucideIcon> = {
  WEEKDAY: CalendarDays,
  SATURDAY: Calendar,
  SUNDAY: Sun,
  SPECIAL: Star,
};

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, idx) => {
  const totalMinutes = idx * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
});

// Tipo SOLO per il form della dialog
type WorkingDayForm = {
  tipo: WorkingDayType;
  apertoLunch: boolean;
  apertoDinner: boolean;
  orarioAperturaLunch?: string;
  orarioChiusuraLunch?: string;
  orarioAperturaDinner?: string;
  orarioChiusuraDinner?: string;
};

function formatTimeDisplay(time?: string | null): string {
  if (!time) return '';
  // converte "HH:mm:ss" -> "HH:mm"
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}

export default function WorkingDays() {
  const [selectedType, setSelectedType] = useState<WorkingDayType | 'ALL'>('ALL');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: WorkingDayType; date?: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<WorkingDay | null>(null);
  
  const { data: workingDaysRaw, isLoading, error, refetch } = useWorkingDays();
  const deleteTemplate = useDeleteTemplateWorkingDay();
  const deleteSpecial = useDeleteSpecialWorkingDay();

  // Normalizziamo sempre a un array per evitare crash quando il back è spento
  const workingDays: WorkingDay[] = Array.isArray(workingDaysRaw) ? workingDaysRaw : [];

  const filteredDays = workingDays.filter(d => 
    selectedType === 'ALL' || d.type === selectedType
  );

  const groupedDays = filteredDays.reduce((acc, day) => {
    if (!acc[day.type]) acc[day.type] = [];
    acc[day.type].push(day);
    return acc;
  }, {} as Record<WorkingDayType, WorkingDay[]>);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'SPECIAL' && deleteTarget.date) {
      await deleteSpecial.mutateAsync({ type: deleteTarget.type, date: deleteTarget.date });
    } else {
      await deleteTemplate.mutateAsync(deleteTarget.type);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return <PageLoader text="Caricamento orari..." />;
  }

  if (error) {
    return (
      <ErrorDisplay 
        message="Impossibile caricare gli orari."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Giorni Lavorativi</h1>
          <p className="text-muted-foreground">
            Gestisci gli orari di apertura
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Giorno
        </Button>
      </div>

      {/* Filtro tipo giorno (invece dei Tabs Radix) */}
      <div className="inline-flex flex-wrap gap-2 rounded-lg bg-secondary/40 p-1">
        <FilterChip
          label="Tutti"
          active={selectedType === 'ALL'}
          onClick={() => setSelectedType('ALL')}
        />
        <FilterChip
          label="Feriali"
          active={selectedType === 'WEEKDAY'}
          onClick={() => setSelectedType('WEEKDAY')}
        />
        <FilterChip
          label="Sabato"
          active={selectedType === 'SATURDAY'}
          onClick={() => setSelectedType('SATURDAY')}
        />
        <FilterChip
          label="Domenica"
          active={selectedType === 'SUNDAY'}
          onClick={() => setSelectedType('SUNDAY')}
        />
        <FilterChip
          label="Speciali"
          active={selectedType === 'SPECIAL'}
          onClick={() => setSelectedType('SPECIAL')}
        />
      </div>

      {/* Content */}
      {filteredDays.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16">
            <EmptyState
              icon={Calendar}
              title="Nessun giorno configurato"
              description="Aggiungi i giorni lavorativi e gli orari di apertura del ristorante."
              action={
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Giorno
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDays).map(([type, days]) => (
            <Card key={type} className="glass-card">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = typeIcons[type as WorkingDayType];
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <div>
                    <CardTitle>{typeLabels[type as WorkingDayType]}</CardTitle>
                    <CardDescription>{days.length} configurazione/i</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {days.map((day, index) => (
                    <WorkingDayRow 
                      key={`${day.type}-${day.data || index}`} 
                      day={day}
                      onView={() => setViewTarget(day)}
                      onDelete={() => setDeleteTarget({ type: day.type, date: day.data })}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateWorkingDayDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />

      {/* View details */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli giorno</DialogTitle>
            <DialogDescription>
              {viewTarget?.type === 'SPECIAL'
                ? `Giorno speciale - ${viewTarget?.data ? formatDateShort(viewTarget.data) : ''}`
                : typeLabels[viewTarget?.type ?? 'WEEKDAY']}
            </DialogDescription>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-3">
              <DetailRow
                label="Pranzo"
                active={!viewTarget.g1}
                start={viewTarget.a1}
                end={viewTarget.c1}
              />
              <DetailRow
                label="Cena"
                active={!viewTarget.g2}
                start={viewTarget.a2}
                end={viewTarget.c2}
              />
              {viewTarget.data && (
                <p className="text-sm text-muted-foreground">
                  Data: {formatDateShort(viewTarget.data)}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la configurazione?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'SPECIAL' && deleteTarget.date
                ? `Questa azione rimuoverà la configurazione speciale per ${
                    deleteTarget.date ? formatDateShort(deleteTarget.date) : ''
                  }.`
                : `Questa azione rimuoverà il template per ${
                    typeLabels[deleteTarget?.type ?? 'WEEKDAY']
                  }.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-transparent text-muted-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}

function WorkingDayRow({ day, onDelete, onView }: { day: WorkingDay; onDelete: () => void; onView: () => void }) {
  const lunchOpen = !day.g1;
  const dinnerOpen = !day.g2;
  return (
    <button
      type="button"
      onClick={onView}
      className="w-full text-left flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
    >
      <div className="flex-1">
        {day.data && (
          <p className="text-sm font-medium text-primary mb-1">
            {formatDateShort(day.data)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          {/* Pranzo (g1/a1/c1) */}
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <span
              className={cn(
                "text-sm",
                lunchOpen ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              Pranzo
            </span>
            {lunchOpen && day.a1 && day.c1 && (
              <span className="text-sm text-muted-foreground">
                ({day.a1} - {day.c1})
              </span>
            )}
          </div>

          {/* Cena (g2/a2/c2) */}
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span
              className={cn(
                "text-sm",
                dinnerOpen ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              Cena
            </span>
            {dinnerOpen && day.a2 && day.c2 && (
              <span className="text-sm text-muted-foreground">
                ({day.a2} - {day.c2})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </button>
  );
}

function DetailRow({ label, active, start, end }: { label: string; active: boolean; start?: string | null; end?: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("text-xs px-2 py-1 rounded-full", active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
          {active ? 'Attivo' : 'Chiuso'}
        </span>
      </div>
      {start && end ? (
        <span className="text-sm text-muted-foreground">
          {formatTimeDisplay(start)} - {formatTimeDisplay(end)}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Orari non impostati</span>
      )}
    </div>
  );
}

function CreateWorkingDayDialog({ 
  open, 
  onOpenChange,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const createWorkingDay = useCreateWorkingDay();
  
  const [formData, setFormData] = useState<WorkingDayForm>({
    tipo: 'WEEKDAY',
    apertoLunch: true,
    apertoDinner: true,
    orarioAperturaLunch: '12:00',
    orarioChiusuraLunch: '15:00',
    orarioAperturaDinner: '19:00',
    orarioChiusuraDinner: '23:00',
  });
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();


  const handleSubmit = async () => {
    const dto: CreateWorkingDayDto = {
      type: formData.tipo,
      // backend si aspetta false = aperto, true = chiuso
      g1: !formData.apertoLunch,
      g2: !formData.apertoDinner,
      a1: formData.apertoLunch ? formData.orarioAperturaLunch : undefined,
      c1: formData.apertoLunch ? formData.orarioChiusuraLunch : undefined,
      a2: formData.apertoDinner ? formData.orarioAperturaDinner : undefined,
      c2: formData.apertoDinner ? formData.orarioChiusuraDinner : undefined,
      data:
        formData.tipo === 'SPECIAL' && selectedDate
          ? formatDateForApi(selectedDate)
          : undefined,
    };
    
    await createWorkingDay.mutateAsync(dto);
    onOpenChange(false);
    
    // Reset form
    setFormData({
      tipo: 'WEEKDAY',
      apertoLunch: true,
      apertoDinner: true,
      orarioAperturaLunch: '12:00',
      orarioChiusuraLunch: '15:00',
      orarioAperturaDinner: '19:00',
      orarioChiusuraDinner: '23:00',
    });
    setSelectedDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo Giorno Lavorativo</DialogTitle>
          <DialogDescription>
            Configura gli orari di apertura
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={formData.tipo}
              onValueChange={(v) => setFormData({ ...formData, tipo: v as WorkingDayType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKDAY">Giorni Feriali</SelectItem>
                <SelectItem value="SATURDAY">Sabato</SelectItem>
                <SelectItem value="SUNDAY">Domenica</SelectItem>
                <SelectItem value="SPECIAL">Giorno Speciale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data per SPECIAL */}
          {formData.tipo === 'SPECIAL' && (
            <div className="space-y-2">
              <Label>Data</Label>
              <DatePicker
                date={selectedDate}
                onDateChange={setSelectedDate}
                className="w-full"
              />
            </div>
          )}

          {/* Pranzo */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Pranzo
              </Label>
              <Switch
                checked={formData.apertoLunch}
                onCheckedChange={(checked) => setFormData({ ...formData, apertoLunch: checked })}
              />
            </div>
            
            {formData.apertoLunch && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Apertura</Label>
                  <Select
                    value={formData.orarioAperturaLunch || ''}
                    onValueChange={(v) => setFormData({ ...formData, orarioAperturaLunch: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli orario" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`lunch-open-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiusura</Label>
                  <Select
                    value={formData.orarioChiusuraLunch || ''}
                    onValueChange={(v) => setFormData({ ...formData, orarioChiusuraLunch: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli orario" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`lunch-close-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Cena */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Cena
              </Label>
              <Switch
                checked={formData.apertoDinner}
                onCheckedChange={(checked) => setFormData({ ...formData, apertoDinner: checked })}
              />
            </div>
            
            {formData.apertoDinner && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Apertura</Label>
                  <Select
                    value={formData.orarioAperturaDinner || ''}
                    onValueChange={(v) => setFormData({ ...formData, orarioAperturaDinner: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli orario" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`dinner-open-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiusura</Label>
                  <Select
                    value={formData.orarioChiusuraDinner || ''}
                    onValueChange={(v) => setFormData({ ...formData, orarioChiusuraDinner: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli orario" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={`dinner-close-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createWorkingDay.isPending || (formData.tipo === 'SPECIAL' && !selectedDate)}
          >
            {createWorkingDay.isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
