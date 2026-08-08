import { useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { Card, PrimaryButton, shared } from '@/components/Card';
import { Empty, Loading, Message } from '@/components/States';
import { useLoad } from '@/hooks/useLoad';
import { syncCallLog } from '@/services/callSync';
import { colors } from '@/theme';
export default function Calls() {
  const state = useLoad(async () => (await endpoints.calls()).data, []); const [syncing, setSyncing] = useState(false);
  const sync = async () => { setSyncing(true); try { const result = await syncCallLog(true); Alert.alert(result.supported ? 'Call sync' : 'Not supported', result.message); if (result.synced) await state.reload(); } catch (e) { Alert.alert('Call sync failed', e instanceof Error ? e.message : 'Try again.'); } finally { setSyncing(false); } };
  if (state.loading && !state.data) return <Loading />; if (state.error && !state.data) return <Message text={state.error} retry={state.reload} />;
  return <FlatList style={shared.screen} contentContainerStyle={shared.content} data={state.data} keyExtractor={c => c._id} refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.reload} />} ListHeaderComponent={<View style={s.header}><Text style={shared.subtitle}>{Platform.OS === 'android' ? 'Sync this device’s call history with SparkCRM.' : 'iOS does not expose system call history to third-party apps.'}</Text>{Platform.OS === 'android' && <PrimaryButton disabled={syncing} title={syncing ? 'Syncing…' : 'Sync Android call history'} onPress={sync} />}</View>} ListEmptyComponent={<Empty text="No call history found." />} renderItem={({ item }) => <Card><Text style={s.number}>{item.direction === 'outbound' ? item.toNumber : item.fromNumber}</Text><Text style={shared.subtitle}>{item.direction || 'call'} · {item.status || 'unknown'} · {item.duration || 0}s</Text><Text style={s.date}>{new Date(item.startedAt || item.meta?.createdAt || '').toLocaleString()}</Text></Card>} />;
}
const s = StyleSheet.create({ header: { gap: 10, marginBottom: 4 }, number: { fontWeight: '800', color: colors.ink }, date: { fontSize: 11, color: colors.muted } });
