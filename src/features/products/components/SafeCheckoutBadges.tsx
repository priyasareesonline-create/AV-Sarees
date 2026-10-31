import { Landmark, ShieldCheck } from "lucide-react";

const tileClass =
  "flex h-8 w-[52px] shrink-0 items-center justify-center rounded-md border border-border bg-white";

function UpiLogo() {
  return (
    <svg viewBox="0 0 48 20" className="h-4 w-auto" aria-hidden>
      <text
        x="0"
        y="15"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15"
        fontStyle="italic"
        fontWeight="700"
        fill="#5f6368"
      >
        UPI
      </text>
      <path d="M33 3l6 7-6 7z" fill="#F47920" />
      <path d="M39 3l6 7-6 7z" fill="#0A8C3C" />
    </svg>
  );
}

function VisaLogo() {
  return (
    <svg viewBox="0 0 48 16" className="h-3.5 w-auto" aria-hidden>
      <text
        x="24"
        y="14"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="16"
        fontStyle="italic"
        fontWeight="900"
        fill="#1A1F71"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 36 22" className="h-5 w-auto" aria-hidden>
      <circle cx="13" cy="11" r="9" fill="#EB001B" />
      <circle cx="23" cy="11" r="9" fill="#F79E1B" />
      <path
        d="M18 3.5a9 9 0 0 1 0 15 9 9 0 0 1 0-15z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function RupayLogo() {
  return (
    <svg viewBox="0 0 50 18" className="h-3.5 w-auto" aria-hidden>
      <text
        x="0"
        y="14"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="14"
        fontStyle="italic"
        fontWeight="800"
        fill="#1B3281"
      >
        RuPay
      </text>
      <path d="M42 2l6 7-6 7z" fill="#F47920" />
      <path d="M39 5l4 4-4 4z" fill="#0A8C3C" />
    </svg>
  );
}

function NetBankingLogo() {
  return (
    <span className="flex flex-col items-center leading-none text-[#1B3281]">
      <Landmark className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      <span className="mt-0.5 text-[8px] font-semibold">Net Banking</span>
    </span>
  );
}

const METHODS = [
  { label: "UPI", Logo: UpiLogo },
  { label: "Visa", Logo: VisaLogo },
  { label: "Mastercard", Logo: MastercardLogo },
  { label: "RuPay", Logo: RupayLogo },
  { label: "Net banking", Logo: NetBankingLogo },
] as const;

export function SafeCheckoutBadges() {
  return (
    <section
      aria-label="Accepted payment methods"
      className="mb-5 max-w-lg rounded-lg border border-border px-3 py-3 text-center"
    >
      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
        <ShieldCheck
          className="h-4 w-4 text-[#0A8C3C]"
          strokeWidth={2}
          aria-hidden
        />
        Guaranteed Safe Checkout
      </p>
      <ul className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
        {METHODS.map(({ label, Logo }) => (
          <li key={label} className={tileClass} title={label}>
            <Logo />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        100% secure payments via Cashfree
      </p>
    </section>
  );
}
