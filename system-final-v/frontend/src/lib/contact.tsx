/**
 * The public contact addresses for ESAP Clinical AI (rasdiya.health).
 *
 *  - care@esap.ai     customer help: contact, privacy and terms pages
 *  - billing@esap.ai  payment and invoice questions
 *
 * System email (invoices, payment notices, password reset, sign-up, invites)
 * is sent by the backend from no-reply@esap.ai, with one of these as Reply-To.
 */
export const SUPPORT_EMAIL = "care@esap.ai";
export const BILLING_EMAIL = "billing@esap.ai";

/** A mailto link. Marked English and left-to-right so it reads correctly inside Arabic text. */
export function MailLink({ address, subject }: { address: string; subject?: string }) {
  const href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return <a href={href} lang="en" dir="ltr">{address}</a>;
}
