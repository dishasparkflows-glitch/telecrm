import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { endpoints } from '@/api/endpoints';
import { Card, shared } from '@/components/Card';
import { Empty, Message } from '@/components/States';
import type { Lead } from '@/types/models';
import { colors } from '@/theme';
export default function Leads() {
  const [items, setItems] = useState<Lead[]>([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (next = 1) => { if (loading) return; setLoading(true); setError(''); try { const result = await endpoints.leads(next, query); setItems(old => next === 1 ? result.data : [...old, ...result.data]); setPage(next); setPages(result.pagination?.totalPages || 1); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load leads'); } finally { setLoading(false); } }, [query, loading]);
  // A submitted query resets pagination and starts a fresh request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(1); }, [query]);
  return <FlatList style={shared.screen} contentContainerStyle={shared.content} data={items} keyExtractor={item => item._id} refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />} ListHeaderComponent={<><TextInput style={shared.input} placeholder="Search name, phone, email or company" value={search} onChangeText={setSearch} onSubmitEditing={() => setQuery(search.trim())} returnKeyType="search" />{error ? <Message text={error} retry={() => load(page)} /> : null}</>} ListEmptyComponent={!loading && !error ? <Empty text="No leads found." /> : null} renderItem={({ item }) => <Pressable onPress={() => router.push(`/leads/${item._id}`)}><Card><Text style={s.name}>{`${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed lead'}</Text><Text style={shared.subtitle}>{item.company || item.phone || item.email || 'No contact details'}</Text><Text style={s.stage}>{item.stage || 'new'}</Text></Card></Pressable>} onEndReached={() => { if (!loading && page < pages) void load(page + 1); }} onEndReachedThreshold={0.4} />;
}
const s = StyleSheet.create({ name: { fontWeight: '800', fontSize: 16, color: colors.ink }, stage: { color: colors.primary, textTransform: 'capitalize', fontWeight: '600' } });
