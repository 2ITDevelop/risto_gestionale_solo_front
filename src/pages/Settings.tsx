import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, LayoutGrid, Settings as SettingsIcon, Layers, Trash } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';

import {
  useSalas,
  useCreateSala,
  useDeleteSala,
  useSalaTemplates,
  useDeleteTemplate,
} from '@/hooks/use-sala';
import type { Sala, CreateSalaDto, ZonaSala } from '@/types';

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditZonesDialog } from '@/components/EditZonesDialog';

function getSalaSize(sala: Sala): { width: number; height: number } {
  const zones: ZonaSala[] = sala.zone || [];
  if (zones.length === 0) return { width: 8, height: 6 };

  let maxX = 0;
  let maxY = 0;
  zones.forEach((z) => {
    maxX = Math.max(maxX, z.x + z.base);
    maxY = Math.max(maxY, z.y + z.altezza);
  });

  return { width: maxX, height: maxY };
}

export default function Settings() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingSala, setEditingSala] = useState<Sala | null>(null);
  const [selectedSalaName, setSelectedSalaName] = useState<string | null>(null);

  const { data: salasRaw, isLoading, error, refetch } = useSalas();
  const deleteSala = useDeleteSala();
  const deleteTemplate = useDeleteTemplate();

  const salas: Sala[] = Array.isArray(salasRaw) ? salasRaw : [];
  const selectedSala = useMemo(
    () => salas.find((s) => s.nome === selectedSalaName) || null,
    [salas, selectedSalaName]
  );

  useEffect(() => {
    if (selectedSala) return;
    if (salas.length === 0) {
      setSelectedSalaName(null);
      return;
    }
    setSelectedSalaName(salas[0].nome);
  }, [salas, selectedSala]);

  const {
    data: templatesRaw,
    isLoading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useSalaTemplates(selectedSala?.nome);
  const templates = useMemo(() => {
    const normalizeItem = (raw: any) => {
      if (typeof raw === 'string') {
        return { name: raw, salaName: selectedSala?.nome ?? '' };
      }

      const name =
        raw?.nomeTemplate ??
        raw?.templateName ??
        raw?.nome ??
        raw?.template ??
        raw?.name ??
        '';

      const salaName =
        raw?.nomeSala ??
        raw?.sala ??
        raw?.salaNome ??
        raw?.roomName ??
        raw?.sala?.nome ??
        selectedSala?.nome ??
        '';

      if (!name) return null;
      return { name, salaName };
    };

    const list = Array.isArray(templatesRaw)
      ? templatesRaw
      : Array.isArray((templatesRaw as any)?.templates)
        ? (templatesRaw as any).templates
        : [];

    return list.map(normalizeItem).filter(Boolean) as { name: string; salaName: string }[];
  }, [templatesRaw, selectedSala?.nome]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSala.mutateAsync(deleteTarget);
    setDeleteTarget(null);
  };

  const handleDeleteTemplate = async (nomeTemplate: string) => {
    if (!selectedSala) return;
    await deleteTemplate.mutateAsync({ nomeSala: selectedSala.nome, nomeTemplate });
  };

  if (isLoading) return <PageLoader text="Caricamento impostazioni..." />;

  if (error) {
    return (
      <ErrorDisplay
        message="Impossibile caricare le impostazioni."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impostazioni</h1>
          <p className="text-muted-foreground">Configura sale e preferenze del ristorante</p>
        </div>
      </div>

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Sale
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Layers className="h-4 w-4 mr-2" />
            Template sala
          </TabsTrigger>
          <TabsTrigger value="general">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Generali
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Sala
            </Button>
          </div>

          {salas.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {salas.map((sala) => {
                const zones: ZonaSala[] = sala.zone || [];
                const { width, height } = getSalaSize(sala);
                const vivibili = zones.filter((z) => z.tipo === 'SPAZIO_VIVIBILE').length;
                const nonVivibili = zones.filter((z) => z.tipo === 'SPAZIO_NON_VIVIBILE').length;

                return (
                  <Card key={sala.nome} className="glass-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{sala.nome}</CardTitle>
                          <CardDescription>
                            Griglia {width}×{height} · {zones.length} zone
                          </CardDescription>
                          {zones.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {vivibili} vivibili · {nonVivibili} non vivibili
                            </p>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(sala.nome)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setEditingSala(sala)}
                      >
                        Modifica zone
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="py-16">
                <EmptyState
                  icon={LayoutGrid}
                  title="Nessuna sala configurata"
                  description="Crea la prima sala per iniziare a gestire i tavoli."
                  action={
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea prima sala
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Template sala</CardTitle>
              <CardDescription>Visualizza ed elimina i template esistenti per ciascuna sala.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-sm">
                <Label>Sala</Label>
                <Select
                  value={selectedSala?.nome || ''}
                  onValueChange={(val) => setSelectedSalaName(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una sala" />
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

              {!selectedSala && (
                <p className="text-sm text-muted-foreground">
                  Seleziona una sala per vedere i template disponibili.
                </p>
              )}

              {selectedSala && (
                <Card className="border">
                  <CardHeader>
                    <CardTitle>Template di {selectedSala.nome}</CardTitle>
                    <CardDescription>Lista dei template salvati per questa sala.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {templatesError ? (
                      <ErrorDisplay
                        message="Impossibile caricare i template."
                        onRetry={() => refetchTemplates()}
                      />
                    ) : templatesLoading ? (
                      <PageLoader text="Caricamento template..." />
                    ) : templates.length === 0 ? (
                      <EmptyState
                        icon={Layers}
                        title="Nessun template"
                        description="Non ci sono template salvati per questa sala."
                      />
                    ) : (
                      <div className="space-y-3">
                        {templates.map((t) => (
                          <div
                            key={t.name}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3"
                          >
                            <span className="font-medium">{t.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTemplate(t.name)}
                              disabled={deleteTemplate.isPending}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Impostazioni Generali</CardTitle>
              <CardDescription>Configurazioni generali del ristorante</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Altre impostazioni saranno disponibili presto.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateRoomDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {editingSala && (
        <EditZonesDialog
          sala={editingSala}
          open={!!editingSala}
          onOpenChange={(open) => !open && setEditingSala(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la sala?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione eliminerà la sala "{deleteTarget}" e tutti i suoi tavoli.
              L&apos;azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSala.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateRoomDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createSala = useCreateSala();

  const [formData, setFormData] = useState<CreateSalaDto>({
    nome: '',
    zone: [],
  });

  const handleSubmit = async () => {
    if (!formData.nome.trim()) return;

    await createSala.mutateAsync({
      nome: formData.nome.trim(),
      zone: [],
    });

    onOpenChange(false);
    setFormData({ nome: '', zone: [] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Sala</DialogTitle>
          <DialogDescription>
            Crea una nuova sala. Le zone verranno configurate successivamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              placeholder="Es. Sala Principale"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSala.isPending || !formData.nome.trim()}
          >
            {createSala.isPending ? 'Creazione...' : 'Crea Sala'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
