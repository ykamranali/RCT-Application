'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Technical details stay in the server logs;
 * the customer sees a message they can act on and a digest to quote.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[rct] unhandled route error', error);
  }, [error]);

  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The page could not be loaded. Please try again — if it keeps happening, contact the
            service desk.
          </p>
          {error.digest ? (
            <p className="pt-1 text-2xs text-muted-foreground">Reference: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <a href="/">Go to dashboard</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
