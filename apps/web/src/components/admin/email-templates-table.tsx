'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { updateEmailTemplate } from '@/lib/actions/email-templates';

export function EmailTemplatesTable({ templates }: { templates: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (template: any) => {
    setEditingId(template.id);
    setEditValues(template);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateEmailTemplate(editValues.id, editValues);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Template updated');
        setEditingId(null);
      }
    } catch (e) {
      toast.error('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Variables</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map(t => (
            <TableRow key={t.id}>
              {editingId === t.id ? (
                <>
                  <TableCell className="align-top space-y-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </TableCell>
                  <TableCell className="align-top space-y-4" colSpan={2}>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Subject</label>
                      <Input
                        value={editValues.subject}
                        onChange={e => setEditValues({ ...editValues, subject: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">HTML Body</label>
                      <Textarea
                        rows={10}
                        value={editValues.body_html}
                        onChange={e => setEditValues({ ...editValues, body_html: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Text Body</label>
                      <Textarea
                        rows={6}
                        value={editValues.body_text}
                        onChange={e => setEditValues({ ...editValues, body_text: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{t.subject}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.variables?.map((v: string) => (
                        <span key={v} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono">
                          {v}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => startEditing(t)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
