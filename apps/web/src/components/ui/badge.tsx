import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/25',
        neutral: 'bg-muted text-muted-foreground ring-border',
        success: 'bg-success-soft text-success ring-success/25',
        warning: 'bg-warning-soft text-warning ring-warning/25',
        danger: 'bg-danger-soft text-danger ring-danger/25',
        info: 'bg-info-soft text-info ring-info/25',
        outline: 'bg-transparent text-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
