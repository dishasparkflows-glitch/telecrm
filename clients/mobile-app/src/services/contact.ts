import { Alert, Linking, Platform } from 'react-native';
import { endpoints } from '@/api/endpoints';
export async function callLead(phone: string, leadId: string) {
  if (!phone) return;
  if (process.env.EXPO_PUBLIC_ENABLE_PROVIDER_CALL === 'true') {
    try { await endpoints.initiateCall(phone, leadId); return; }
    catch (error) { Alert.alert('Provider call unavailable', error instanceof Error ? error.message : 'Opening the phone dialer instead.'); }
  }
  await Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`);
}
export async function whatsappLead(phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const url = `https://wa.me/${normalized}`;
  if (!(await Linking.canOpenURL(url))) throw new Error(`WhatsApp link is unavailable on ${Platform.OS}.`);
  await Linking.openURL(url);
}
