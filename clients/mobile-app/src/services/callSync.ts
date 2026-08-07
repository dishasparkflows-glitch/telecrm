import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { endpoints } from '@/api/endpoints';
import { tokenStore } from '@/auth/tokenStore';
import { readCalls, requestCallLogPermission } from '@/native/callLog';
import { getDeviceId } from './device';

const CURSOR = 'sparkcrm.callSync.cursor';
export const CALL_SYNC_TASK = 'sparkcrm-call-log-sync';
export type SyncResult = { supported: boolean; synced: number; duplicates: number; message: string };

export async function syncCallLog(requestPermission = false): Promise<SyncResult> {
  if (Platform.OS !== 'android') return { supported: false, synced: 0, duplicates: 0, message: 'System call history is not available to iOS apps.' };
  if (requestPermission && !(await requestCallLogPermission())) return { supported: true, synced: 0, duplicates: 0, message: 'Call history permission was not granted.' };
  const cursor = Number(await AsyncStorage.getItem(CURSOR) || 0);
  const native = await readCalls(cursor);
  if (!native.length) return { supported: true, synced: 0, duplicates: 0, message: 'Call history is up to date.' };
  const deviceId = await getDeviceId(); let synced = 0; let duplicates = 0; let maxTimestamp = cursor;
  for (let i = 0; i < native.length; i += 100) {
    const batch = native.slice(i, i + 100);
    const calls = batch.map(call => ({
      deviceCallId: `${deviceId}:${call.nativeId}`, phone: call.phone, type: call.type,
      startedAt: new Date(call.timestamp).toISOString(), duration: call.duration,
      simSlot: call.simSlot, simLabel: call.simLabel, simPhoneNumber: call.simPhoneNumber,
      hasRecording: false,
    }));
    const result = await endpoints.syncCalls(deviceId, calls);
    if (result.data.errors.length) throw new Error(`Call sync rejected ${result.data.errors.length} record(s); cursor was not advanced.`);
    synced += result.data.created; duplicates += result.data.duplicates;
    maxTimestamp = Math.max(maxTimestamp, ...batch.map(item => item.timestamp));
    await AsyncStorage.setItem(CURSOR, String(maxTimestamp));
  }
  return { supported: true, synced, duplicates, message: `Synced ${synced} call(s); ${duplicates} already existed.` };
}

TaskManager.defineTask(CALL_SYNC_TASK, async () => {
  try {
    if (!(await tokenStore.getTokens())) return BackgroundFetch.BackgroundFetchResult.NoData;
    const result = await syncCallLog(false);
    return result.synced ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch { return BackgroundFetch.BackgroundFetchResult.Failed; }
});

export async function registerCallSyncTask() {
  if (Platform.OS !== 'android' || await TaskManager.isTaskRegisteredAsync(CALL_SYNC_TASK)) return;
  await BackgroundFetch.registerTaskAsync(CALL_SYNC_TASK, { minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true });
}
