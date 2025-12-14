import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Modifier,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { Trash2 } from 'lucide-react';

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

function getClientPoint(ev: Event): { x: number; y: number } | null {
  if (typeof TouchEvent !== 'undefined' && ev instanceof TouchEvent) {
    const t = ev.changedTouches.item(0) ?? ev.touches.item(0);
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  if (typeof PointerEvent !== 'undefined' && ev instanceof PointerEvent) {
    return { x: ev.clientX, y: ev.clientY };
  }
  if (ev instanceof MouseEvent) {
    return { x: ev.clientX, y: ev.clientY };
  }
  return null;
}

function isTouchActivatorEvent(ev: Event): boolean {
  if (typeof TouchEvent !== 'undefined' && ev instanceof TouchEvent) return true;
  if (typeof PointerEvent !== 'undefined' && ev instanceof PointerEvent) return ev.pointerType === 'touch';
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * ✅ iOS Safari fix: quando cambia la visualViewport (barre Safari),
 * l’overlay può risultare “spostato”. Questo modifier compensa.
 */
const visualViewportOffsetModifier: Modifier = ({ transform }) => {
  if (typeof window === 'undefined') return transform;
  const vv = window.visualViewport;
  if (!vv) return transform;

  return {
    ...transform,
    x: transform.x + vv.offsetLeft,
    y: transform.y + vv.offsetTop,
  };
};

const IOS_NUDGE = { x: 0, y: -14 }; // prova -10 / -12 / -16

const manualNudgeModifier: Modifier = ({ transform }) => {
  if (!isIOS()) return transform;
  return { ...transform, x: transform.x + IOS_NUDGE.x, y: transform.y + IOS_NUDGE.y };
};



/* ========================
   MAIN
   ======================== */

export function EditZonesDialog({ sala, open, onOpenChange }: EditZonesDialogProps) {
  const updateZones = useUpdateZones();

  // container scrollabile (mobile)
  const dialogScrollRef = useRef<HTMLDivElement | null>(null);
  // overlay DOM reale (mobile)
  const dragOverlayRef = useRef<HTMLDivElement | null>(null);

  const [zones, setZones] = useState<ZonaSala[]>(sala.zone || []);
  const [activeDrag, setActiveDrag] = useState<NewZoneConfig | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  // true SOLO se il drag corrente è partito da touch
  const [isTouchDrag, setIsTouchDrag] = useState(false);

  const initialGrid = useMemo(() => computeGridFromZones(sala.zone || []), [sala.zone]);
  const [gridWidth, setGridWidth] = useState<number>(initialGrid.w);
  const [gridHeight, setGridHeight] = useState<number>(initialGrid.h);

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
    setIsTouchDrag(false);
  }, [open, sala.nome, sala.zone]);

  /* ---------- dnd-kit ---------- */

  // hooks sempre chiamati (no useSensor condizionali)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const resetDragState = () => {
    setActiveDrag(null);
    setHoverCell(null);
    setIsTouchDrag(false);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (data?.type !== 'new-zone') return;

    setActiveDrag(data.zone);

    const touch = isTouchActivatorEvent(e.activatorEvent);
    setIsTouchDrag(touch);
  };

  const handleDragOver = (e: DragOverEvent) => {
    if (!e.over) {
      setHoverCell(null);
      return;
    }

    const id = String(e.over.id);
    if (!id.startsWith('cell-')) {
      setHoverCell(null);
      return;
    }

    const [, x, y] = id.split('-');
    setHoverCell({ x: Number(x), y: Number(y) });
  };

  /**
   * ✅ Autoscroll SOLO durante touch-drag
   * e basato sull’overlay (DOM reale) -> segue davvero l’immagine arancione
   */
  const handleDragMove = (_e: DragMoveEvent) => {
    if (!isTouchDrag) return;

    const container = dialogScrollRef.current;
    const overlayEl = dragOverlayRef.current;
    if (!container || !overlayEl) return;

    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();

    const EDGE = 80;
    const MAX_SPEED = 20;

    const distTop = overlayRect.top - containerRect.top;
    const distBottom = containerRect.bottom - overlayRect.bottom;

    let delta = 0;

    if (distTop < EDGE) {
      const t = (EDGE - distTop) / EDGE;
      delta = -Math.ceil(t * MAX_SPEED);
    } else if (distBottom < EDGE) {
      const t = (EDGE - distBottom) / EDGE;
      delta = Math.ceil(t * MAX_SPEED);
    }

    if (delta !== 0) container.scrollTop += delta;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;

    resetDragState();
    if (!e.over) return;
    if (!data || data.type !== 'new-zone') return;

    const overId = String(e.over.id);
    if (!overId.startsWith('cell-')) return;

    const [, xStr, yStr] = overId.split('-');
    const x = Number(xStr);
    const y = Number(yStr);

    const { base, altezza, tipo } = data.zone;

    if (x + base > gridWidth || y + altezza > gridHeight) return;

    setZones((prev) => [...prev, { x, y, base, altezza, tipo }]);
  };

  /* ---------- actions ---------- */

  const handleRemoveZone = (index: number) => {
    setZones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await updateZones.mutateAsync({
      nomeSala: sala.nome,
      zones,
    });
    onOpenChange(false);
  };

  /* ---------- grid ---------- */

  const gridCells = useMemo(() => {
    const res: { x: number; y: number; tipoZona: TipoZona | null }[] = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        res.push({ x, y, tipoZona: getCellTipoZona(zones, x, y) });
      }
    }
    return res;
  }, [zones, gridWidth, gridHeight]);

  // modifiers overlay: touch only
  const overlayModifiers = useMemo(() => {
  if (!isTouchDrag) return undefined;

  if (isIOS()) return [snapCenterToCursor, visualViewportOffsetModifier, manualNudgeModifier];
  return [snapCenterToCursor];
}, [isTouchDrag]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogScrollRef}
        className={cn(
          'max-w-4xl',
          // mobile: scrollabile
          'max-h-[85dvh] overflow-y-auto touch-pan-y overscroll-y-contain',
          // desktop: “come prima”
          'md:max-h-none md:overflow-visible md:touch-auto'
        )}
      >
        <DialogHeader>
          <DialogTitle>Zone di {sala.nome}</DialogTitle>
          <DialogDescription>Trascina il rettangolo sulla griglia per creare le zone.</DialogDescription>
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
          // ✅ niente autoscroll interno dnd-kit quando è touch (evita conflitti)
          autoScroll={isTouchDrag ? false : undefined}
        >
          <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
            {/* GRID */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Griglia sala</p>
                  <p className="text-xs text-muted-foreground">
                    {gridWidth} × {gridHeight} celle
                  </p>
                </div>

                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Larghezza</Label>
                    <Input
                      type="number"
                      min={3}
                      max={30}
                      className="h-8 w-20"
                      value={gridWidth}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const clamped = Math.max(3, Math.min(30, Number.isFinite(v) ? v : 3));
                        setGridWidth(clamped);
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Altezza</Label>
                    <Input
                      type="number"
                      min={3}
                      max={30}
                      className="h-8 w-20"
                      value={gridHeight}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const clamped = Math.max(3, Math.min(30, Number.isFinite(v) ? v : 3));
                        setGridHeight(clamped);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridWidth}, 1fr)` }}>
                {gridCells.map((c) => (
                  <ZoneCell
                    key={`${c.x}-${c.y}`}
                    x={c.x}
                    y={c.y}
                    tipoZona={c.tipoZona}
                    ghost={activeDrag && hoverCell ? { ...activeDrag, anchor: hoverCell } : null}
                    gridWidth={gridWidth}
                    gridHeight={gridHeight}
                  />
                ))}
              </div>
            </Card>

            {/* SIDEBAR */}
            <div className="space-y-4">
              <Card className="p-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Nuova zona</Label>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={newZoneConfig.tipo}
                      onChange={(e) => setNewZoneConfig((prev) => ({ ...prev, tipo: e.target.value as TipoZona }))}
                    >
                      <option value="SPAZIO_VIVIBILE">Spazio vivibile</option>
                      <option value="SPAZIO_NON_VIVIBILE">Spazio non vivibile</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Dimensioni (base × altezza)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={gridWidth}
                        value={newZoneConfig.base}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const next = Math.max(1, Math.min(gridWidth, Number.isFinite(v) ? v : 1));
                          setNewZoneConfig((prev) => ({ ...prev, base: next }));
                        }}
                      />
                      <Input
                        type="number"
                        min={1}
                        max={gridHeight}
                        value={newZoneConfig.altezza}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const next = Math.max(1, Math.min(gridHeight, Number.isFinite(v) ? v : 1));
                          setNewZoneConfig((prev) => ({ ...prev, altezza: next }));
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-1">
                  <ZonePaletteItem zone={newZoneConfig} hideWhileTouchDragging={isTouchDrag} />
                </div>

                <p className="text-xs text-muted-foreground">Trascina il rettangolo sulla griglia per posizionare la zona.</p>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-medium mb-3">Zone create</p>

                {zones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessuna zona creata.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {zones.map((z, index) => (
                      <div
                        key={`${z.tipo}-${z.x}-${z.y}-${z.base}-${z.altezza}-${index}`}
                        className="flex items-center justify-between p-2 rounded-md bg-secondary/40 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{z.tipo === 'SPAZIO_VIVIBILE' ? 'Vivibile' : 'Non vivibile'}</span>
                          <span className="text-muted-foreground">
                            Posizione ({z.x}, {z.y}) · {z.base}×{z.altezza}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveZone(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* ✅ Overlay SOLO quando il drag è touch (desktop identico: nessun overlay) */}
          {isTouchDrag ? (
            <DragOverlay dropAnimation={null} modifiers={overlayModifiers}>
              {activeDrag ? (
                <div ref={dragOverlayRef} style={{ touchAction: 'none' }}>
                  <ZoneRectPreview {...activeDrag} />
                </div>
              ) : null}
            </DragOverlay>
          ) : null}
        </DndContext>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={updateZones.isPending}>
            {updateZones.isPending ? 'Salvataggio…' : 'Salva Zone'}
          </Button>
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

  const isVivibile = tipoZona === 'SPAZIO_VIVIBILE';
  const isNonVivibile = tipoZona === 'SPAZIO_NON_VIVIBILE';

  let ghostClass = '';
  if (ghost) {
    const valid = ghost.anchor.x + ghost.base <= gridWidth && ghost.anchor.y + ghost.altezza <= gridHeight;

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
        isVivibile && 'bg-emerald-200',
        isNonVivibile && 'bg-slate-400',
        !isVivibile && !isNonVivibile && 'bg-background',
        ghostClass,
        isOver && 'ring-2 ring-primary ring-offset-1'
      )}
    />
  );
}

function ZonePaletteItem({
  zone,
  hideWhileTouchDragging,
}: {
  zone: NewZoneConfig;
  hideWhileTouchDragging: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({
    id: 'new-zone',
    data: { type: 'new-zone', zone } satisfies DragData,
  });

  // ✅ DESKTOP: come prima (si muove l’elemento con transform)
  // ✅ TOUCH: se sto usando overlay, NON muovo l’originale e lo nascondo -> niente doppio blocco
  const shouldHideOriginal = hideWhileTouchDragging && isDragging;

  const style: React.CSSProperties | undefined = shouldHideOriginal
    ? { touchAction: 'none', userSelect: 'none' }
    : transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          touchAction: 'none',
          userSelect: 'none',
        }
      : { touchAction: 'none', userSelect: 'none' };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        'select-none cursor-grab',
        isDragging && !shouldHideOriginal && 'opacity-60 cursor-grabbing z-50',
        shouldHideOriginal && 'opacity-0 pointer-events-none'
      )}
    >
      <ZoneRectPreview {...zone} />
    </div>
  );
}

function ZoneRectPreview({ base, altezza, tipo }: NewZoneConfig) {
  const max = Math.max(base, altezza, 1);
  const size = 80;

  return (
    <div className="h-[96px] w-[96px] flex items-center justify-center bg-muted rounded-xl">
      <div
        className={cn('rounded-md', tipo === 'SPAZIO_VIVIBILE' ? 'bg-amber-500' : 'bg-slate-600')}
        style={{
          width: (base / max) * size,
          height: (altezza / max) * size,
        }}
      />
    </div>
  );
}
