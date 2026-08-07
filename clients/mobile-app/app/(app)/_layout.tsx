import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/theme';
function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size }: { color: string; size: number }) { return <Ionicons name={name} color={color} size={size} />; }
  TabIcon.displayName = `${name}TabIcon`;
  return TabIcon;
}
export default function AppLayout() { return <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerStyle: { backgroundColor: colors.card }, headerTitleStyle: { color: colors.ink } }}>
  <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: tabIcon('grid-outline') }} />
  <Tabs.Screen name="leads" options={{ title: 'Leads', tabBarIcon: tabIcon('people-outline'), headerShown: false }} />
  <Tabs.Screen name="calls" options={{ title: 'Calls', tabBarIcon: tabIcon('call-outline') }} />
  <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: tabIcon('notifications-outline') }} />
  <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline') }} />
</Tabs>; }
