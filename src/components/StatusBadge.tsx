import { cn } from '@/lib/utils';
import type { TableStatus } from '@/types';

interface StatusBadgeProps {
  status: TableStatus;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<TableStatus, { label: string; className: string }> = {
  LIBERO:   { label: 'Libero',    className: 'status-free' },
  RISERVATO:{ label: 'Prenotato', className: 'status-reserved' },
  OCCUPATO: { label: 'Occupato',  className: 'status-occupied' },
};

export function StatusBadge({ status, className, showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {showLabel ? config.label : null}
    </span>
  );
}

export function StatusDot({ status, className }: { status: TableStatus; className?: string }) {
  return (
    <span
      className={cn(
        'w-2.5 h-2.5 rounded-full',
        statusConfig[status].className,
        className
      )}
    />
  );
}
