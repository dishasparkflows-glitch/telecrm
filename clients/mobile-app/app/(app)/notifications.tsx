import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { Card, shared } from '@/components/Card';
import { Empty, Loading, Message } from '@/components/States';
import { useLoad } from '@/hooks/useLoad';
import { colors } from '@/theme';
export default function Notifications() {
  const state = useLoad(async () => (await endpoints.notifications()).data, []);
  if (state.loading && !state.data) return <Loading />; if (state.error && !state.data) return <Message text={state.error} retry={state.reload} />;
  const read = async (id: string) => { await endpoints.readNotifications([id]); state.setData(old => old?.map(n => n._id === id ? { ...n, isRead: true } : n)); };
  return <FlatList style={shared.screen} contentContainerStyle={shared.content} data={state.data} keyExtractor={n => n._id} refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.reload} />} ListEmptyComponent={<Empty text="No notifications yet." />} renderItem={({ item }) => <Pressable onPress={() => !item.isRead && void read(item._id)}><Card><Text style={[s.title, !item.isRead && s.unread]}>{item.title || item.type || 'Notification'}</Text><Text style={shared.subtitle}>{item.message || item.body || 'Open to mark as read'}</Text><Text style={s.date}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text></Card></Pressable>} />;
}
const s = StyleSheet.create({ title: { color: colors.ink }, unread: { fontWeight: '900', color: colors.primary }, date: { color: colors.muted, fontSize: 11 } });
