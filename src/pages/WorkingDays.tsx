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

export default function WorkingDays() {
  const [selectedType, setSelectedType] = useState<WorkingDayType | 'ALL'>('ALL');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: WorkingDayType; date?: string } | null>(null);
  
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

function WorkingDayRow({ day, onDelete }: { day: WorkingDay; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
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
                day.g1 ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              Pranzo
            </span>
            {day.g1 && day.a1 && day.c1 && (
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
                day.g2 ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              Cena
            </span>
            {day.g2 && day.a2 && day.c2 && (
              <span className="text-sm text-muted-foreground">
                ({day.a2} - {day.c2})
              </span>
            )}
          </div>
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
  );
}

function CreateWorkingDayDialog({ 
  open, 
  onOpenChange 
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
      g1: formData.apertoLunch,
      g2: formData.apertoDinner,
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
                  <Input
                    type="time"
                    value={formData.orarioAperturaLunch || ''}
                    onChange={(e) => setFormData({ ...formData, orarioAperturaLunch: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiusura</Label>
                  <Input
                    type="time"
                    value={formData.orarioChiusuraLunch || ''}
                    onChange={(e) => setFormData({ ...formData, orarioChiusuraLunch: e.target.value })}
                  />
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
                  <Input
                    type="time"
                    value={formData.orarioAperturaDinner || ''}
                    onChange={(e) => setFormData({ ...formData, orarioAperturaDinner: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiusura</Label>
                  <Input
                    type="time"
                    value={formData.orarioChiusuraDinner || ''}
                  onChange={(e) => setFormData({ ...formData, orarioChiusuraDinner: e.target.value })}
                  />
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
