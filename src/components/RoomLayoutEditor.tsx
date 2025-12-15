import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { GripVertical, Trash2, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusDot } from '@/components/StatusBadge';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';

import {
  useAssignReservation,
  useCreateTables,
  useDeleteTable,
  useTables,
} from '@/hooks/use-sala';
import { useReservationsByDate } from '@/hooks/use-reservations';

import type { Reservation, Sala, TableStatus, Tavolo, TipoZona, Turno } from '@/types';

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

/* ======================
   Tipi FE
   ====================== */

type UILayoutReservation = Reservation & {
  turno?: Turno;
  tavoloAssegnato?: boolean;
  numeroPosti?: number;
};

type UILayoutTavolo = Tavolo & {
  capacita?: number;
  nomePrenotazione?: string;
  nomeSala?: string;
  turno?: Turno;
  data?: string;
};

type DragDataReservation = {
  type: 'reservation';
  name: string;
};

type DragDataNewTable = {
  type: 'new-table';
  capacity: number;
};

type DragData = DragDataReservation | DragDataNewTable;

/* ======================
   Helpers zone
   ====================== */

function getSalaSize(sala: Sala): { width: number; height: number } {
  if (!sala.zone || sala.zone.length === 0) return { width: 8, height: 6 };

  let maxX = 0;
  let maxY = 0;

  sala.zone.forEach((z) => {
    maxX = Math.max(maxX, z.x + z.base);
    maxY = Math.max(maxY, z.y + z.altezza);
  });

  return { width: maxX, height: maxY };
}

/**
 * PRIORITÀ:
 * - se una cella ricade in una zona NON_VIVIBILE -> NON_VIVIBILE
 * - altrimenti se ricade in una VIVIBILE -> VIVIBILE
 * - altrimenti null (fuori zone)
 */
function getCellTipoZona(sala: Sala, x: number, y: number): TipoZona | null {
  const zones = sala.zone ?? [];
  let foundVivibile = false;

  for (const z of zones) {
    const inside = x >= z.x && x < z.x + z.base && y >= z.y && y < z.y + z.altezza;
    if (!inside) continue;

    if (z.tipo === 'SPAZIO_NON_VIVIBILE') return 'SPAZIO_NON_VIVIBILE';
    if (z.tipo === 'SPAZIO_VIVIBILE') foundVivibile = true;
  }

  return foundVivibile ? 'SPAZIO_VIVIBILE' : null;
}

const isCellVivibile = (tipoZona: TipoZona | null) => tipoZona === 'SPAZIO_VIVIBILE';

/* ======================
   Component
   ====================== */

interface RoomLayoutEditorProps {
  sala: Sala;
  date: string;
  turno: Turno;
  canEditTables: boolean;
}

// Tip per eventi gesture Safari iOS
type SafariGestureEvent = Event & { scale: number };

export function RoomLayoutEditor({ sala, date, turno, canEditTables }: RoomLayoutEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ x: number; y: number } | null>(null);

  const {
    data: tables,
    isLoading: tablesLoading,
    error: tablesError,
    refetch,
  } = useTables(sala.nome, date, turno);

  const { data: reservations } = useReservationsByDate(date);

  const createTables = useCreateTables();
  const deleteTable = useDeleteTable();
  const assignReservation = useAssignReservation();

  const unassignedReservations = useMemo<UILayoutReservation[]>(() => {
    if (!reservations) return [];
    const list = reservations as UILayoutReservation[];
    return list.filter((r) => r.turno === turno && !r.tavoloAssegnato);
  }, [reservations, turno]);

  const { width, height } = useMemo(() => getSalaSize(sala), [sala]);

  const gridCells = useMemo(() => {
    const cells: { x: number; y: number; tipoZona: TipoZona | null }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells.push({ x, y, tipoZona: getCellTipoZona(sala, x, y) });
      }
    }
    return cells;
  }, [sala, width, height]);

  const getTableAt = (x: number, y: number): UILayoutTavolo | undefined => {
    const base = tables?.find((t) => t.x === x && t.y === y);
    return base as UILayoutTavolo | undefined;
  };

  /* ======================
     ✅ PINCH ZOOM SOLO MOBILE (Safari iOS PWA friendly)
     ====================== */

  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const zoomTargetRef = useRef<HTMLDivElement | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!isMobile) return;

    const el = gridViewportRef.current;
    if (!el) return;

    // iOS Safari gesture events (molto più affidabili di touch* in PWA)
    const onGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const onGestureChange = (e: Event) => {
      const ge = e as SafariGestureEvent;
      e.preventDefault();

      // ge.scale è relativo al gesto (≈1 all’inizio)
      const next = clamp(zoomRef.current * ge.scale, 1, 3.5);
      setZoom(next);
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      // lo zoom resta così com’è
    };

    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });

    return () => {
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [isMobile]);

  /* ======================
     DND handlers
     ====================== */

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditTables) return;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    if (!canEditTables) return;

    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const dragData = active.data.current as DragData | undefined;
    if (!dragData) return;

    // Prenotazione -> Tavolo
    if (dragData.type === 'reservation' && overId.startsWith('table-')) {
      const [, xStr, yStr] = overId.split('-');
      const x = Number(xStr);
      const y = Number(yStr);

      assignReservation.mutate({
        nomeSala: sala.nome,
        date,
        turno,
        x,
        y,
        nomePrenotazione: dragData.name,
      });
      return;
    }

    // Nuovo tavolo -> Cella
    if (dragData.type === 'new-table' && overId.startsWith('cell-')) {
      const [, xStr, yStr] = overId.split('-');
      const x = Number(xStr);
      const y = Number(yStr);

      const cell = gridCells.find((c) => c.x === x && c.y === y);
      if (!cell || !isCellVivibile(cell.tipoZona)) return;

      const existingTable = getTableAt(x, y);
      if (existingTable) return;

      createTables.mutate({
        nomeSala: sala.nome,
        date,
        turno,
        table: { x, y, stato: 'LIBERO' as TableStatus },
      });
    }
  };

  const handleDeleteTable = async () => {
    if (!deleteTarget) return;

    await deleteTable.mutateAsync({
      nomeSala: sala.nome,
      date,
      turno,
      x: deleteTarget.x,
      y: deleteTarget.y,
    });

    setDeleteTarget(null);
  };

  /* ======================
     Loading / Error / Empty
     ====================== */

  if (tablesLoading) return <PageLoader text="Caricamento tavoli..." />;

  if (tablesError) {
    return <ErrorDisplay message="Impossibile caricare i tavoli." onRetry={() => refetch()} />;
  }

  if (!sala.zone || sala.zone.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{sala.nome}</CardTitle>
          <CardDescription>
            Nessuna zona definita per questa sala. Configura le zone nelle impostazioni prima di
            aggiungere tavoli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vai in <span className="font-medium">Impostazioni → Sale → Modifica Zone</span> per
            definire la mappa della sala.
          </p>
        </CardContent>
      </Card>
    );
  }

  /* ======================
     Render
     ====================== */

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid lg:grid-cols-[1fr,300px] gap-6">
        <Card className="glass-card min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{sala.nome}</CardTitle>
                <CardDescription>
                  {tables?.length || 0} tavoli · {width}x{height} griglia
                  {isMobile && <span className="ml-2 text-xs text-muted-foreground">· zoom {zoom.toFixed(2)}x</span>}
                </CardDescription>
              </div>

              <div className="flex flex-col items-end gap-1 text-xs">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusDot status="LIBERO" />
                    <span className="text-muted-foreground">Libero</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot status="RISERVATO" />
                    <span className="text-muted-foreground">Riservato</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot status="OCCUPATO" />
                    <span className="text-muted-foreground">Occupato</span>
                  </div>
                </div>

                {!canEditTables && (
                  <span className="text-[11px] text-amber-600">
                    Configurazione non attiva: crea/attiva la configurazione per questa data e turno
                    per posizionare i tavoli.
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-w-0">
            <div
              ref={gridViewportRef}
              className={cn(
                'p-4 rounded-lg bg-secondary/30 w-full min-w-0',
                isMobile ? 'overflow-auto' : 'overflow-hidden'
              )}
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
              }}
            >
              {/* “spazio scrollabile” quando zoom > 1 */}
              <div
                className="-mx-1 px-1 min-w-0"
                style={{
                  width: isMobile ? `${100 * zoom}%` : '100%',
                  height: isMobile ? `${100 * zoom}%` : 'auto',
                }}
              >
                <div
                  ref={zoomTargetRef}
                  style={{
                    transform: isMobile ? `scale(${zoom})` : undefined,
                    transformOrigin: 'top left',
                  }}
                >
                  <div
                    className="grid gap-[2px] w-full min-w-0"
                    style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
                  >
                    {gridCells.map(({ x, y, tipoZona }) => {
                      const table = getTableAt(x, y);

                      const neighbors = table
                        ? {
                            left: !!getTableAt(x - 1, y),
                            right: !!getTableAt(x + 1, y),
                            up: !!getTableAt(x, y - 1),
                            down: !!getTableAt(x, y + 1),
                          }
                        : undefined;

                      return (
                        <GridCell
                          key={`${x}-${y}`}
                          x={x}
                          y={y}
                          table={table}
                          tipoZona={tipoZona}
                          neighbors={neighbors}
                          onDelete={() => setDeleteTarget({ x, y })}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nuovo Tavolo</CardTitle>
              <CardDescription>Trascina sulla griglia per aggiungere un tavolo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <TablePaletteItem capacity={2} disabled={!canEditTables} />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prenotazioni da Assegnare</CardTitle>
              <CardDescription>{unassignedReservations.length} in attesa</CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedReservations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessuna prenotazione da assegnare
                </p>
              ) : (
                <div className="space-y-2">
                  {unassignedReservations.map((r, i) => (
                    <DraggableReservation key={`${r.nome}-${i}`} reservation={r} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeId.startsWith('reservation-') && (
          <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-lg">
            {activeId.replace('reservation-', '')}
          </div>
        )}
        {activeId && activeId.startsWith('palette-') && (
          <div className="w-16 h-16 rounded-lg bg-primary/80 flex items-center justify-center shadow-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
      </DragOverlay>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il tavolo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione rimuoverà il tavolo dalla posizione selezionata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}

/* ======================
   Components
   ====================== */

interface CellNeighbors {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

interface GridCellProps {
  x: number;
  y: number;
  table?: UILayoutTavolo;
  tipoZona: TipoZona | null;
  neighbors?: CellNeighbors;
  onDelete: () => void;
}

function GridCell({ x, y, table, tipoZona, neighbors, onDelete }: GridCellProps) {
  const isVivibile = tipoZona === 'SPAZIO_VIVIBILE';

  const { setNodeRef, isOver } = useDroppable({
    id: table ? `table-${x}-${y}` : `cell-${x}-${y}`,
    disabled: !table && !isVivibile,
  });

  if (!table) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'aspect-square rounded-[4px] border transition-colors',
          isVivibile && 'grid-cell',
          !isVivibile && 'bg-[#d8c8b1] opacity-70 border-[#b8a994] cursor-not-allowed',
          isOver && isVivibile && 'grid-cell-active'
        )}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative aspect-square p-1 flex flex-col items-center justify-center transition-all overflow-hidden',
        'border-2',
        table.stato === 'LIBERO' && 'bg-status-free/20 border-status-free',
        table.stato === 'RISERVATO' && 'bg-status-reserved/20 border-status-reserved',
        table.stato === 'OCCUPATO' && 'bg-status-occupied/20 border-status-occupied',
        isOver && 'ring-2 ring-primary ring-offset-2',
        neighbors?.left && 'border-l-0 rounded-l-none',
        neighbors?.right && 'border-r-0 rounded-r-none',
        neighbors?.up && 'border-t-0 rounded-t-none',
        neighbors?.down && 'border-b-0 rounded-b-none'
      )}
    >
      <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5" />
      {typeof table.capacita === 'number' && (
        <span className="text-[10px] sm:text-[11px] font-medium leading-none">
          {table.capacita}
        </span>
      )}

      {table.nomePrenotazione && (
        <span className="absolute bottom-0.5 text-[9px] sm:text-[10px] font-medium truncate max-w-full px-1">
          {table.nomePrenotazione}
        </span>
      )}

      <button
        onClick={onDelete}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function TablePaletteItem({ capacity, disabled }: { capacity: number; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${capacity}`,
    data: { type: 'new-table', capacity } as DragDataNewTable,
    disabled: !!disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? listeners : {})}
      {...(!disabled ? attributes : {})}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-secondary/50',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:bg-secondary',
        'transition-colors',
        isDragging && 'opacity-50'
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Users className="h-4 w-4 text-primary" />
      </div>
      <span className="text-sm font-medium">Tavolo</span>
    </div>
  );
}

function DraggableReservation({ reservation }: { reservation: UILayoutReservation }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `reservation-${reservation.nome}`,
    data: { type: 'reservation', name: reservation.nome } as DragDataReservation,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-secondary/50 cursor-grab',
        'hover:bg-secondary transition-colors',
        isDragging && 'opacity-50'
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{reservation.nome}</p>
        {typeof reservation.numeroPosti === 'number' && (
          <p className="text-xs text-muted-foreground">{reservation.numeroPosti} persone</p>
        )}
      </div>
    </div>
  );
}
