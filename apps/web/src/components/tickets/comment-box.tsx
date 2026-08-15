'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { toast } from 'sonner';

import { isStaff, type TicketComment, type UserRole } from '@rct/types';

import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { addComment } from '@/lib/actions/tickets';
import { formatTimelineStamp } from '@/lib/format';
import { cn } from '@/lib/utils';

export function CommentThread({
  ticketId,
  comments,
  role,
  canComment = true,
}: {
  ticketId: string;
  comments: TicketComment[];
  role: UserRole;
  canComment?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const staff = isStaff(role);

  async function submit() {
    if (body.trim().length === 0) return;
    setSending(true);
    try {
      const result = await addComment({ ticketId, body: body.trim(), isInternal: staff && internal });
      if (!result.ok) {
        toast.error(result.message ?? 'The comment could not be added.');
        return;
      }
      setBody('');
      setInternal(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn(
                'flex gap-3 rounded-lg border p-3',
                comment.is_internal ? 'border-warning/30 bg-warning-soft/50' : 'bg-card',
              )}
            >
              <UserAvatar name={comment.author_name} className="h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{comment.author_name ?? 'System'}</span>
                  {comment.is_internal ? (
                    <span className="chip bg-warning-soft text-warning ring-warning/25">
                      <Lock className="h-3 w-3" aria-hidden /> Internal
                    </span>
                  ) : null}
                  <time className="text-2xs text-muted-foreground" dateTime={comment.created_at}>
                    {formatTimelineStamp(comment.created_at)}
                  </time>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={staff ? 'Add an update for the customer…' : 'Add a comment for the engineer…'}
            rows={3}
            aria-label="Comment"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit();
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {staff ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={internal} onCheckedChange={setInternal} aria-label="Internal note" />
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden /> Internal note — not visible to the customer
                </span>
              </label>
            ) : (
              <span className="text-xs text-muted-foreground">Your engineer will be notified.</span>
            )}
            <Button size="sm" onClick={() => void submit()} loading={sending} disabled={body.trim().length === 0}>
              <Send className="h-3.5 w-3.5" /> Post
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
