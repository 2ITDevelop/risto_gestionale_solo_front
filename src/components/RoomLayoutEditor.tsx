import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Loader2, Receipt, Trash2, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { StatusDot } from '@/components/StatusBadge';
import { PageLoader } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { salaApi } from '@/api/sala';

import {
  useAssignReservation,
  useCreateTables,
  useDeleteGroupReservation,
  useDeleteTable,
  useGroupReservations,
  useTables,
} from '@/hooks/use-sala';
import { useReservationsByDate, useReservation } from '@/hooks/use-reservations';

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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/* ======================
   Tipi FE
   ====================== */

type UILayoutReservation = Reservation & {
  turno?: Turno;
  tavoloAssegnato?: boolean;
  assignedCoords?: { x: number; y: number };

  // compat: nel tuo vecchio UI usavi numeroPosti, ma il backend ha numPersone
  numeroPosti?: number;

  // ✅ placeholder per il futuro (oggi non arriva dal backend)
  nota?: string;
};

type UILayoutTavolo = Tavolo & {
  nomePrenotazione?: string;
  nomeSala?: string;
  turno?: Turno;
  data?: string;
};

type DragDataReservation = {
  type: 'reservation';
  name: string; // nome prenotazione
};

type DragData = DragDataReservation;

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

function getTurnoFromOrario(orario?: string): Turno {
  const hh = Number(orario?.split(':')?.[0]);
  return hh < 15 ? 'PRANZO' : 'CENA';
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
  onOpenCreateTemplate?: () => void;
  canCreateTemplate?: boolean;
}

type EditMode = 'NONE' | 'ADD' | 'DELETE';

export function RoomLayoutEditor({
  sala,
  date,
  turno,
  canEditTables,
  onOpenCreateTemplate,
  canCreateTemplate = false,
}: RoomLayoutEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ x: number; y: number } | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('NONE');

  // ✅ dialog dettagli prenotazione
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string>('');

  // dialog prenotazioni del tavolo/gruppo
  const [selectedTableCoords, setSelectedTableCoords] = useState<{ x: number; y: number } | null>(null);
  const [removingReservation, setRemovingReservation] = useState<string | null>(null);

  const openReservationDetails = (r: UILayoutReservation) => {
    setSelectedName(r.nome);
    setDetailsOpen(true);
  };

  const closeReservationDetails = () => {
    setDetailsOpen(false);
    // non resetto selectedName subito, così il dialog non “sfarfalla” durante close animation
    // se vuoi pulire: setSelectedName('');
  };

  const closeGroupDialog = () => setSelectedTableCoords(null);

  // fetch dettaglio (solo quando dialog è aperto e ho nome)
  const {
    data: reservationDetails,
    isLoading: detailsLoading,
    error: detailsError,
  } = useReservation(date, selectedName);

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
  const deleteGroupReservation = useDeleteGroupReservation();

  // asseganzioni note dal backend (nome prenotazione -> coords)
  const [assignedFromBackend, setAssignedFromBackend] = useState<Map<string, { x: number; y: number }[]>>(new Map());
  // versione per forzare refetch assegnazioni (es. dopo nuove assign)
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);
  const [highlightedCoords, setHighlightedCoords] = useState<{ x: number; y: number }[] | null>(null);

  // mappa prenotazioni già assegnate (da tutti i tavoli della sala/turno/data)
  const assignedReservationNames = useMemo(() => {
    const set = new Set<string>();
    tables?.forEach((t) => {
      const anyTable = t as UILayoutTavolo;
      if (anyTable.nomePrenotazione) set.add(anyTable.nomePrenotazione);
    });
    assignedFromBackend.forEach((_coords, name) => set.add(name));
    return set;
  }, [tables, assignedFromBackend]);

  // mappa prenotazioni -> prima coppia di coordinate dove sono assegnate
  const reservationAssignmentMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }[]>();

    const addCoord = (name: string, coord: { x: number; y: number }) => {
      const arr = map.get(name) ?? [];
      if (!arr.some((c) => c.x === coord.x && c.y === coord.y)) arr.push(coord);
      map.set(name, arr);
    };

    tables?.forEach((t) => {
      const anyTable = t as UILayoutTavolo;
      if (anyTable.nomePrenotazione) addCoord(anyTable.nomePrenotazione, { x: t.x, y: t.y });
    });

    assignedFromBackend.forEach((coords, name) => {
      coords.forEach((c) => addCoord(name, c));
    });

    return map;
  }, [tables, assignedFromBackend]);

  const selectedCoords = useMemo(
    () => (selectedName ? reservationAssignmentMap.get(selectedName)?.[0] : undefined),
    [selectedName, reservationAssignmentMap]
  );

  const highlightReservationTables = (name: string) => {
    const coords = reservationAssignmentMap.get(name) ?? [];
    if (coords.length === 0) return;
    setHighlightedCoords(coords);
    const first = coords[0];
    const el = document.getElementById(`table-cell-${first.x}-${first.y}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    setDetailsOpen(false);

    setTimeout(() => setHighlightedCoords(null), 3000);
  };

  const {
    data: groupReservations,
    isLoading: groupReservationsLoading,
    error: groupReservationsError,
    refetch: refetchGroupReservations,
  } = useGroupReservations(
    sala.nome,
    date,
    turno,
    selectedTableCoords?.x,
    selectedTableCoords?.y
  );

  const unassignedReservations = useMemo<UILayoutReservation[]>(() => {
    if (!reservations) return [];
    const list = reservations as Reservation[];

    return list
      .filter((r) => getTurnoFromOrario(r.orario) === turno)
      .map((r) => ({
        ...r,
        numeroPosti: r.numPersone,
        tavoloAssegnato: assignedReservationNames.has(r.nome),
        assignedCoords: reservationAssignmentMap.get(r.nome)?.[0],
      }));
  }, [reservations, turno, assignedReservationNames, reservationAssignmentMap]);

  // fetch assegnazioni da backend (prenotazioni di gruppo) per tavoli, includendo prenotazioni multiple sullo stesso gruppo
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!tables || tables.length === 0) {
        setAssignedFromBackend(new Map());
        return;
      }

      const map = new Map<string, { x: number; y: number }[]>();

      const addCoord = (name: string, coord: { x: number; y: number }) => {
        const arr = map.get(name) ?? [];
        if (!arr.some((c) => c.x === coord.x && c.y === coord.y)) arr.push(coord);
        map.set(name, arr);
      };

      // prima passata: uso la risposta tables (nomePrenotazione)
      tables.forEach((t) => {
        const anyTable = t as UILayoutTavolo;
        if (anyTable.nomePrenotazione) addCoord(anyTable.nomePrenotazione, { x: t.x, y: t.y });
      });

      // seconda passata: chiamo le groupReservations per scoprire prenotazioni aggiuntive sul gruppo
      await Promise.all(
        tables.map(async (t) => {
          try {
            const res = await salaApi.getGroupReservations(sala.nome, date, turno, t.x, t.y);
            res.forEach((p) => addCoord(p.nome, { x: t.x, y: t.y }));
          } catch (e) {
            // ignore error: fallback a quanto già noto
          }
        })
      );

      if (!cancelled) {
        setAssignedFromBackend(map);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [tables, sala.nome, date, turno, assignmentsVersion]);

  // clear highlight on unmount/layout change
  useEffect(() => {
    return () => setHighlightedCoords(null);
  }, []);


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
     Zoom reale + FIT 1x + scroll mobile non limitato
     ====================== */

  const layoutKey = `${sala.nome}-${date}-${turno}`;
  const gridViewportRef = useRef<HTMLDivElement | null>(null);

    const guardedCollisionDetection: CollisionDetection = (args) => {
    const viewport = gridViewportRef.current;
    if (!viewport) return [];

    const coords = args.pointerCoordinates;
    if (!coords) return [];

    const rect = viewport.getBoundingClientRect();
    const inside =
      coords.x >= rect.left &&
      coords.x <= rect.right &&
      coords.y >= rect.top &&
      coords.y <= rect.bottom;

    // 🚫 fuori dal viewport della griglia => niente collisione, niente "isOver"
    if (!inside) return [];

    // ✅ dentro => collisione normale
    return closestCenter(args);
  };


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

  const cellSize = useMemo(() => Math.round(baseCell * zoom), [baseCell, zoom]);
  const contentScale = useMemo(() => clamp(cellSize / 40, 0.45, 1), [cellSize]);

  useEffect(() => {
    setZoom(1);
    setEditMode('NONE');
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
      if (ev.touches.length === 2) ev.preventDefault();
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

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

  useLayoutEffect(() => {
    const el = gridViewportRef.current;
    if (!el) return;
    void el.offsetHeight;
  }, [cellSize, width, height]);

  /* ======================
     ✅ DND sensors (hook-safe)
     ====================== */

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 10 },
  });

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  });

  const sensors = useSensors(isMobile ? touchSensor : pointerSensor);

  /* ======================
     Tap-to-add / Tap-to-delete
     ====================== */

  const handleCellTap = (x: number, y: number) => {
    if (!canEditTables) return;
    if (editMode !== 'ADD') return;

    const cell = gridCells.find((c) => c.x === x && c.y === y);
    if (!cell || !isCellVivibile(cell.tipoZona)) return;

    if (getTableAt(x, y)) return;

    createTables.mutate({
      nomeSala: sala.nome,
      date,
      turno,
      table: { x, y, stato: 'LIBERO' as TableStatus },
    });
  };

  const handleTableClick = (x: number, y: number) => {
    if (editMode === 'DELETE' && canEditTables) {
      setDeleteTarget({ x, y });
      return;
    }

    if (editMode !== 'NONE') return;
    setSelectedTableCoords({ x, y });
  };

  useEffect(() => {
    if (!selectedTableCoords) return;
    void refetchGroupReservations();
  }, [selectedTableCoords, refetchGroupReservations]);

  const handleRemoveGroupReservation = async (nomePrenotazione: string) => {
    if (!selectedTableCoords) return;
    setRemovingReservation(nomePrenotazione);

    try {
      await deleteGroupReservation.mutateAsync({
        nomeSala: sala.nome,
        date,
        turno,
        x: selectedTableCoords.x,
        y: selectedTableCoords.y,
        nomePrenotazione,
      });
      // aggiorno cache locale assegnazioni per riflettere subito l'unassign
      setAssignedFromBackend((prev) => {
        const next = new Map(prev);
        next.delete(nomePrenotazione);
        return next;
      });
      await refetchGroupReservations();
    } finally {
      setRemovingReservation(null);
    }
  };

  /* ======================
     DND handlers (solo prenotazioni)
     ====================== */

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditTables) return;
    if (editMode !== 'NONE') return;
    const dragData = event.active.data.current as DragData | undefined;
    if (dragData?.type === 'reservation' && assignedReservationNames.has(dragData.name)) {
      toast({
        title: 'Prenotazione già assegnata',
        description: 'Questa prenotazione è già associata a un tavolo. Rimuovila prima di spostarla.',
        variant: 'destructive',
      });
      return;
    }
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!canEditTables) return;
    if (editMode !== 'NONE') return;

    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('table-')) return;
    const dragData = active.data.current as DragData | undefined;
    if (!dragData) return;

    if (dragData.type === 'reservation' && assignedReservationNames.has(dragData.name)) {
      toast({
        title: 'Prenotazione già assegnata',
        description: 'Questa prenotazione è già associata a un tavolo. Rimuovila prima di spostarla.',
        variant: 'destructive',
      });
      return;
    }

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
      }, {
        onSuccess: () => setAssignmentsVersion((v) => v + 1),
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

  const modeLabel = editMode === 'NONE' ? 'Normale' : editMode === 'ADD' ? 'Aggiungi tavoli' : 'Elimina tavoli';

  // usa i dettagli se disponibili, altrimenti fallback al nome selezionato
  const dialogTitle = reservationDetails?.nome ?? selectedName ?? 'Prenotazione';

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={guardedCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid lg:grid-cols-[1fr,300px] gap-6">
          <Card className="glass-card min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{sala.nome}</CardTitle>
                  <CardDescription>
                    {tables?.length || 0} tavoli · {width}x{height} griglia
                    <span className="ml-2 text-xs text-muted-foreground">· zoom {zoom.toFixed(2)}x</span>
                    <span className="ml-2 text-xs text-muted-foreground">· modalità: {modeLabel}</span>
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
                  </div>

                  {!canEditTables && (
                    <span className="text-[11px] text-amber-600">
                      Configurazione non attiva: crea/attiva la configurazione per questa data e turno per posizionare i
                      tavoli.
                    </span>
                  )}
                </div>
              </div>

              {/* Toolbar modalità */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canEditTables}
                  onClick={() => setEditMode((m) => (m === 'ADD' ? 'NONE' : 'ADD'))}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    !canEditTables && 'opacity-50 cursor-not-allowed',
                    editMode === 'ADD'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-secondary border-border'
                  )}
                >
                  Aggiungi
                </button>

                <button
                  type="button"
                  disabled={!canEditTables}
                  onClick={() => setEditMode((m) => (m === 'DELETE' ? 'NONE' : 'DELETE'))}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    !canEditTables && 'opacity-50 cursor-not-allowed',
                    editMode === 'DELETE'
                      ? 'bg-destructive text-destructive-foreground border-destructive'
                      : 'bg-background hover:bg-secondary border-border'
                  )}
                >
                  Elimina
                </button>

                <button
                  type="button"
                  onClick={() => setEditMode('NONE')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    'bg-background hover:bg-secondary border-border'
                  )}
                >
                  Fine
                </button>

                {onOpenCreateTemplate && (
                  <button
                    type="button"
                    onClick={onOpenCreateTemplate}
                    disabled={!canCreateTemplate}
                    className={cn(
                      'text-sm font-medium text-primary underline-offset-2 hover:underline',
                      (!canCreateTemplate) && 'opacity-50 cursor-not-allowed text-muted-foreground'
                    )}
                  >
                    Crea template
                  </button>
                )}

                {editMode === 'ADD' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    Tocca una cella vivibile vuota per aggiungere un tavolo
                  </span>
                )}

                {editMode === 'DELETE' && (
                  <span className="text-xs text-muted-foreground ml-2">Tocca un tavolo per eliminarlo</span>
                )}

                {editMode !== 'NONE' && (
                  <span className="text-xs text-amber-600 ml-2">
                    In questa modalità il drag delle prenotazioni è disattivato
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="min-w-0 min-h-0">
              <div className="p-4 rounded-lg bg-secondary/30 w-full min-w-0 min-h-0">
                <div className="min-w-0 min-h-0">
                  <div
  key={layoutKey}
  ref={gridViewportRef}
  className="rounded-xl w-full min-w-0 overflow-auto border-2 border-border bg-background/40 shadow-sm"
  onTouchStart={handleTouchStartPinch}
  onTouchMove={handleTouchMovePinch}
  onTouchEnd={handleTouchEndPinch}
  onTouchCancel={handleTouchEndPinch}
  style={{
    WebkitOverflowScrolling: 'touch',
    touchAction: activeId ? 'none' : 'manipulation',
    height: `${viewportH}px`,
  }}
>
                    <div
  style={{
    padding: PAD,
    minHeight: `calc(${viewportH}px - ${PAD * 2}px)`,
    display: 'flex',
    justifyContent: 'flex-start', // ✅ centraggio orizzontale corretto
    alignItems: 'center',     // ✅ centraggio verticale
  }}
>

                      <div
  className="rounded-lg border-2 border-dashed border-border bg-secondary/20 p-2 shrink-0"
  style={{ display: 'inline-block', marginLeft: 'auto',
    marginRight: 'auto', }}
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
          cellSize={cellSize}
          contentScale={contentScale}
          editMode={editMode}
          canEditTables={canEditTables}
          highlightedCoords={highlightedCoords}
          onCellTap={() => handleCellTap(x, y)}
          onTableClick={() => handleTableClick(x, y)}
        />
      );
    })}
  </div>
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
                <CardTitle className="text-base">Prenotazioni da Assegnare</CardTitle>
                <CardDescription>{unassignedReservations.length} in attesa</CardDescription>
              </CardHeader>
              <CardContent>
                {unassignedReservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessuna prenotazione da assegnare</p>
                ) : (
                  <div className="space-y-2">
                    {unassignedReservations.map((r, i) => (
                      <DraggableReservation
                        key={`${r.nome}-${i}`}
                        reservation={r}
                        disabled={!canEditTables || editMode !== 'NONE'}
                        onOpenDetails={openReservationDetails}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Drag Overlay (solo icona) */}
        <DragOverlay>
          {activeId && activeId.startsWith('reservation-') && (
            <div
              style={{ pointerEvents: 'none' }}
              className="h-11 w-11 rounded-xl bg-primary text-primary-foreground shadow-lg grid place-items-center"
            >
              <Receipt className="h-5 w-5" />
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

      {/* Dialog Prenotazioni del Tavolo */}
      <Dialog open={!!selectedTableCoords} onOpenChange={(o) => (o ? null : closeGroupDialog())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Prenotazioni tavolo {selectedTableCoords ? `(${selectedTableCoords.x}, ${selectedTableCoords.y})` : ''}
            </DialogTitle>
          </DialogHeader>

          {groupReservationsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Caricamento prenotazioni...
            </div>
          )}

          {groupReservationsError && (
            <ErrorDisplay
              message="Impossibile caricare le prenotazioni del tavolo."
              onRetry={() => refetchGroupReservations()}
            />
          )}

          {!groupReservationsLoading && !groupReservationsError && (
            <div className="space-y-3">
              {groupReservations && groupReservations.length > 0 ? (
                groupReservations.map((r) => {
                  const people = typeof r.numPersone === 'number' ? `${r.numPersone} persone` : '';
                  return (
                    <div
                      key={r.nome}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/40 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.orario} {people && `· ${people}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
                        disabled={deleteGroupReservation.isPending}
                        onClick={() => handleRemoveGroupReservation(r.nome)}
                      >
                        {deleteGroupReservation.isPending && removingReservation === r.nome ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Elimina dal gruppo
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Nessuna prenotazione associata a questo gruppo.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================
          Dialog Dettagli Prenotazione
         ====================== */}
      <Dialog open={detailsOpen} onOpenChange={(o) => (o ? setDetailsOpen(true) : closeReservationDetails())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {detailsLoading && <p className="text-sm text-muted-foreground">Caricamento dettagli...</p>}

          {detailsError && (
            <p className="text-sm text-destructive">Impossibile caricare i dettagli della prenotazione.</p>
          )}

          {!detailsLoading && !detailsError && (
            <div className="space-y-3 text-sm">
              <Row label="Data" value={reservationDetails?.date ?? date} />
              <Row label="Orario" value={reservationDetails?.orario ?? '-'} />
              <Row label="Turno" value={getTurnoFromOrario(reservationDetails?.orario)} />

              <Row
                label="Persone"
                value={
                  typeof reservationDetails?.numPersone === 'number'
                    ? String(reservationDetails.numPersone)
                    : '-'
                }
              />

              <Row label="Telefono" value={reservationDetails?.numeroTelefono ?? '-'} />

              <div className="pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tavolo assegnato</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedCoords}
                    onClick={() => selectedName && highlightReservationTables(selectedName)}
                  >
                    {selectedCoords ? 'Mostra' : 'Non assegnato'}
                  </Button>
                </div>
              </div>

              <NoteBox nota={reservationDetails?.nota} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ======================
   Components
   ====================== */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function NoteBox({ nota }: { nota?: string }) {
  const text = nota?.trim();
  const hasNote = !!text;

  return (
    <div className="pt-1">
      <div className="text-muted-foreground mb-1">Note</div>
      <div className="rounded-md border border-border/40 bg-secondary/30 p-2 min-h-[44px] whitespace-pre-line">
        {hasNote ? <span>{text}</span> : <span className="text-muted-foreground">Nessuna nota</span>}
      </div>
    </div>
  );
}

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
  cellSize: number;
  contentScale: number;

  editMode: EditMode;
  canEditTables: boolean;
  highlightedCoords: { x: number; y: number }[] | null;

  onCellTap: () => void;
  onTableClick: () => void;
}

function GridCell({
  x,
  y,
  table,
  tipoZona,
  neighbors,
  cellSize,
  contentScale,
  editMode,
  canEditTables,
  highlightedCoords,
  onCellTap,
  onTableClick,
}: GridCellProps) {
  const isVivibile = tipoZona === 'SPAZIO_VIVIBILE';

  const { setNodeRef, isOver } = useDroppable({
    id: table ? `table-${x}-${y}` : `cell-${x}-${y}`,
    disabled: !table && !isVivibile,
  });

  const isHighlighted =
    !!table && !!highlightedCoords?.some((c) => c.x === table.x && c.y === table.y);

  const style: React.CSSProperties = {
    width: cellSize,
    height: cellSize,
    ...(isHighlighted
      ? {
          backgroundColor: '#22d3ee',
          borderColor: '#0ea5e9',
        }
      : {}),
  };

  const ignoreIfMultiTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e && e.touches && e.touches.length >= 2) return true;
    return false;
  };

  if (!table) {
    const canAddHere = canEditTables && editMode === 'ADD' && isVivibile;

    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={(e) => {
          if (!canAddHere) return;
          if (ignoreIfMultiTouch(e)) return;
          onCellTap();
        }}
        className={cn(
          'rounded-[4px] border transition-colors',
          isVivibile && 'grid-cell',
          !isVivibile && 'bg-[#d8c8b1] opacity-70 border-[#b8a994] cursor-not-allowed',
          isOver && isVivibile && 'grid-cell-active',
          canAddHere && 'cursor-pointer'
        )}
      />
    );
  }

  const canDeleteByTap = canEditTables && editMode === 'DELETE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={table ? `table-cell-${x}-${y}` : undefined}
      onClick={(e) => {
        if (ignoreIfMultiTouch(e)) return;
        onTableClick();
      }}
      className={cn(
        'relative p-1 flex items-center justify-center transition-all overflow-hidden',
        'border-2',
        !isHighlighted && table.stato === 'LIBERO' && 'bg-status-free/20 border-status-free',
        !isHighlighted && table.stato === 'RISERVATO' && 'bg-status-reserved/20 border-status-reserved',
        !isHighlighted && table.stato === 'OCCUPATO' && 'bg-status-occupied/20 border-status-occupied',
        isOver && 'ring-2 ring-primary ring-offset-2',
        isHighlighted && 'ring-2 ring-cyan-700 animate-[pulse_0.9s_ease-in-out_infinite]',
        neighbors?.left && 'border-l-0 rounded-l-none',
        neighbors?.right && 'border-r-0 rounded-r-none',
        neighbors?.up && 'border-t-0 rounded-t-none',
        neighbors?.down && 'border-b-0 rounded-t-none',
        canDeleteByTap && 'cursor-pointer'
      )}
    >
      <div
        className="flex flex-col items-center justify-center leading-none"
        style={{ transform: `scale(${contentScale})`, transformOrigin: 'center' }}
      >
        <Users className="h-4 w-4 mb-0.5" />
      </div>

      {table.nomePrenotazione && (
        <span className="absolute bottom-0.5 text-[10px] font-medium truncate max-w-full px-1">
          {table.nomePrenotazione}
        </span>
      )}
    </div>
  );
}

function DraggableReservation({
  reservation,
  disabled,
  onOpenDetails,
}: {
  reservation: UILayoutReservation;
  disabled?: boolean;
  onOpenDetails?: (r: UILayoutReservation) => void;
}) {
  const isAssigned = !!reservation.tavoloAssegnato;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `reservation-${reservation.nome}`,
    data: { type: 'reservation', name: reservation.nome } as DragDataReservation,
    disabled: !!disabled || isAssigned,
  });

  const people =
    typeof reservation.numPersone === 'number'
      ? reservation.numPersone
      : typeof reservation.numeroPosti === 'number'
        ? reservation.numeroPosti
        : undefined;

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        (disabled || reservation.tavoloAssegnato) && 'opacity-60'
      )}
    >
      {/* CARD: cliccabile per dettagli, NON draggable */}
      <button
        type="button"
        onClick={() => !disabled && onOpenDetails?.(reservation)}
        className={cn(
          'flex-1 min-w-0 flex items-center gap-3 p-3 rounded-lg text-left',
          'bg-secondary/50 border border-border/40',
          'transition-colors',
          !disabled && !isAssigned ? 'hover:bg-secondary/70 cursor-pointer' : 'cursor-not-allowed',
          isAssigned && 'border-emerald-300 bg-emerald-50 text-emerald-800',
          isDragging && 'opacity-60'
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{reservation.nome}</p>
          <p className="text-xs text-muted-foreground">
            {reservation.orario} · {typeof people === 'number' ? `${people} persone` : 'persone: -'}
          </p>
        </div>

        {isAssigned && (
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
            Assegnato
          </span>
        )}
      </button>

      {/* ✅ DRAG BUTTON separato */}
      <button
        ref={setNodeRef}
        type="button"
        aria-label="Trascina prenotazione sul tavolo"
        disabled={!!disabled || isAssigned}
        {...(!disabled && !isAssigned ? listeners : {})}
        {...(!disabled && !isAssigned ? attributes : {})}
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        className={cn(
          'shrink-0 h-11 w-11 rounded-xl grid place-items-center',
          'border border-border/40 bg-background/70 shadow-sm',
          disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-background',
          'transition'
        )}
      >
        <Receipt className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}
