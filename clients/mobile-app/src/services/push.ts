import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { endpoints } from '@/api/endpoints';
import { getDeviceId } from './device';

export async function registerPush() {
  if (!Device.isDevice) return { registered: false, reason: 'Push registration requires a physical device.' };
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { registered: false, reason: 'Notification permission was not granted.' };
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'SparkCRM', importance: Notifications.AndroidImportance.HIGH });
  const nativeToken = await Notifications.getDevicePushTokenAsync();
  await endpoints.registerDevice({ deviceId: await getDeviceId(), token: String(nativeToken.data), platform: Platform.OS, appVersion: Application.nativeApplicationVersion || '1.0.0' });
  return { registered: true };
}
