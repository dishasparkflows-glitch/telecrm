import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
export function Loading() { return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={s.muted}>Loading…</Text></View>; }
export function Message({ text, retry }: { text: string; retry?: () => void }) { return <View style={s.center}><Text style={s.message}>{text}</Text>{retry && <Pressable style={s.button} onPress={retry}><Text style={s.buttonText}>Try again</Text></Pressable>}</View>; }
export function Empty({ text }: { text: string }) { return <Message text={text} />; }
const s = StyleSheet.create({ center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, muted: { color: colors.muted }, message: { color: colors.muted, textAlign: 'center' }, button: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }, buttonText: { color: 'white', fontWeight: '700' } });
