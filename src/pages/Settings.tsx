import { useState } from 'react';
import { Plus, Trash2, LayoutGrid, Settings as SettingsIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';

import { useSalas, useCreateSala, useDeleteSala } from '@/hooks/use-sala';
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

  const { data: salasRaw, isLoading, error, refetch } = useSalas();
  const deleteSala = useDeleteSala();

  const salas: Sala[] = Array.isArray(salasRaw) ? salasRaw : [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSala.mutateAsync(deleteTarget);
    setDeleteTarget(null);
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
