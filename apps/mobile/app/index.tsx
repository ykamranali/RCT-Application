import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { SLA_TONE, STATUS_TONE, theme } from '@/lib/theme';

interface TicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  customer_name: string | null;
  branch_name: string | null;
  priority_code: string | null;
  resolution_state: string;
  resolution_remaining_minutes: number | null;
  resolution_due_at: string | null;
}

export default function TicketListScreen() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true);

    // Row Level Security scopes this to what the signed-in principal may
    // see; the engineer filter narrows it to their own assignments.
    let query = supabase
      .from('v_tickets_overview')
      .select('id, ticket_number, subject, status, customer_name, branch_name, priority_code, resolution_state, resolution_remaining_minutes, resolution_due_at')
      .not('status', 'in', '("CLOSED","CANCELLED")')
      .order('resolution_due_at', { ascending: true, nullsFirst: false })
      .limit(100);

    if (profile?.role === 'engineer' && profile.employee_id) {
      query = query.eq('assigned_engineer_id', profile.employee_id);
    }

    const { data } = await query;
    setTickets((data as TicketRow[] | null) ?? []);
    setBusy(false);
  }, [session, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !session) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={theme.colour.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {profile?.full_name?.split(' ')[0] ?? 'Welcome'}
        </Text>
        <Text style={styles.subtitle}>
          {tickets.length} open job{tickets.length === 1 ? '' : 's'}
        </Text>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={theme.colour.brand} />}
        ListEmptyComponent={
          busy ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing open</Text>
              <Text style={styles.emptyBody}>
                New work appears here as soon as it is dispatched to you.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = STATUS_TONE[item.status] ?? STATUS_TONE.NEW;
          const sla = SLA_TONE[item.resolution_state] ?? SLA_TONE.pending;
          const remaining = item.resolution_remaining_minutes;

          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/ticket/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.ticket_number}, ${item.subject}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.number}>{item.ticket_number}</Text>
                {item.priority_code ? (
                  <Text style={styles.priority}>{item.priority_code}</Text>
                ) : null}
              </View>

              <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>

              {item.customer_name ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {item.customer_name}
                  {item.branch_name ? ` · ${item.branch_name}` : ''}
                </Text>
              ) : null}

              <View style={styles.chips}>
                <Chip bg={status.bg} fg={status.fg} label={item.status.replace(/_/g, ' ')} />
                <Chip
                  bg={sla.bg}
                  fg={sla.fg}
                  label={
                    typeof remaining === 'number'
                      ? remaining < 0
                        ? `${formatShort(-remaining)} overdue`
                        : `${formatShort(remaining)} left`
                      : item.resolution_state.replace(/_/g, ' ')
                  }
                />
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Chip({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function formatShort(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes)}m`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colour.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colour.background },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 22, fontWeight: '700', color: theme.colour.ink },
  subtitle: { marginTop: 2, fontSize: 13, color: theme.colour.muted },
  list: { padding: 16, paddingTop: 8, gap: 10 },
  card: {
    backgroundColor: theme.colour.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colour.border,
    padding: 14,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: 12, fontWeight: '600', color: theme.colour.brand, fontVariant: ['tabular-nums'] },
  priority: { fontSize: 11, fontWeight: '700', color: theme.colour.muted, letterSpacing: 0.5 },
  subject: { marginTop: 6, fontSize: 15, fontWeight: '600', color: theme.colour.ink, lineHeight: 20 },
  meta: { marginTop: 3, fontSize: 12, color: theme.colour.muted },
  chips: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colour.ink },
  emptyBody: { marginTop: 6, fontSize: 13, color: theme.colour.muted, textAlign: 'center', lineHeight: 19 },
});
