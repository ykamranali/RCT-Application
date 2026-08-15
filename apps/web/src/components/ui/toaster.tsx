'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

/** Toast host. Mounted once in the root layout. */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={(theme as 'light' | 'dark' | 'system') ?? 'system'}
      position="top-right"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast: 'group border-border bg-card text-card-foreground shadow-float',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
