import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings, LayoutGrid, Layers, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { TurnoSelector } from '@/components/TurnoSelector';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import {
  useSalas,
  useSaveConfiguration,
  useSalaConfigurationCheck,
  useSalaTemplates,
  useCreateTemplateFromConfig,
  useApplyTemplate,
} from '@/hooks/use-sala';
import { formatDateForApi } from '@/lib/date-utils';
import type { Turno, Sala, CreateSalaConfigurationDto } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RoomLayoutEditor } from '@/components/RoomLayoutEditor';

// Tipo di errore generico per le API (es. Axios)
interface ApiError {
  message?: string;
  response?: {
    data?: unknown;
  };
}

export default function Rooms() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTurno, setSelectedTurno] = useState<Turno>('PRANZO');
  const [selectedSala, setSelectedSala] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);

  // flag FE per abilitare/disabilitare l’editing dei tavoli
  const [hasConfiguration, setHasConfiguration] = useState<boolean>(false);

  const { data: salasRaw, isLoading, error, refetch } = useSalas();
  const saveConfiguration = useSaveConfiguration();
  const createTemplateFromConfig = useCreateTemplateFromConfig();
  const applyTemplate = useApplyTemplate();

  const dateApi = formatDateForApi(selectedDate);
  const salas: Sala[] = Array.isArray(salasRaw) ? salasRaw : [];

const { data: salaConfig, isLoading: isConfigLoading } = useSalaConfigurationCheck(
  selectedSala || undefined,
  dateApi,
  selectedTurno
);

const {
  data: templatesRaw,
  isLoading: templatesLoading,
  error: templatesError,
  refetch: refetchTemplates,
} = useSalaTemplates(selectedSala || undefined);

const templates = Array.isArray(templatesRaw) ? templatesRaw : [];

useEffect(() => {
  setSelectedTemplate('');
}, [selectedSala]);

const normalizedTemplates = useMemo(() => {
  const list = Array.isArray(templates) ? templates : [];
  const normalize = (raw: any) => {
    if (typeof raw === 'string') return { name: raw };
    const name =
      raw?.nomeTemplate ??
      raw?.templateName ??
      raw?.nome ??
      raw?.template ??
      raw?.name ??
      '';
    return name ? { name } : null;
  };
  return list.map(normalize).filter(Boolean) as { name: string }[];
}, [templates]);

// ogni volta che il BE dice che esiste/non esiste una config, aggiorno il flag FE
useEffect(() => {
  setHasConfiguration(!!salaConfig);
}, [salaConfig]);


  if (isLoading) {
    return <PageLoader text="Caricamento sale..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        message="Impossibile caricare le sale."
        onRetry={() => refetch()}
      />
    );
  }

  const currentSala = salas.find((s) => s.nome === selectedSala);

const handleCreateConfiguration = () => {
  // se la config è già attiva, non facciamo niente
  if (!selectedSala || hasConfiguration) return;

  const payload: CreateSalaConfigurationDto = {
    data: dateApi,
    turno: selectedTurno,
    sala: { nome: selectedSala },
  };

  saveConfiguration.mutate(payload, {
    onSuccess: () => {
      setHasConfiguration(true);
    },
    onError: (err: unknown) => {
      const apiErr = err as ApiError;

      let msg: string | undefined;

      if (typeof apiErr?.response?.data === 'string') {
        msg = apiErr.response.data;
      } else if (typeof apiErr?.message === 'string') {
        msg = apiErr.message;
      }

      if (msg && msg.includes('Configurazione già esistente')) {
        setHasConfiguration(true);
      }
    },
  });
};

const handleCreateTemplateFromConfig = async () => {
  if (!selectedSala || !hasConfiguration || !templateName.trim()) return;
  await createTemplateFromConfig.mutateAsync({
    nomeSala: selectedSala,
    nomeTemplate: templateName.trim(),
    date: dateApi,
    turno: selectedTurno,
  });
  setTemplateName('');
  setShowCreateTemplateDialog(false);
  refetchTemplates();
};

  const handleApplyTemplate = async (templateName?: string) => {
    const templateToApply = templateName ?? selectedTemplate;
    if (!selectedSala || !templateToApply || !hasConfiguration) return;
    await applyTemplate.mutateAsync({
      nomeSala: selectedSala,
      nomeTemplate: templateToApply,
      date: dateApi,
      turno: selectedTurno,
    });
    refetchTemplates();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestione Sale</h1>
          <p className="text-muted-foreground">
            Visualizza e gestisci i tavoli delle sale
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/settings">
            <Settings className="h-4 w-4 mr-2" />
            Configura Sale
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <DatePicker
              date={selectedDate}
              onDateChange={(d) => d && setSelectedDate(d)}
            />

            <TurnoSelector
              value={selectedTurno}
              onChange={setSelectedTurno}
              className="min-w-[180px]"
            />

            <Select value={selectedSala} onValueChange={setSelectedSala}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Seleziona sala" />
              </SelectTrigger>
              <SelectContent>
                {salas.map((sala) => (
                  <SelectItem key={sala.nome} value={sala.nome}>
                    {sala.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Card per creare/attivare la configurazione */}
      {selectedSala && (
        <Card className="glass-card border-dashed">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                Configurazione per <span className="font-semibold">{selectedSala}</span> ·{' '}
                <span className="font-semibold">{dateApi}</span> ·{' '}
                <span className="font-semibold">{selectedTurno}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Prima di posizionare i tavoli, è necessario creare (o attivare) la
                configurazione della sala per questa data e turno.
              </p>
            </div>
            <Button
              onClick={handleCreateConfiguration}
              disabled={!selectedSala || saveConfiguration.isPending || isConfigLoading}
              variant={hasConfiguration ? 'outline' : 'default'}
            >
              {saveConfiguration.isPending
                ? 'Creazione configurazione...'
                : hasConfiguration
                ? 'Configurazione attiva'
                : 'Crea / attiva configurazione'}
            </Button>

          </CardContent>
        </Card>
      )}

      {/* Template actions dentro configurazione sala */}
      {selectedSala && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Template sala
            </CardTitle>
            <CardDescription>
              Crea un template dal layout attuale o applicane uno alla data/turno correnti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasConfiguration && (
              <p className="text-sm text-destructive">
                Attiva prima la configurazione per questa data/turno per creare o applicare template.
              </p>
            )}

            {templatesError ? (
              <ErrorDisplay
                message="Impossibile caricare i template."
                onRetry={() => refetchTemplates()}
              />
            ) : templatesLoading ? (
              <PageLoader text="Caricamento template..." />
            ) : normalizedTemplates.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Nessun template"
                description="Crea un template dalla configurazione corrente."
              />
            ) : (
              <div className="space-y-2">
                {normalizedTemplates.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="font-medium">{t.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyTemplate(t.name)}
                      disabled={!hasConfiguration || applyTemplate.isPending}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {applyTemplate.isPending && selectedTemplate === t.name
                        ? 'Applicazione...'
                        : 'Applica'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog crea template */}
      <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea template dalla configurazione</DialogTitle>
            <DialogDescription>
              Il template userà i tavoli della sala {selectedSala} per {dateApi} ({selectedTurno}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome template</Label>
              <Input
                placeholder="Es. Base pranzo"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                disabled={!hasConfiguration}
              />
            </div>
            {!hasConfiguration && (
              <p className="text-sm text-destructive">
                Attiva prima la configurazione per questa data/turno.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplateDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateTemplateFromConfig}
              disabled={
                !hasConfiguration ||
                createTemplateFromConfig.isPending ||
                !templateName.trim()
              }
            >
              {createTemplateFromConfig.isPending ? 'Salvataggio...' : 'Salva template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Layout */}
      {!selectedSala ? (
        <Card className="glass-card">
          <CardContent className="py-16">
            <EmptyState
              icon={LayoutGrid}
              title="Seleziona una sala"
              description={
                salas.length > 0
                  ? 'Scegli una sala dal menu sopra per visualizzare la mappa dei tavoli.'
                  : 'Non ci sono sale configurate. Vai alle impostazioni per creare una nuova sala.'
              }
              action={
                salas.length === 0 ? (
                  <Button asChild>
                    <Link to="/settings">
                      <Plus className="h-4 w-4 mr-2" />
                      Crea prima sala
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : currentSala ? (
        <RoomLayoutEditor
          sala={currentSala}
          date={dateApi}
          turno={selectedTurno}
          canEditTables={hasConfiguration}
          canCreateTemplate={hasConfiguration}
          onOpenCreateTemplate={() => setShowCreateTemplateDialog(true)}
        />
      ) : null}
    </div>
  );
}
