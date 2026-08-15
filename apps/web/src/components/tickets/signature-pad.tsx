'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSignature } from '@/lib/actions/tickets';

/**
 * Signature capture.
 *
 * Uses Pointer Events so a mouse, a finger and a stylus all take the same
 * code path. The canvas is sized to its CSS box multiplied by the device
 * pixel ratio, otherwise the stroke looks soft on a phone.
 */
export function SignaturePad({
  ticketId,
  defaultSignerName,
  onSaved,
}: {
  ticketId: string;
  defaultSignerName?: string | null;
  onSaved?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [signerName, setSignerName] = useState(defaultSignerName ?? '');
  const [signerTitle, setSignerTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const prepare = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  useEffect(() => {
    prepare();
    window.addEventListener('resize', prepare);
    return () => window.removeEventListener('resize', prepare);
  }, [prepare]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      setEmpty(false);
    }
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
  }

  async function save() {
    if (empty) {
      toast.error('Please sign in the box before saving.');
      return;
    }
    if (signerName.trim().length < 2) {
      toast.error('Enter the name of the person signing.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      // Flatten onto white: a transparent PNG disappears in the PDF.
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);

      const result = await saveSignature({
        ticketId,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || undefined,
        signerType: 'customer',
        dataUrl: flat.toDataURL('image/png'),
      });

      if (!result.ok) {
        toast.error(result.message ?? 'The signature could not be saved.');
        return;
      }

      toast.success('Signature captured.');
      clear();
      onSaved?.();
    } catch {
      toast.error('The signature could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="signer-name" required>Name of person signing</Label>
          <Input
            id="signer-name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="e.g. Khalid Al Mansoori"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signer-title">Position (optional)</Label>
          <Input
            id="signer-title"
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="e.g. IT Coordinator"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signature-canvas">Signature</Label>
        <div className="relative overflow-hidden rounded-lg border bg-white">
          <canvas
            id="signature-canvas"
            ref={canvasRef}
            className="signature-canvas h-44 w-full touch-none"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            aria-label="Signature capture area"
            role="img"
          />
          {empty ? (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <PenLine className="h-4 w-4" aria-hidden /> Sign here
              </span>
            </p>
          ) : null}
          <div className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-dashed border-slate-300" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground">
          By signing, the customer confirms the work described has been completed.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} loading={saving} disabled={empty}>
          Save signature
        </Button>
        <Button variant="outline" onClick={clear} disabled={empty || saving}>
          <Eraser className="h-4 w-4" /> Clear
        </Button>
      </div>
    </div>
  );
}
