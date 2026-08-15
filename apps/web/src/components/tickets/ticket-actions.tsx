'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  CheckCircle2, CircleCheck, MapPin, Navigation, PenLine, PlayCircle, Plus, UserCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  ALLOWED_TRANSITIONS, TICKET_STATUS_META, type TicketOverview, type TicketStatus, type UserRole,
} from '@rct/types';

import { SignaturePad } from '@/components/tickets/signature-pad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  acceptTicket, addTicketPart, assignTicket, recordVisitStage, resolveTicket, updateTicketStatus,
} from '@/lib/actions/tickets';

/**
 * Right-hand action panel on the ticket detail screen.
 *
 * Only transitions the database will actually accept are offered, taken
 * from the same table the trigger enforces, so the UI cannot present a
 * button that is guaranteed to fail.
 */
export function TicketActions({
  ticket,
  role,
  employeeId,
  engineers,
  hasSignature,
}: {
  ticket: TicketOverview;
  role: UserRole;
  employeeId: string | null;
  engineers: { id: string; full_name: string; employee_code: string }[];
  hasSignature: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [resolveOpen, setResolveOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isMine = !!employeeId && ticket.assigned_engineer_id === employeeId;
  const canAssign = role !== 'engineer';
  const canAct = role !== 'engineer' || isMine;
  const transitions = ALLOWED_TRANSITIONS[ticket.status] ?? [];

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? 'Done.');
        router.refresh();
      } else {
        toast.error(result.message ?? 'That did not work.');
      }
    });
  }

  /** Ask the browser for a fix, but never block the action on it. */
  function withLocation(stage: 'TRAVEL_STARTED' | 'ARRIVED' | 'WORK_STARTED' | 'WORK_COMPLETED' | 'DEPARTED') {
    if (!navigator.geolocation) {
      run(() => recordVisitStage({ ticketId: ticket.id, stage }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        run(() =>
          recordVisitStage({
            ticketId: ticket.id,
            stage,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        ),
      () => run(() => recordVisitStage({ ticketId: ticket.id, stage })),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- primary workflow ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ticket.status === 'ASSIGNED' && isMine ? (
            <Button className="w-full" loading={pending} onClick={() => run(() => acceptTicket(ticket.id))}>
              <UserCheck className="h-4 w-4" /> Accept this ticket
            </Button>
          ) : null}

          {canAct && ['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED'].includes(ticket.status) ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={pending} onClick={() => withLocation('TRAVEL_STARTED')}>
                <Navigation className="h-4 w-4" /> Travelling
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => withLocation('ARRIVED')}>
                <MapPin className="h-4 w-4" /> On site
              </Button>
            </div>
          ) : null}

          {canAct && ticket.status === 'ON_SITE' ? (
            <Button variant="outline" className="w-full" disabled={pending} onClick={() => withLocation('WORK_STARTED')}>
              <PlayCircle className="h-4 w-4" /> Start work
            </Button>
          ) : null}

          {canAct && transitions.includes('RESOLVED') ? (
            <Button variant="success" className="w-full" onClick={() => setResolveOpen(true)} disabled={pending}>
              <CircleCheck className="h-4 w-4" /> Resolve ticket
            </Button>
          ) : null}

          {canAct && ticket.status === 'RESOLVED' ? (
            <Button className="w-full" loading={pending} onClick={() => run(() => updateTicketStatus({ ticketId: ticket.id, status: 'CLOSED' }))}>
              <CheckCircle2 className="h-4 w-4" /> Close and issue report
            </Button>
          ) : null}

          {canAct && !hasSignature && ['ON_SITE', 'IN_PROGRESS', 'RESOLVED'].includes(ticket.status) ? (
            <Button variant="outline" className="w-full" onClick={() => setSignatureOpen(true)} disabled={pending}>
              <PenLine className="h-4 w-4" /> Capture customer signature
            </Button>
          ) : null}

          {canAct ? (
            <Button variant="outline" className="w-full" onClick={() => setPartOpen(true)} disabled={pending}>
              <Plus className="h-4 w-4" /> Record a part
            </Button>
          ) : null}

          {canAct && transitions.includes('CANCELLED') ? (
            <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)} disabled={pending}>
              <XCircle className="h-4 w-4" /> Cancel ticket
            </Button>
          ) : null}

          {!canAct ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              This ticket is assigned to another engineer.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- status ---- */}
      {canAct && transitions.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Change status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value=""
              onValueChange={(value) => {
                if (value === 'CLOSED' || value === 'RESOLVED' || value === 'CANCELLED') {
                  if (value === 'RESOLVED') setResolveOpen(true);
                  else if (value === 'CANCELLED') setCancelOpen(true);
                  else run(() => updateTicketStatus({ ticketId: ticket.id, status: value as TicketStatus }));
                  return;
                }
                run(() => updateTicketStatus({ ticketId: ticket.id, status: value as TicketStatus }));
              }}
            >
              <SelectTrigger aria-label="Change ticket status">
                <SelectValue placeholder={`Currently ${TICKET_STATUS_META[ticket.status].label}`} />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((s) => (
                  <SelectItem key={s} value={s}>{TICKET_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {/* ---- assignment ---- */}
      {canAssign ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Assigned engineer</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={ticket.assigned_engineer_id ?? 'none'}
              onValueChange={(value) =>
                run(() => assignTicket({ ticketId: ticket.id, engineerId: value === 'none' ? null : value }))
              }
            >
              <SelectTrigger aria-label="Assign engineer">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {engineers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      <ResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        ticket={ticket}
        onDone={() => router.refresh()}
      />

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Customer signature</DialogTitle>
            <DialogDescription>
              Hand the device to the site contact. The signature is embedded in the service report.
            </DialogDescription>
          </DialogHeader>
          <SignaturePad
            ticketId={ticket.id}
            defaultSignerName={ticket.branch_name ? undefined : ticket.customer_name}
            onSaved={() => {
              setSignatureOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <PartDialog open={partOpen} onOpenChange={setPartOpen} ticketId={ticket.id} onDone={() => router.refresh()} />

      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} ticketId={ticket.id} onDone={() => router.refresh()} />
    </div>
  );
}

// ---------------------------------------------------------------------

function ResolveDialog({
  open,
  onOpenChange,
  ticket,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: TicketOverview;
  onDone: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis ?? '');
  const [workPerformed, setWorkPerformed] = useState(ticket.work_performed ?? '');
  const [summary, setSummary] = useState(ticket.resolution_summary ?? '');
  const [remarks, setRemarks] = useState(ticket.engineer_remarks ?? '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const result = await resolveTicket({
        ticketId: ticket.id,
        diagnosis: diagnosis.trim(),
        workPerformed: workPerformed.trim(),
        resolutionSummary: summary.trim(),
        engineerRemarks: remarks.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.message ?? 'The ticket could not be resolved.');
        return;
      }
      toast.success(result.message ?? 'Ticket resolved.');
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve {ticket.ticket_number}</DialogTitle>
          <DialogDescription>
            These fields are printed on the service report the customer receives, so write them for
            the customer rather than for internal use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="diagnosis" required>Diagnosis — what was wrong</Label>
            <Textarea id="diagnosis" rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="On inspection the fault was traced to…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="work" required>Work performed</Label>
            <Textarea id="work" rows={3} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} placeholder="Replaced the faulty unit, retested and confirmed normal operation with the site contact." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary" required>Resolution summary for the customer</Label>
            <Textarea id="summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Connectivity restored and verified with the site contact." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remarks">Engineer remarks (optional)</Label>
            <Textarea id="remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Recommend scheduling preventive maintenance at the next quarterly visit." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} loading={saving}>Resolve ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartDialog({
  open,
  onOpenChange,
  ticketId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const result = await addTicketPart({
        ticketId,
        partName: name.trim(),
        serialNumber: serial.trim() || undefined,
        quantity: Number(quantity) || 1,
        unit: 'pcs',
        unitCost: unitCost ? Number(unitCost) : null,
        isReplacement: true,
      });
      if (!result.ok) {
        toast.error(result.message ?? 'The part could not be recorded.');
        return;
      }
      toast.success('Part recorded.');
      setName(''); setSerial(''); setQuantity('1'); setUnitCost('');
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a part or material</DialogTitle>
          <DialogDescription>These appear on the service report and in the parts-consumed report.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="part-name" required>Description</Label>
            <Input id="part-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2TB enterprise hard disk" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="part-serial">Serial number</Label>
              <Input id="part-serial" value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-qty" required>Quantity</Label>
              <Input id="part-qty" type="number" min="0.001" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-cost">Unit cost (AED)</Label>
            <Input id="part-cost" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Leave blank if not chargeable" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} loading={saving} disabled={name.trim().length < 2}>Add part</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  ticketId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const result = await updateTicketStatus({
        ticketId,
        status: 'CANCELLED',
        cancellationReason: reason.trim(),
      });
      if (!result.ok) {
        toast.error(result.message ?? 'The ticket could not be cancelled.');
        return;
      }
      toast.success('Ticket cancelled.');
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this ticket</DialogTitle>
          <DialogDescription>
            Cancelling keeps the ticket and its history but removes it from the active queue.
            A reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" required>Reason for cancelling</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate of TKT-2026-000118 raised for the same fault."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Keep ticket</Button>
          <Button variant="destructive" onClick={() => void submit()} loading={saving} disabled={reason.trim().length < 3}>
            Cancel ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
