import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="h-6 w-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            That page does not exist, or you no longer have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to your dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
