import { Link } from "react-router-dom";

import PageShell from "@/components/PageShell";

const ABUSE_EMAIL = "abuse@sumitdwivedi.com";

const SECTIONS: { n: string; title: string; body: React.ReactNode }[] = [
  {
    n: "01",
    title: "What this service is",
    body: (
      <>
        An anonymous, zero-knowledge relay. Notes and attachments are encrypted in your
        browser before transmission; the key travels only in the link fragment. There are no
        accounts, no cookies, no IP logs, and no analytics. Everything expires on a timer.
      </>
    ),
  },
  {
    n: "02",
    title: "Prohibited use",
    body: (
      <>
        You may not use this service for anything illegal under applicable law. That
        includes, without limitation: child sexual abuse material (CSAM), material that
        infringes copyright or other intellectual property rights, credible threats,
        targeted harassment, doxxing, malware distribution, fraud, and unsolicited bulk
        transmission. Automated flooding of any endpoint is also prohibited.
      </>
    ),
  },
  {
    n: "03",
    title: "What the operator can and cannot do",
    body: (
      <>
        The operator cannot read encrypted secret contents — the decryption key is never
        transmitted to or stored on the server. Public wall posts and thread replies are
        stored in plaintext and are readable. On receipt of a report, the operator can and
        will remove content <span className="text-[#E8672E]">by id</span>, without needing to
        decrypt anything.
      </>
    ),
  },
  {
    n: "04",
    title: "Law enforcement",
    body: (
      <>
        Lawful requests are handled in accordance with applicable law. The operator can only
        produce what exists: ciphertext, public post text, timestamps, and expiry values.
        There are no IP addresses, no user agents, no accounts, and no session records to
        produce, because none are collected.
      </>
    ),
  },
  {
    n: "05",
    title: "Retention",
    body: (
      <>
        Every record carries a time-to-live and is deleted automatically when it lapses.
        Secrets can additionally be destroyed on first read. Abuse reports are stored with no
        identifying data and are purged 30 days after they are resolved.
      </>
    ),
  },
  {
    n: "06",
    title: "No warranty",
    body: (
      <>
        Provided as-is, with no guarantee of availability, delivery, or durability. Lose the
        link and the note is unrecoverable by design. Do not use this service as a backup.
      </>
    ),
  },
];

export default function Terms() {
  return (
    <PageShell>
      <p className="font-mono text-[11px] tracking-[0.4em] text-[#E8672E] uppercase">
        LAYER 07 // ACCEPTABLE USE
      </p>
      <h1
        className="type-reveal mt-4 font-mono text-3xl font-bold tracking-tight text-[#ECE7DC] sm:text-4xl"
        data-testid="terms-heading"
      >
        Anonymity is not immunity.
      </h1>
      <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-[#6B6F76]">
        Terms of service and acceptable use. Short, because there is very little to know
        about you.
      </p>

      <ol className="mt-10 grid max-w-3xl gap-3" data-testid="terms-sections">
        {SECTIONS.map((s) => (
          <li
            key={s.n}
            data-testid={`terms-section-${s.n}`}
            className="border border-white/10 bg-[#17171A] p-5 transition-colors duration-200 hover:border-[#213A52]"
          >
            <div className="flex gap-4">
              <span className="font-mono text-[11px] text-[#E8672E]">{s.n}</span>
              <div>
                <h2 className="font-mono text-base font-semibold text-[#ECE7DC]">{s.title}</h2>
                <p className="mt-2 font-mono text-sm leading-relaxed text-[#B8B3AA]">
                  {s.body}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div
        className="mt-8 max-w-3xl border border-[#213A52] bg-[#0E0E10] p-5"
        data-testid="terms-contact"
      >
        <p className="font-mono text-[11px] tracking-[0.22em] text-[#555961] uppercase">
          LEGAL // ABUSE CONTACT
        </p>
        <a
          href={`mailto:${ABUSE_EMAIL}`}
          data-testid="terms-contact-email"
          className="glitch-hover mt-2 inline-block font-mono text-sm text-[#E8672E] transition-none hover:text-[#F07A3F]"
        >
          {ABUSE_EMAIL}
        </a>
        <p className="mt-3 font-mono text-sm leading-relaxed text-[#B8B3AA]">
          For takedown and law-enforcement inquiries. To flag a specific link or id, use the{" "}
          <Link
            to="/report"
            data-testid="terms-report-link"
            className="glitch-hover text-[#E8672E] transition-none hover:text-[#F07A3F]"
          >
            report form
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
