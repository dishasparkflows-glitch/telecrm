import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { Card, shared } from '@/components/Card';
import { Loading, Message } from '@/components/States';
import { useLoad } from '@/hooks/useLoad';
import { colors } from '@/theme';
export default function Dashboard() {
  const state = useLoad(async () => { const [leads, calls] = await Promise.all([endpoints.leadStats(), endpoints.callStats()]); return { leads: leads.data, calls: calls.data }; }, []);
  if (state.loading && !state.data) return <Loading />; if (state.error && !state.data) return <Message text={state.error} retry={state.reload} />;
  return <ScrollView style={shared.screen} contentContainerStyle={shared.content} refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.reload} />}><Text style={shared.title}>Overview</Text><Text style={shared.subtitle}>Live CRM activity and pipeline snapshot.</Text><View style={s.grid}>{Object.entries(state.data?.leads || {}).slice(0, 8).map(([key, value]) => <Card key={key}><Text style={s.value}>{String(value)}</Text><Text style={s.key}>{key}</Text></Card>)}</View><Text style={s.section}>Calls</Text><View style={s.grid}>{Object.entries(state.data?.calls || {}).slice(0, 8).map(([key, value]) => <Card key={key}><Text style={s.value}>{String(value)}</Text><Text style={s.key}>{key}</Text></Card>)}</View></ScrollView>;
}
const s = StyleSheet.create({ grid: { gap: 10 }, value: { fontSize: 25, fontWeight: '800', color: colors.ink }, key: { color: colors.muted, textTransform: 'capitalize' }, section: { fontSize: 19, fontWeight: '800', marginTop: 10, color: colors.ink } });
