import { requireOptionalNativeModule } from 'expo-modules-core';

export type NativeCallRecord = { nativeId: string; phone: string; type: string; timestamp: number; duration: number; simSlot?: number; simLabel?: string; simPhoneNumber?: string };
type CallLogModule = { getCalls(since: number, limit: number): Promise<NativeCallRecord[]> };

const SparkCallLog = requireOptionalNativeModule<CallLogModule>('SparkCallLog');
export default SparkCallLog;
