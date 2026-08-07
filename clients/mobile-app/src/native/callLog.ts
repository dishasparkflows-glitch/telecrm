import { PermissionsAndroid, Platform } from 'react-native';
import SparkCallLog, { type NativeCallRecord } from 'spark-call-log';

export async function requestCallLogPermission() {
  if (Platform.OS !== 'android') return false;
  return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
    title: 'Call history access', message: 'SparkCRM uses call history to sync business calls to your CRM. Sync is optional and can be stopped at any time.', buttonPositive: 'Allow', buttonNegative: 'Not now',
  })) === PermissionsAndroid.RESULTS.GRANTED;
}
export async function readCalls(since: number): Promise<NativeCallRecord[]> {
  if (Platform.OS !== 'android') return [];
  if (!SparkCallLog) throw new Error('Call-log support requires a SparkCRM Android development or release build.');
  return SparkCallLog.getCalls(since, 500);
}
