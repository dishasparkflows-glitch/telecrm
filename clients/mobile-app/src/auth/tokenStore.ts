import * as SecureStore from 'expo-secure-store';
import type { Session, Tokens, User } from '@/types/models';

const ACCESS = 'sparkcrm.access';
const REFRESH = 'sparkcrm.refresh';
const USER = 'sparkcrm.user';

export const tokenStore = {
  async getTokens(): Promise<Tokens | null> {
    const [accessToken, refreshToken] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  async getUser(): Promise<User | null> {
    const value = await SecureStore.getItemAsync(USER);
    try { return value ? JSON.parse(value) as User : null; } catch { return null; }
  },
  async save(session: Session) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS, session.tokens.accessToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
      SecureStore.setItemAsync(REFRESH, session.tokens.refreshToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
      SecureStore.setItemAsync(USER, JSON.stringify(session.user), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    ]);
  },
  async saveTokens(tokens: Tokens) {
    await Promise.all([SecureStore.setItemAsync(ACCESS, tokens.accessToken), SecureStore.setItemAsync(REFRESH, tokens.refreshToken)]);
  },
  async clear() { await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH), SecureStore.deleteItemAsync(USER)]); },
};
