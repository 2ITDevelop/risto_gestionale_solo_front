import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GripVertical, Trash2, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { StatusDot } from '@/components/StatusBadge';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';

import { useAssignReservation, useCreateTables, useDeleteTable, useTables } from '@/hooks/use-sala';
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
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/* ======================
   Component
   ====================== */

interface RoomLayoutEditorProps {
  sala: Sala;
  date: string;
  turno: Turno;
  canEditTables: boolean;
}

export function RoomLayoutEditor({ sala, date, turno, canEditTables }: RoomLayoutEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ x: number; y: number } | null>(null);
  const pinchRafRef = useRef<number | null>(null);
  const pinchPendingZoomRef = useRef<number | null>(null);


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
     ✅ Zoom reale + FIT 1x + scroll mobile non limitato
     ====================== */

  const layoutKey = `${sala.nome}-${date}-${turno}`;
  const gridViewportRef = useRef<HTMLDivElement | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const GAP = 2;
  const PAD = 12;
  const DESKTOP_VIEWPORT_H = 520;


const [zoom, setZoom] = useState(1);

// ===== Pinch-to-zoom (2 dita) =====
type TouchPoint = { clientX: number; clientY: number };

const pinchStartDistRef = useRef<number | null>(null);
const pinchStartZoomRef = useRef<number>(1);

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;

const clampZoom = (z: number) => clamp(z, MIN_ZOOM, MAX_ZOOM);

const dist2 = (t1: TouchPoint, t2: TouchPoint) => {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
};

const handleTouchStartPinch = (e: React.TouchEvent<HTMLDivElement>) => {
  if (e.touches.length === 2) {
    pinchStartDistRef.current = dist2(e.touches[0], e.touches[1]);
    pinchStartZoomRef.current = zoom;
  }
};

const handleTouchMovePinch = (e: React.TouchEvent<HTMLDivElement>) => {
  if (activeId) return;

  if (e.touches.length !== 2) return;
  if (pinchStartDistRef.current == null) return;

  e.preventDefault();

  const d = dist2(e.touches[0], e.touches[1]);
  const startD = pinchStartDistRef.current;
  if (startD <= 0) return;

  const scale = d / startD;
  const nextZoom = clampZoom(pinchStartZoomRef.current * scale);

  // ✅ aggiorna al massimo 1 volta per frame
  pinchPendingZoomRef.current = nextZoom;

  if (pinchRafRef.current == null) {
    pinchRafRef.current = requestAnimationFrame(() => {
      const z = pinchPendingZoomRef.current;
      if (z != null) setZoom(z);
      pinchRafRef.current = null;
    });
  }
};


const handleTouchEndPinch = (e: React.TouchEvent<HTMLDivElement>) => {
  if (e.touches.length < 2) {
    pinchStartDistRef.current = null;
    pinchPendingZoomRef.current = null;

    if (pinchRafRef.current != null) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
  }
};




  const [baseCell, setBaseCell] = useState(22);

  const viewportH = useMemo(() => {
    if (!isMobile) return DESKTOP_VIEWPORT_H;
    const vh = Math.floor(window.innerHeight * 0.7);
    return clamp(vh, 280, 720);
  }, [isMobile]);

  // ✅ ZOOM REALE (NO transform sulla griglia)
  const cellSize = useMemo(() => Math.round(baseCell * zoom), [baseCell, zoom]);

  const gridPixelH = useMemo(
  () => height * cellSize + Math.max(0, height - 1) * GAP,
  [height, cellSize, GAP]
);

const contentH = useMemo(() => gridPixelH + PAD * 2, [gridPixelH, PAD]);

const effectiveViewportH = useMemo(() => {
  const minH = 220; // evita che diventi troppo basso
  return clamp(Math.min(viewportH, contentH), minH, viewportH);
}, [viewportH, contentH]);


  // scala solo l’icona/testo
  const contentScale = useMemo(() => clamp(cellSize / 40, 0.45, 1), [cellSize]);

  // reset “hard” su cambio sala/date/turno
  useEffect(() => {
    setZoom(1);
    const el = gridViewportRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }, [layoutKey]);


  useEffect(() => {
  const el = gridViewportRef.current;
  if (!el) return;

  const onTouchMove = (ev: TouchEvent) => {
    if (ev.touches.length === 2) {
      ev.preventDefault();
    }
  };

  el.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => el.removeEventListener('touchmove', onTouchMove);
}, []);

  // ✅ FIT: calcola baseCell per far entrare tutta la sala a zoom=1
  useLayoutEffect(() => {
    const el = gridViewportRef.current;
    if (!el) return;

    let raf = 0;
    let cancelled = false;

    const computeFit = () => {
      if (cancelled) return;

      const w = el.clientWidth;
      const h = viewportH;

      if (!w || !h) {
        raf = requestAnimationFrame(computeFit);
        return;
      }

      const totalGapW = Math.max(0, width - 1) * GAP;
      const totalGapH = Math.max(0, height - 1) * GAP;

      const availW = Math.max(1, w - PAD * 2);
      const availH = Math.max(1, h - PAD * 2);

      const byW = (availW - totalGapW) / width;
      const byH = (availH - totalGapH) / height;

      const next = Math.max(1, Math.floor(Math.min(byW, byH)));
      setBaseCell((prev) => (prev === next ? prev : next));
    };

    computeFit();

    window.addEventListener('resize', computeFit);
    window.addEventListener('orientationchange', computeFit);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', computeFit);
      window.removeEventListener('orientationchange', computeFit);
    };
  }, [layoutKey, width, height, viewportH]);

  // ✅ Workaround iOS: forza ricalcolo area scrollabile quando cambia la dimensione reale
  useLayoutEffect(() => {
    const el = gridViewportRef.current;
    if (!el) return;
    void el.offsetHeight; // force reflow
  }, [cellSize, width, height]);

  /* ======================
     ✅ FIX MOBILE: sensors per evitare conflitto scroll vs drag
     (scroll rimane attivo, il drag parte con una micro "pressione")
     ====================== */

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      // su smartphone: evita che lo swipe venga "rubato" dal drag
      // e rende il drag affidabile quando premi intenzionalmente
      activationConstraint: { delay: 320, tolerance: 4 },
    })
  );

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
            Nessuna zona definita per questa sala. Configura le zone nelle impostazioni prima di aggiungere tavoli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vai in <span className="font-medium">Impostazioni → Sale → Modifica Zone</span> per definire la mappa della
            sala.
          </p>
        </CardContent>
      </Card>
    );
  }

  /* ======================
     Render
     ====================== */

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid lg:grid-cols-[1fr,300px] gap-6">
        <Card className="glass-card min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{sala.nome}</CardTitle>
                <CardDescription>
                  {tables?.length || 0} tavoli · {width}x{height} griglia
                  <span className="ml-2 text-xs text-muted-foreground">· zoom {zoom.toFixed(2)}x</span>
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
                    Configurazione non attiva: crea/attiva la configurazione per questa data e turno per posizionare i
                    tavoli.
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-w-0 min-h-0">
            <div className="p-4 rounded-lg bg-secondary/30 w-full min-w-0 min-h-0">
              <div className="min-w-0 min-h-0">
                <div
  key={layoutKey}
  ref={gridViewportRef}
  className="rounded-md w-full min-w-0 overflow-auto"
  onTouchStart={handleTouchStartPinch}
  onTouchMove={handleTouchMovePinch}
  onTouchEnd={handleTouchEndPinch}
  onTouchCancel={handleTouchEndPinch}
  style={{
    WebkitOverflowScrolling: 'touch',
    touchAction: 'manipulation', 
    height: `${effectiveViewportH}px`,
  }}
>

                  {/* ✅ wrapper neutro: niente flex, altrimenti su iOS può “limitare” lo scroll */}
                  <div
                    style={{
                      padding: PAD,
                      width: 'max-content',
                      height: 'max-content',
                      margin: '0 auto', // centra orizzontalmente
                    }}
                  >
                    <div
                      className="grid gap-[2px]"
                      style={{
                        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
                        gridAutoRows: `${cellSize}px`,
                        width: width * cellSize + Math.max(0, width - 1) * GAP,
                        height: height * cellSize + Math.max(0, height - 1) * GAP,
                      }}
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
                            cellSize={cellSize}
                            contentScale={contentScale}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-10">0.5x</span>

                  <Slider value={[zoom]} min={0.5} max={3.5} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />

                  <span className="text-[11px] text-muted-foreground w-10 text-right">3.5x</span>

                  <button
                    type="button"
                    className="ml-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setZoom(1)}
                  >
                    reset
                  </button>
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
                <p className="text-sm text-muted-foreground text-center py-4">Nessuna prenotazione da assegnare</p>
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
            <AlertDialogDescription>Questa azione rimuoverà il tavolo dalla posizione selezionata.</AlertDialogDescription>
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
  cellSize: number;
  contentScale: number;
}

function GridCell({ x, y, table, tipoZona, neighbors, onDelete, cellSize, contentScale }: GridCellProps) {
  const isVivibile = tipoZona === 'SPAZIO_VIVIBILE';

  const { setNodeRef, isOver } = useDroppable({
    id: table ? `table-${x}-${y}` : `cell-${x}-${y}`,
    disabled: !table && !isVivibile,
  });

  const style: React.CSSProperties = { width: cellSize, height: cellSize };

  if (!table) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'rounded-[4px] border transition-colors',
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
      style={style}
      className={cn(
        'relative p-1 flex items-center justify-center transition-all overflow-hidden',
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
      <div
        className="flex flex-col items-center justify-center leading-none"
        style={{ transform: `scale(${contentScale})`, transformOrigin: 'center' }}
      >
        <Users className="h-4 w-4 mb-0.5" />
        {typeof table.capacita === 'number' && <span className="text-[11px] font-medium">{table.capacita}</span>}
      </div>

      {table.nomePrenotazione && (
        <span className="absolute bottom-0.5 text-[10px] font-medium truncate max-w-full px-1">
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
    style={{
      touchAction: 'none',          // ✅ fondamentale: stabilizza dnd su touch
      WebkitUserSelect: 'none',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
    }}
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
    style={{
      touchAction: 'none',          // ✅ stabilizza anche qui
      WebkitUserSelect: 'none',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
    }}
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
