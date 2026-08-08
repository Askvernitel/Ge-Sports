export function AboutPage() {
  return (
    <div className="px-5 sm:px-10 pt-12 pb-16" style={{ maxWidth: 760 }}>
      <h1 className="font-display font-black text-5xl tracking-[1px] uppercase leading-none mb-6">About</h1>

      <p className="text-md leading-[1.6] mb-6">
        GE-SPORTS is a platform where PUBG players stake test tokens on their own match performance. Browse or
        create rooms filtered by mode, map, and entry fee, join by escrowing an entry fee, play the match in game,
        and the pool is distributed automatically from verified match results.
      </p>

      <div className="grid gap-8 mt-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div>
          <div className="font-display font-bold text-2xl uppercase tracking-[1px] mb-3">Devnet only</div>
          <p className="text-base leading-[1.6] text-lichen">
            Everything here runs on Solana devnet with test tokens. Nothing in this product implies real money is at
            stake, and no copy promises winnings or returns.
          </p>
        </div>
        <div>
          <div className="font-display font-bold text-2xl uppercase tracking-[1px] mb-3">Verified results</div>
          <p className="text-base leading-[1.6] text-lichen">
            Match results are pulled from match telemetry, not self-reported. If a result can't be verified, the
            room is refunded rather than settled incorrectly.
          </p>
        </div>
        <div>
          <div className="font-display font-bold text-2xl uppercase tracking-[1px] mb-3">Built responsibly</div>
          <p className="text-base leading-[1.6] text-lichen">
            Identity verification, self-exclusion, and clear rake disclosure are built in from the start, not
            retrofitted later.
          </p>
        </div>
      </div>

      <div className="h-px bg-lichen opacity-40 my-10" />

      <div className="font-mono text-xs tracking-[1px] text-lichen leading-[1.8]">
        18+ ONLY · SOLANA DEVNET · TEST TOKENS HAVE NO MONETARY VALUE
      </div>
    </div>
  );
}
