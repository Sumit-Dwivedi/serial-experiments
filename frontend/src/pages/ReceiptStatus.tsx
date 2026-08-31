import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Receipt as ReceiptIcon, ShieldAlert } from "lucide-react";

import PageShell from "@/components/PageShell";
import { apiGet } from "@/lib/api";
import type { SecretReceipt } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function ReceiptStatus() {
  const { token = "" } = useParams();

  const receipt = useQuery({
    queryKey: ["receipt", token],
    queryFn: () => apiGet<SecretReceipt>(`/receipts/${token}`),
    retry: false,
    refetchInterval: 10_000,
  });

  const data = receipt.isError ? undefined : receipt.data;

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">
          SENDER-ONLY READ RECEIPT
        </p>
        <h1
          className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
          data-testid="receipt-heading"
        >
          Has it been opened?
        </h1>
        <p className="mt-4 max-w-lg text-[15px] text-slate-400">
          This page reports a timestamp and nothing else. No IP, no device, no location — we do
          not collect them, so we cannot show them.
        </p>

        {receipt.isError && (
          <div
            className="mt-8 border border-[#FF3B30]/30 bg-[#2A0E13] p-6"
            data-testid="receipt-unknown-card"
          >
            <ShieldAlert className="size-6 text-[#FF3B30]" />
            <p className="mt-3 text-rose-100">Unknown receipt. This status link is not valid.</p>
          </div>
        )}

        {data && (
          <div
            className="mt-8 border border-white/10 bg-[#11141E] p-6"
            data-testid="receipt-status-card"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-10 items-center justify-center border ${
                  data.opened
                    ? "border-[#34D399]/40 bg-[#34D399]/10"
                    : "border-[#FBBF24]/40 bg-[#FBBF24]/10"
                }`}
              >
                {data.opened ? (
                  <CheckCircle2 className="size-4 text-[#34D399]" />
                ) : (
                  <Clock className="size-4 text-[#FBBF24]" />
                )}
              </span>
              <div>
                <p
                  className="font-heading text-lg font-semibold text-white"
                  data-testid="receipt-status-label"
                >
                  {data.opened ? "Opened" : "Not opened yet"}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  {data.opened && data.opened_at
                    ? `read at ${fmt(data.opened_at)}`
                    : "waiting for pickup · auto-refreshing"}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-2 border-t border-white/10 pt-5 font-mono text-[11px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">CREATED</dt>
                <dd className="text-slate-300" data-testid="receipt-created-at">
                  {fmt(data.created_at)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">EXPIRES</dt>
                <dd className="text-slate-300" data-testid="receipt-expires-at">
                  {fmt(data.expires_at)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="mt-6 flex items-center gap-2 font-mono text-[11px] text-slate-600">
          <ReceiptIcon className="size-3.5" /> Bookmark this page — it is the only copy of the
          receipt.
        </p>
      </div>
    </PageShell>
  );
}
