import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { randomUUID } from 'expo-crypto';
const KEY = 'sparkcrm.device.id';
export async function getDeviceId() {
  const native = Application.getAndroidId();
  if (native) return `android-${native}`;
  let id = await AsyncStorage.getItem(KEY);
  if (!id) { id = randomUUID(); await AsyncStorage.setItem(KEY, id); }
  return id;
}
