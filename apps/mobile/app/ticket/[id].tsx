import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { STATUS_TONE, theme } from '@/lib/theme';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  customer_name: string | null;
  branch_name: string | null;
  priority_name: string | null;
  category_name: string | null;
  resolution_due_at: string | null;
  assigned_engineer_id: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  resolution_summary: string | null;
}

/**
 * Engineer job screen: the on-site workflow in one place — accept, travel,
 * arrive, start work, then resolve with the mandatory fields.
 */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  const [diagnosis, setDiagnosis] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [summary, setSummary] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    const { data } = await supabase
      .from('v_tickets_overview')
      .select('*')
      .eq('id', id)
      .maybeSingle<Ticket>();

    setTicket(data ?? null);
    setDiagnosis(data?.diagnosis ?? '');
    setWorkPerformed(data?.work_performed ?? '');
    setSummary(data?.resolution_summary ?? '');
    setBusy(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(status: string) {
    if (!ticket) return;
    setSaving(true);
    const { error } = await supabase.from('tickets').update({ status }).eq('id', ticket.id);
    setSaving(false);

    if (error) {
      Alert.alert('Could not update', friendly(error.message));
      return;
    }
    void load();
  }

  async function accept() {
    if (!ticket) return;
    setSaving(true);
    const { error } = await supabase.rpc('engineer_accept_ticket', { p_ticket_id: ticket.id });
    setSaving(false);
    if (error) { Alert.alert('Could not accept', friendly(error.message)); return; }
    void load();
  }

  /**
   * Record a site-visit checkpoint. Location is requested only at this
   * moment — the app never tracks position in the background.
   */
  async function checkpoint(stage: 'TRAVEL_STARTED' | 'ARRIVED' | 'WORK_STARTED') {
    if (!ticket || !profile?.employee_id) return;
    setSaving(true);

    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }
    } catch {
      // A refused or unavailable fix must never block the workflow.
    }

    const { error } = await supabase.from('ticket_visits').insert({
      ticket_id: ticket.id,
      engineer_id: profile.employee_id,
      stage,
      latitude,
      longitude,
    });

    if (error) {
      setSaving(false);
      Alert.alert('Could not record', friendly(error.message));
      return;
    }

    if (stage === 'ARRIVED') await supabase.from('tickets').update({ status: 'ON_SITE' }).eq('id', ticket.id);
    if (stage === 'WORK_STARTED') await supabase.from('tickets').update({ status: 'IN_PROGRESS' }).eq('id', ticket.id);

    setSaving(false);
    void load();
  }

  async function resolve() {
    if (!ticket) return;
    if (diagnosis.trim().length < 5) { Alert.alert('Diagnosis needed', 'Describe what you found before resolving.'); return; }
    if (workPerformed.trim().length < 5) { Alert.alert('Work needed', 'Describe the work you carried out.'); return; }
    if (summary.trim().length < 10) { Alert.alert('Summary needed', 'Write a short resolution summary for the customer.'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'RESOLVED',
        diagnosis: diagnosis.trim(),
        work_performed: workPerformed.trim(),
        resolution_summary: summary.trim(),
      })
      .eq('id', ticket.id);
    setSaving(false);

    if (error) { Alert.alert('Could not resolve', friendly(error.message)); return; }
    Alert.alert('Resolved', 'The customer has been asked to confirm.');
    void load();
  }

  if (busy) {
    return <View style={styles.centre}><ActivityIndicator color={theme.colour.brand} /></View>;
  }
  if (!ticket) {
    return <View style={styles.centre}><Text style={styles.muted}>Ticket not found.</Text></View>;
  }

  const tone = STATUS_TONE[ticket.status] ?? STATUS_TONE.NEW;
  const mine = ticket.assigned_engineer_id === profile?.employee_id;
  const open = !['CLOSED', 'CANCELLED', 'RESOLVED'].includes(ticket.status);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.number}>{ticket.ticket_number}</Text>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.fg }]}>
              {ticket.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.subject}>{ticket.subject}</Text>
        <Text style={styles.meta}>
          {ticket.customer_name}
          {ticket.branch_name ? ` · ${ticket.branch_name}` : ''}
        </Text>
        {ticket.priority_name ? (
          <Text style={styles.meta}>{ticket.priority_name} priority · {ticket.category_name ?? 'Uncategorised'}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Reported issue</Text>
        <Text style={styles.body}>{ticket.description}</Text>
      </View>

      {!mine ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>This ticket is assigned to another engineer.</Text>
        </View>
      ) : open ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Actions</Text>

          {ticket.status === 'ASSIGNED' ? (
            <Action label="Accept this ticket" onPress={accept} disabled={saving} primary />
          ) : null}

          {['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED'].includes(ticket.status) ? (
            <>
              <Action label="Start travelling" onPress={() => checkpoint('TRAVEL_STARTED')} disabled={saving} />
              <Action label="I have arrived on site" onPress={() => checkpoint('ARRIVED')} disabled={saving} />
            </>
          ) : null}

          {ticket.status === 'ON_SITE' ? (
            <Action label="Start work" onPress={() => checkpoint('WORK_STARTED')} disabled={saving} />
          ) : null}

          {['IN_PROGRESS', 'ON_SITE'].includes(ticket.status) ? (
            <Action label="Put on hold" onPress={() => setStatus('ON_HOLD')} disabled={saving} />
          ) : null}
        </View>
      ) : null}

      {mine && ['IN_PROGRESS', 'ON_SITE', 'ON_HOLD'].includes(ticket.status) ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Complete this job</Text>
          <Text style={styles.hint}>
            These fields are printed on the service report the customer receives.
          </Text>

          <Field label="Diagnosis — what was wrong" value={diagnosis} onChange={setDiagnosis} placeholder="On inspection the fault was traced to…" />
          <Field label="Work performed" value={workPerformed} onChange={setWorkPerformed} placeholder="Replaced the faulty unit, retested and confirmed with the site contact." />
          <Field label="Resolution summary for the customer" value={summary} onChange={setSummary} placeholder="Connectivity restored and verified on site." />

          <Action label="Resolve ticket" onPress={resolve} disabled={saving} primary />
        </View>
      ) : null}

      {ticket.resolution_summary ? (
        <View style={[styles.card, styles.resolved]}>
          <Text style={styles.heading}>Resolution</Text>
          <Text style={styles.body}>{ticket.resolution_summary}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.textarea}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

function Action({
  label, onPress, disabled, primary,
}: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        (pressed || disabled) && styles.actionPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={[styles.actionText, primary ? styles.actionTextPrimary : styles.actionTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Turn a database trigger message into something readable on a phone. */
function friendly(message: string): string {
  if (message.includes('Illegal ticket transition')) return 'That step is not allowed from the current status.';
  if (message.includes('Diagnosis is required')) return 'Add the diagnosis first.';
  if (message.includes('Work performed is required')) return 'Record the work carried out first.';
  if (message.includes('row-level security')) return 'You do not have permission to do that.';
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colour.background },
  muted: { color: theme.colour.muted, fontSize: 14 },
  card: {
    backgroundColor: theme.colour.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colour.border, padding: 14, gap: 8,
  },
  resolved: { borderColor: '#BBF7D0', backgroundColor: theme.colour.successSoft },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 12, fontWeight: '700', color: theme.colour.brand, fontVariant: ['tabular-nums'] },
  subject: { fontSize: 17, fontWeight: '700', color: theme.colour.ink, lineHeight: 22 },
  meta: { fontSize: 12, color: theme.colour.muted },
  heading: { fontSize: 13, fontWeight: '700', color: theme.colour.ink, textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 12, color: theme.colour.muted, lineHeight: 17 },
  body: { fontSize: 14, color: theme.colour.ink, lineHeight: 20 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  field: { gap: 6, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colour.ink },
  textarea: {
    borderWidth: 1, borderColor: theme.colour.border, borderRadius: theme.radius.md,
    padding: 12, fontSize: 14, minHeight: 84, color: theme.colour.ink,
    backgroundColor: theme.colour.background,
  },
  action: { borderRadius: theme.radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  actionPrimary: { backgroundColor: theme.colour.brand },
  actionSecondary: { backgroundColor: theme.colour.background, borderWidth: 1, borderColor: theme.colour.border },
  actionPressed: { opacity: 0.75 },
  actionText: { fontSize: 15, fontWeight: '600' },
  actionTextPrimary: { color: '#FFFFFF' },
  actionTextSecondary: { color: theme.colour.ink },
  notice: {
    backgroundColor: theme.colour.warningSoft, borderColor: '#FDE68A', borderWidth: 1,
    borderRadius: theme.radius.md, padding: 12,
  },
  noticeText: { color: theme.colour.warning, fontSize: 13 },
});
