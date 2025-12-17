import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/DatePicker';

import { useCreateReservation } from '@/hooks/use-reservations';
import { useSalas } from '@/hooks/use-sala';
import { useWorkingDays } from '@/hooks/use-working-days';
import { formatDateForApi, parseDateFromApi } from '@/lib/date-utils';

import type { CreateReservationDto } from '@/types';
import type { WorkingDay, WorkingDayType } from '@/types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, '');
}

function toIntOrNull(s: string): number | null {
  const cleaned = onlyDigits(s);
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function getDayTypeFromDate(date: Date): WorkingDayType {
  const day = date.getDay();
  if (day === 0) return 'SUNDAY';
  if (day === 6) return 'SATURDAY';
  return 'WEEKDAY';
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildSlotsFromWindow(start?: string, end?: string): string[] {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes == null || endMinutes == null || startMinutes > endMinutes) return [];

  const slots: string[] = [];
  for (let current = startMinutes; current <= endMinutes; current += 15) {
    slots.push(formatMinutes(current));
  }
  return slots;
}

function normalizeApiDate(dateString?: string): string | null {
  if (!dateString) return null;
  try {
    const parsed = parseDateFromApi(dateString);
    return formatDateForApi(parsed);
  } catch {
    return null;
  }
}

function getSpecialDay(workingDays: WorkingDay[] | undefined, date: Date): WorkingDay | null {
  if (!Array.isArray(workingDays)) return null;
  const dateStr = formatDateForApi(date);
  return (
    workingDays.find((d) => {
      if (d.type !== 'SPECIAL') return false;
      const normalized = normalizeApiDate(d.data);
      return normalized === dateStr;
    }) ?? null
  );
}

function getTemplateDay(workingDays: WorkingDay[] | undefined, date: Date): WorkingDay | null {
  if (!Array.isArray(workingDays)) return null;
  const type = getDayTypeFromDate(date);
  return workingDays.find((d) => d.type === type) ?? null;
}

function buildSlotsForDay(day: WorkingDay | null): string[] {
  if (!day) return [];
  const slots: string[] = [];

  // backend: g1/g2 = true -> chiuso, false -> aperto
  const lunchOpen = !day.g1;
  const dinnerOpen = !day.g2;

  if (lunchOpen && day.a1 && day.c1) {
    slots.push(...buildSlotsFromWindow(day.a1, day.c1));
  }
  if (dinnerOpen && day.a2 && day.c2) {
    slots.push(...buildSlotsFromWindow(day.a2, day.c2));
  }

  return slots;
}

export default function NewReservation() {
  const navigate = useNavigate();
  const createReservation = useCreateReservation();
  const { data: salas } = useSalas();
  const {
    data: workingDays,
    isLoading: isLoadingWorkingDays,
    error: workingDaysError,
  } = useWorkingDays();
  const workingDaysList = useMemo(() => (Array.isArray(workingDays) ? workingDays : []), [workingDays]);

  // ✅ numeroPosti come stringa (mobile friendly)
  const [formData, setFormData] = useState({
    nome: '',
    numeroPosti: '2',
    data: new Date(),
    orario: '',
    telefono: '',
    nota: '',
    nomeSala: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const numeroPostiNumber = useMemo(() => toIntOrNull(formData.numeroPosti), [formData.numeroPosti]);

  // Risolvi il giorno da usare: prima SPECIAL, altrimenti template per weekday/sabato/domenica.
  const specialDay = useMemo(
    () => getSpecialDay(workingDaysList, formData.data),
    [workingDaysList, formData.data],
  );
  const templateDay = useMemo(
    () => getTemplateDay(workingDaysList, formData.data),
    [workingDaysList, formData.data],
  );
  const dayConfig = specialDay ?? templateDay ?? null;

  const availableSlots = useMemo(() => buildSlotsForDay(dayConfig), [dayConfig]);

  const missingTimeConfig = useMemo(() => {
    if (!dayConfig) return false;
    const lunchOpen = !dayConfig.g1;
    const dinnerOpen = !dayConfig.g2;
    const missingLunch = lunchOpen && (!dayConfig.a1 || !dayConfig.c1);
    const missingDinner = dinnerOpen && (!dayConfig.a2 || !dayConfig.c2);
    return missingLunch || missingDinner;
  }, [dayConfig]);

  useEffect(() => {
    if (availableSlots.length === 0) {
      setFormData((prev) => (prev.orario ? { ...prev, orario: '' } : prev));
      return;
    }

    if (!availableSlots.includes(formData.orario)) {
      setFormData((prev) => ({ ...prev, orario: availableSlots[0] }));
    }
  }, [availableSlots, formData.orario]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Il nome è obbligatorio';
    }

    const n = numeroPostiNumber;
    if (n == null) {
      newErrors.numeroPosti = 'Inserisci il numero di persone';
    } else if (n < 1) {
      newErrors.numeroPosti = 'Almeno 1 persona';
    } else if (n > 50) {
      newErrors.numeroPosti = 'Massimo 50 persone';
    }

    if (!formData.data) {
      newErrors.data = 'La data è obbligatoria';
    }

    if (availableSlots.length === 0) {
      newErrors.orario = missingTimeConfig
        ? 'Orari non configurati per questa data: completa apertura/chiusura in Giorni Lavorativi.'
        : 'Nessun orario disponibile per la data scelta';
    } else if (!formData.orario.trim()) {
      newErrors.orario = "L'orario è obbligatorio";
    } else if (!availableSlots.includes(formData.orario)) {
      newErrors.orario = 'Seleziona un orario disponibile';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const n = numeroPostiNumber ?? 1;
    const noteValue = formData.nota.trim();

    const dto: CreateReservationDto = {
      nome: formData.nome.trim(),
      numPersone: n,
      date: formatDateForApi(formData.data), // yyyy-MM-dd
      orario: formData.orario,               // HH:mm
      numeroTelefono: formData.telefono.trim() || undefined,
      nota: noteValue || undefined,
    };

    try {
      await createReservation.mutateAsync(dto);
      navigate('/reservations');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* header identico */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuova Prenotazione</h1>
          <p className="text-muted-foreground">Aggiungi una nuova prenotazione</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Dettagli Prenotazione</CardTitle>
          <CardDescription>Inserisci i dati del cliente e della prenotazione</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Cliente *</Label>
              <Input
                id="nome"
                placeholder="Mario Rossi"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={errors.nome ? 'border-destructive' : ''}
              />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
            </div>

            {/* Numero Persone */}
            <div className="space-y-2">
              <Label htmlFor="numeroPosti">Numero Persone *</Label>

              <Input
                id="numeroPosti"
                // ✅ stringa + tastierino numerico su mobile
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="2"
                value={formData.numeroPosti}
                onChange={(e) => {
                  const raw = e.target.value;

                  // ✅ lascia vuoto se l'utente cancella tutto
                  if (raw === '') {
                    setFormData({ ...formData, numeroPosti: '' });
                    return;
                  }

                  // ✅ tieni solo cifre (evita virgole, punti, ecc)
                  const cleaned = onlyDigits(raw);
                  setFormData({ ...formData, numeroPosti: cleaned });
                }}
                onBlur={() => {
                  // ✅ normalizza su blur: se vuoto torna "1", se 0002 -> "2"
                  const n = toIntOrNull(formData.numeroPosti);
                  if (n == null) {
                    setFormData((p) => ({ ...p, numeroPosti: '1' }));
                  } else {
                    const clamped = Math.min(50, Math.max(1, n));
                    setFormData((p) => ({ ...p, numeroPosti: String(clamped) }));
                  }
                }}
                className={errors.numeroPosti ? 'border-destructive' : ''}
              />

              {errors.numeroPosti && <p className="text-sm text-destructive">{errors.numeroPosti}</p>}
            </div>

            {/* Data + Orario */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <DatePicker
                  date={formData.data}
                  onDateChange={(d) => d && setFormData({ ...formData, data: d })}
                  className="w-full"
                />
                {errors.data && <p className="text-sm text-destructive">{errors.data}</p>}
              </div>

              <div className="space-y-2">
                <Label>Orario *</Label>
                <Select
                  value={formData.orario}
                  onValueChange={(value) => setFormData({ ...formData, orario: value })}
                  disabled={isLoadingWorkingDays || availableSlots.length === 0 || !!workingDaysError}
                >
                  <SelectTrigger className={errors.orario ? 'border-destructive' : ''}>
                    <SelectValue
                      placeholder={
                        isLoadingWorkingDays
                          ? 'Caricamento...'
                          : workingDaysError
                            ? 'Errore caricamento orari'
                            : 'Seleziona un orario'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {missingTimeConfig && !isLoadingWorkingDays && !workingDaysError && (
                  <p className="text-sm text-destructive">
                    Orari non configurati per questa data: imposta apertura/chiusura in Giorni Lavorativi.
                  </p>
                )}
                {!missingTimeConfig && availableSlots.length === 0 && !isLoadingWorkingDays && !workingDaysError && (
                  <p className="text-sm text-muted-foreground">
                    Nessun orario disponibile per questa data.
                  </p>
                )}
                {workingDaysError && (
                  <p className="text-sm text-destructive">
                    Impossibile caricare gli orari lavorativi.
                  </p>
                )}
                {errors.orario && <p className="text-sm text-destructive">{errors.orario}</p>}
              </div>
            </div>

            {/* Telefono */}
            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="+39 333 1234567"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>

            {/* Sala preferita - solo UI */}
            {salas && salas.length > 0 && (
              <div className="space-y-2">
                <Label>Sala Preferita</Label>
                <Select
                  value={formData.nomeSala}
                  onValueChange={(value) => setFormData({ ...formData, nomeSala: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una sala (opzionale)" />
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
            )}

            {/* Note - solo UI */}
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Allergie, preferenze, occasioni speciali..."
                value={formData.nota}
                onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Annulla
              </Button>

              <Button type="submit" disabled={createReservation.isPending} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {createReservation.isPending ? 'Salvataggio...' : 'Salva Prenotazione'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
