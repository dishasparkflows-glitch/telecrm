import { useGetPurchasedFeaturesQuery } from '../features/billing/billingApi'

export function useFeature(featureKey) {
    const { data, isLoading } = useGetPurchasedFeaturesQuery()
    const features = data?.data || []
    const hasFeature = features.some(
        (f) => f.key === featureKey && f.status === 'active'
    )
    return { hasFeature, isLoading }
}
