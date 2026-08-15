import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">You are offline</h1>
          <p className="text-sm text-muted-foreground">
            RCT Application needs a connection to show live ticket data. Anything you were part way
            through has not been lost — reconnect and try again.
          </p>
        </div>
      </div>
    </main>
  );
}
