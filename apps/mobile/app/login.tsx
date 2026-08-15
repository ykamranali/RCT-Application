import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      // Vague on purpose - do not confirm which addresses are registered.
      setError('Those details were not recognised. Please check and try again.');
      setBusy(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .maybeSingle<{ is_active: boolean }>();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setError('This account is not active. Please contact your administrator.');
      setBusy(false);
      return;
    }

    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
          <Text style={styles.title}>RCT Application</Text>
          <Text style={styles.tagline}>Service Management</Text>
        </View>

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@ramcomputer.ae"
            placeholderTextColor="#94A3B8"
            editable={!busy}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholderTextColor="#94A3B8"
            editable={!busy}
            onSubmitEditing={() => void signIn()}
            returnKeyType="go"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          onPress={() => void signIn()}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <Text style={styles.footer}>Ram Computer Technology LLC</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colour.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  brand: { alignItems: 'center', marginBottom: 20 },
  logo: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: theme.colour.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  title: { marginTop: 14, fontSize: 20, fontWeight: '700', color: theme.colour.ink },
  tagline: { marginTop: 2, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: theme.colour.muted },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colour.ink },
  input: {
    borderWidth: 1, borderColor: theme.colour.border, borderRadius: theme.radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: theme.colour.surface, color: theme.colour.ink,
  },
  button: {
    marginTop: 6, backgroundColor: theme.colour.brand, borderRadius: theme.radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  error: {
    backgroundColor: theme.colour.dangerSoft, borderColor: '#FECACA', borderWidth: 1,
    borderRadius: theme.radius.md, padding: 12,
  },
  errorText: { color: theme.colour.danger, fontSize: 13, lineHeight: 18 },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 11, color: theme.colour.muted },
});
