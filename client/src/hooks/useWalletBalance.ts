import { useQuery } from '@tanstack/react-query';
import { fetchWallet } from '@/features/wallet/api';

export function useWalletBalance() {
  return useQuery({ queryKey: ['wallet'], queryFn: fetchWallet, staleTime: 10_000 });
}
