import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Turno } from '@/types';

interface TurnoSelectorProps {
  value: Turno;
  onChange: (turno: Turno) => void;
  className?: string;
}

export function TurnoSelector({ value, onChange, className }: TurnoSelectorProps) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Button
        variant={value === 'PRANZO' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('PRANZO')}
        className={cn(
          'flex-1',
          value === 'PRANZO' && 'bg-primary text-primary-foreground'
        )}
      >
        Pranzo
      </Button>
      <Button
        variant={value === 'CENA' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('CENA')}
        className={cn(
          'flex-1',
          value === 'CENA' && 'bg-primary text-primary-foreground'
        )}
      >
        Cena
      </Button>
    </div>
  );
}
