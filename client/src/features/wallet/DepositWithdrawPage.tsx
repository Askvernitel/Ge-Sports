import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { claimDeposit, requestWithdrawal } from './api';
import { formatTokens } from '@/lib/money';
import { ZoneRing } from '@/components/ZoneRing';
import { useSessionStore } from '@/app/store';

type PendingAction = 'deposit' | 'withdraw' | null;

function truncateKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : key;
}

export function DepositWithdrawPage() {
  const { data: wallet } = useWalletBalance();
  const { publicKey, walletConnected } = useSessionStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('100');
  const [pending, setPending] = useState<PendingAction>(null);
  const [progressPct, setProgressPct] = useState(45);

  const depositMutation = useMutation({
    mutationFn: (amt: number) => claimDeposit(amt),
    onMutate: () => setPending('deposit'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setPending(null);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amt: number) => requestWithdrawal(amt),
    onMutate: () => setPending('withdraw'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setPending(null);
    },
  });

  const numericAmount = Number(amount) || 0;
  const isBusy = depositMutation.isPending || withdrawMutation.isPending;

  return (
    <div>
      <div className="px-10 pt-8 pb-2">
        <h1 className="font-display font-black text-5xl tracking-[1px] uppercase leading-none">Deposit / withdraw</h1>
      </div>

      <div
        className="grid grid-cols-1 sm:[grid-template-columns:1fr_1fr] gap-6 px-10 py-6 box-border"
        style={{ maxWidth: 820 }}
      >
        <div className="border border-lichen bg-panel p-8">
          <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-4">
            Wallet connection
          </div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className={`w-2 h-2 flex-shrink-0 ${walletConnected ? 'bg-zone' : 'bg-lichen'}`} />
            <span className="text-base">{walletConnected ? 'Phantom connected' : 'Wallet not connected'}</span>
          </div>
          {walletConnected && publicKey ? (
            <div className="font-mono text-sm text-lichen">{truncateKey(publicKey)}</div>
          ) : (
            <div className="text-sm text-lichen leading-[1.5]">
              Connect a wallet from{' '}
              <Link to="/profile" className="text-zone">
                your profile
              </Link>{' '}
              first.
            </div>
          )}

          <div className="h-px bg-lichen opacity-40 my-5" />

          <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-3">Amount</div>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full bg-ground border border-lichen text-bone font-mono text-xl tabular-nums p-3 box-border"
          />
          <div className="font-mono text-xs text-lichen mt-2">
            Available: {wallet ? formatTokens(wallet.custodialBalance) : '—'} · On-chain:{' '}
            {wallet ? formatTokens(wallet.onChainBalance) : '—'}
          </div>

          <div className="flex gap-3 mt-5">
            <button
              disabled={isBusy || numericAmount <= 0}
              onClick={() => {
                setProgressPct(45);
                depositMutation.mutate(numericAmount);
              }}
              className="flex-1 bg-zone border-none text-ground font-sans text-sm font-semibold p-3 cursor-pointer disabled:opacity-50"
            >
              Deposit tokens
            </button>
            <button
              disabled={isBusy || numericAmount <= 0 || (wallet ? numericAmount > wallet.custodialBalance : false)}
              onClick={() => {
                setProgressPct(45);
                withdrawMutation.mutate(numericAmount);
              }}
              className="flex-1 bg-transparent border border-lichen text-bone font-sans text-sm font-semibold p-3 cursor-pointer disabled:opacity-50"
            >
              Withdraw tokens
            </button>
          </div>
          {wallet && numericAmount > wallet.custodialBalance && (
            <div className="text-xs text-lichen mt-3 leading-[1.5]">
              Not enough available tokens. You have {formatTokens(wallet.custodialBalance)} available;{' '}
              {formatTokens(wallet.lockedBalance)} is locked in open rooms.
            </div>
          )}
        </div>

        <div className="border border-lichen bg-panel p-6 flex flex-col items-center justify-center text-center">
          {pending ? (
            <>
              <ZoneRing pct={progressPct} size={120} discSize={100} className="mb-4">
                <span className="font-mono text-sm text-zone">{progressPct}%</span>
              </ZoneRing>
              <div className="font-display font-bold text-md tracking-[1px] uppercase">
                Confirming {pending === 'deposit' ? 'deposit' : 'withdrawal'}
              </div>
              <div className="text-sm text-lichen mt-2 leading-[1.5]">
                Waiting on Solana devnet confirmation. This usually takes under a minute.
              </div>
            </>
          ) : (
            <>
              <ZoneRing pct={0} size={120} discSize={100} className="mb-4">
                <span className="font-mono text-sm text-lichen">—</span>
              </ZoneRing>
              <div className="font-display font-bold text-md tracking-[1px] uppercase">No transaction pending</div>
              <div className="text-sm text-lichen mt-2 leading-[1.5]">
                Enter an amount and choose deposit or withdraw to begin.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
