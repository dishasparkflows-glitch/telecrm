import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { PrimaryButton, shared } from '@/components/Card';
import { colors } from '@/theme';
export default function Login() {
  const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async () => { if (!email || !password) return setError('Enter your email and password.'); setBusy(true); setError(''); try { await login(email, password); } catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); } finally { setBusy(false); } };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.screen}><View style={s.form}><Text style={s.brand}>SparkCRM</Text><Text style={shared.subtitle}>Sign in to manage leads and customer calls.</Text><TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email" value={email} onChangeText={setEmail} style={shared.input} /><TextInput secureTextEntry autoComplete="current-password" placeholder="Password" value={password} onChangeText={setPassword} style={shared.input} />{error ? <Text style={s.error}>{error}</Text> : null}<PrimaryButton title={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={submit} /></View></KeyboardAvoidingView>;
}
const s = StyleSheet.create({ screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }, form: { gap: 14 }, brand: { fontSize: 34, fontWeight: '900', color: colors.primary }, error: { color: colors.danger } });
