import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ 
  title = 'Si è verificato un errore', 
  message = 'Qualcosa è andato storto. Riprova più tardi.',
  onRetry,
  className 
}: ErrorDisplayProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 text-center',
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Riprova
        </Button>
      )}
    </div>
  );
}
