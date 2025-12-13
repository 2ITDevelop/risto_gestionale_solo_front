import { useState } from 'react';
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
import { formatDateForApi } from '@/lib/date-utils';
import type { CreateReservationDto } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function NewReservation() {
  const navigate = useNavigate();
  const createReservation = useCreateReservation();
  const { data: salas } = useSalas();
  
  const [formData, setFormData] = useState({
    nome: '',
    numeroPosti: 2,
    data: new Date(),
    orario: '',
    telefono: '',
    note: '',
    nomeSala: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.nome.trim()) {
      newErrors.nome = 'Il nome è obbligatorio';
    }
    
    if (formData.numeroPosti < 1) {
      newErrors.numeroPosti = 'Almeno 1 persona';
    }
    
    if (!formData.data) {
      newErrors.data = 'La data è obbligatoria';
    }

    if (!formData.orario.trim()) {
      newErrors.orario = "L'orario è obbligatorio";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    const dto: CreateReservationDto = {
      nome: formData.nome.trim(),
      numPersone: formData.numeroPosti,
      date: formatDateForApi(formData.data),      // yyyy-MM-dd
      orario: formData.orario,                    // HH:mm
      numeroTelefono: formData.telefono.trim() || undefined,
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
          <CardDescription>
            Inserisci i dati del cliente e della prenotazione
          </CardDescription>
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
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome}</p>
              )}
            </div>

            {/* Numero Persone */}
            <div className="space-y-2">
              <Label htmlFor="numeroPosti">Numero Persone *</Label>
              <Input
                id="numeroPosti"
                type="number"
                min={1}
                max={50}
                value={formData.numeroPosti}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    numeroPosti: parseInt(e.target.value) || 1,
                  })
                }
                className={errors.numeroPosti ? 'border-destructive' : ''}
              />
              {errors.numeroPosti && (
                <p className="text-sm text-destructive">{errors.numeroPosti}</p>
              )}
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
                {errors.data && (
                  <p className="text-sm text-destructive">{errors.data}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Orario *</Label>
                <Input
                  type="time"
                  value={formData.orario}
                  onChange={(e) => setFormData({ ...formData, orario: e.target.value })}
                  className={errors.orario ? 'border-destructive' : ''}
                />
                {errors.orario && (
                  <p className="text-sm text-destructive">{errors.orario}</p>
                )}
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
                  onValueChange={(value) =>
                    setFormData({ ...formData, nomeSala: value })
                  }
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
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={createReservation.isPending}
                className="flex-1"
              >
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
