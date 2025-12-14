import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { GripVertical, Trash2 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

import { useUpdateZones } from '@/hooks/use-sala';
import type { Sala, ZonaSala, TipoZona } from '@/types';
import { cn } from '@/lib/utils';

/* ========================
   TIPI
   ======================== */

type NewZoneConfig = Omit<ZonaSala, 'x' | 'y'>;

type DragData = {
  type: 'new-zone';
  zone: NewZoneConfig;
};

interface EditZonesDialogProps {
  sala: Sala;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ========================
   HELPERS
   ======================== */

function computeGridFromZones(zones: ZonaSala[]): { w: number; h: number } {
  if (!zones || zones.length === 0) return { w: 8, h: 6 };
  const w = Math.max(...zones.map((z) => z.x + z.base), 8);
  const h = Math.max(...zones.map((z) => z.y + z.altezza), 6);
  return { w, h };
}

function getCellTipoZona(zones: ZonaSala[], x: number, y: number): TipoZona | null {
  let foundVivibile = false;

  for (const z of zones) {
    const inside = x >= z.x && x < z.x + z.base && y >= z.y && y < z.y + z.altezza;
    if (!inside) continue;

    if (z.tipo === 'SPAZIO_NON_VIVIBILE') return 'SPAZIO_NON_VIVIBILE';
    if (z.tipo === 'SPAZIO_VIVIBILE') foundVivibile = true;
  }

  return foundVivibile ? 'SPAZIO_VIVIBILE' : null;
}

/* ========================
   MAIN
   ======================== */

export function EditZonesDialog({ sala, open, onOpenChange }: EditZonesDialogProps) {
  const updateZones = useUpdateZones();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [zones, setZones] = useState<ZonaSala[]>(sala.zone || []);
  const [activeDrag, setActiveDrag] = useState<NewZoneConfig | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  const initialGrid = useMemo(() => computeGridFromZones(sala.zone || []), [sala.zone]);
  const [gridWidth, setGridWidth] = useState(initialGrid.w);
  const [gridHeight, setGridHeight] = useState(initialGrid.h);

  const [newZoneConfig, setNewZoneConfig] = useState<NewZoneConfig>({
    base: 2,
    altezza: 2,
    tipo: 'SPAZIO_VIVIBILE',
  });

  useEffect(() => {
    if (!open) return;

    const nextZones = sala.zone || [];
    setZones(nextZones);

    const g = computeGridFromZones(nextZones);
    setGridWidth(g.w);
    setGridHeight(g.h);

    setActiveDrag(null);
    setHoverCell(null);
  }, [open, sala.nome, sala.zone]);

  /* ---------- dnd-kit ---------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } })
  );

  const resetDragState = () => {
    setActiveDrag(null);
    setHoverCell(null);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (data?.type === 'new-zone') setActiveDrag(data.zone);
  };

  const handleDragOver = (e: DragOverEvent) => {
    if (!e.over) return setHoverCell(null);

    const id = String(e.over.id);
    if (!id.startsWith('cell-')) return setHoverCell(null);

    const [, x, y] = id.split('-');
    setHoverCell({ x: Number(x), y: Number(y) });
  };

  /**
   * 🔥 AUTO-SCROLL MANUALE DURANTE DRAG
   */
  const handleDragMove = (e: DragMoveEvent) => {
    const container = scrollRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    let clientY: number | undefined;

    if (e.activatorEvent instanceof TouchEvent) {
      clientY = e.activatorEvent.touches[0]?.clientY;
    } else if (e.activatorEvent instanceof PointerEvent) {
      clientY = e.activatorEvent.clientY;
    }

    if (typeof clientY !== 'number') return;

    const EDGE = 70;
    const MAX_SPEED = 18;

    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;

    let delta = 0;

    if (distTop < EDGE) {
      delta = -Math.ceil(((EDGE - distTop) / EDGE) * MAX_SPEED);
    } else if (distBottom < EDGE) {
      delta = Math.ceil(((EDGE - distBottom) / EDGE) * MAX_SPEED);
    }

    if (delta !== 0) {
      container.scrollTop += delta;
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;
    resetDragState();

    if (!e.over || !data || data.type !== 'new-zone') return;

    const id = String(e.over.id);
    if (!id.startsWith('cell-')) return;

    const [, xStr, yStr] = id.split('-');
    const x = Number(xStr);
    const y = Number(yStr);

    const { base, altezza, tipo } = data.zone;

    if (x + base > gridWidth || y + altezza > gridHeight) return;

    setZones((prev) => [...prev, { x, y, base, altezza, tipo }]);
  };

  const handleSave = async () => {
    await updateZones.mutateAsync({
      nomeSala: sala.nome,
      zones,
    });
    onOpenChange(false);
  };

  const gridCells = useMemo(() => {
    const res: { x: number; y: number; tipoZona: TipoZona | null }[] = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        res.push({ x, y, tipoZona: getCellTipoZona(zones, x, y) });
      }
    }
    return res;
  }, [zones, gridWidth, gridHeight]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={scrollRef}
        className="max-w-4xl max-h-[85dvh] overflow-y-auto touch-pan-y overscroll-y-contain"
      >
        <DialogHeader>
          <DialogTitle>Zone di {sala.nome}</DialogTitle>
          <DialogDescription>Trascina dal grip per creare le zone.</DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={resetDragState}
          autoScroll={false}
        >
          <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
            <Card className="p-4">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${gridWidth}, 1fr)` }}
              >
                {gridCells.map((c) => (
                  <ZoneCell
                    key={`${c.x}-${c.y}`}
                    {...c}
                    ghost={activeDrag && hoverCell ? { ...activeDrag, anchor: hoverCell } : null}
                    gridWidth={gridWidth}
                    gridHeight={gridHeight}
                  />
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <ZonePaletteItem zone={newZoneConfig} />
            </Card>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag && <ZoneRectPreview {...activeDrag} />}
          </DragOverlay>
        </DndContext>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave}>Salva Zone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================
   COMPONENTS
   ======================== */

function ZoneCell(props: {
  x: number;
  y: number;
  tipoZona: TipoZona | null;
  ghost: (NewZoneConfig & { anchor: { x: number; y: number } }) | null;
  gridWidth: number;
  gridHeight: number;
}) {
  const { x, y, tipoZona, ghost, gridWidth, gridHeight } = props;
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${x}-${y}` });

  let ghostClass = '';
  if (ghost) {
    const valid =
      ghost.anchor.x + ghost.base <= gridWidth &&
      ghost.anchor.y + ghost.altezza <= gridHeight;

    const inGhost =
      x >= ghost.anchor.x &&
      x < ghost.anchor.x + ghost.base &&
      y >= ghost.anchor.y &&
      y < ghost.anchor.y + ghost.altezza;

    if (inGhost) ghostClass = valid ? 'bg-primary/20' : 'bg-destructive/30';
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'aspect-square border rounded-sm',
        tipoZona === 'SPAZIO_VIVIBILE' && 'bg-emerald-200',
        tipoZona === 'SPAZIO_NON_VIVIBILE' && 'bg-slate-400',
        ghostClass,
        isOver && 'ring-2 ring-primary'
      )}
    />
  );
}

function ZonePaletteItem({ zone }: { zone: NewZoneConfig }) {
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: 'new-zone',
    data: { type: 'new-zone', zone } satisfies DragData,
  });

  return (
    <div ref={setNodeRef} className="p-2 rounded-xl bg-muted w-[120px]">
      <button
        {...attributes}
        {...listeners}
        className="h-8 w-8 rounded-md border bg-background cursor-grab touch-none"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="mt-2 flex justify-center">
        <ZoneRectPreview {...zone} />
      </div>
    </div>
  );
}

function ZoneRectPreview({ base, altezza, tipo }: NewZoneConfig) {
  const max = Math.max(base, altezza, 1);
  const size = 80;

  return (
    <div className="h-[96px] w-[96px] flex items-center justify-center rounded-xl border">
      <div
        className={cn(tipo === 'SPAZIO_VIVIBILE' ? 'bg-amber-500' : 'bg-slate-600')}
        style={{
          width: (base / max) * size,
          height: (altezza / max) * size,
        }}
      />
    </div>
  );
}
