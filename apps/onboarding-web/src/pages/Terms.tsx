import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <article className="legal-doc card">
      <h1>Terms of Service</h1>
      <p className="legal-meta muted">
        Last updated: May 2026 · These Terms govern use of the A3 Billiards OS onboarding website for registration and
        subscription renewal.
      </p>

      <section>
        <h2>1. Agreement</h2>
        <p>
          By creating an account, submitting club information, or completing payment, you agree to these Terms and our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the onboarding site.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and have authority to bind the club or business you represent. You are
          responsible for the accuracy of all information you provide.
        </p>
      </section>

      <section>
        <h2>3. Service description</h2>
        <p>
          The onboarding website lets verified owners register for A3 Billiards OS, capture venue defaults, and purchase
          or renew a software subscription. Features available inside the Owner App may vary by plan and configuration.
        </p>
      </section>

      <section>
        <h2>4. Accounts &amp; security</h2>
        <p>
          You must maintain the confidentiality of your credentials and notify us promptly of unauthorized use. We may
          suspend accounts that present security risk or violate these Terms.
        </p>
      </section>

      <section>
        <h2>5. Fees &amp; payments</h2>
        <p>
          Subscription fees are charged in the currency shown at checkout (typically INR) via Razorpay. Taxes may apply.
          Renewals extend access according to the subscription logic described in product documentation (unused paid time
          may roll forward when renewing early).
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Misrepresent identity, venue, or pricing.</li>
          <li>Attempt to circumvent billing, security, or access controls.</li>
          <li>Use the service to violate applicable law or third‑party rights.</li>
          <li>Upload malware or interfere with infrastructure.</li>
        </ul>
      </section>

      <section>
        <h2>7. Availability &amp; changes</h2>
        <p>
          We strive for high availability but do not guarantee uninterrupted service. We may modify or discontinue
          features with reasonable notice where practicable.
        </p>
      </section>

      <section>
        <h2>8. Intellectual property</h2>
        <p>
          The platform, branding, and software are owned by us or our licensors. You receive a limited license to use
          the service according to your subscription. You retain rights in your club content subject to the license you
          grant us to operate the service.
        </p>
      </section>

      <section>
        <h2>9. Disclaimer &amp; limitation of liability</h2>
        <p>
          The service is provided &quot;as is&quot; to the fullest extent permitted by law. We are not liable for
          indirect, incidental, special, consequential, or punitive damages, or for lost profits, except where
          liability cannot be excluded under applicable consumer protection laws.
        </p>
      </section>

      <section>
        <h2>10. Indemnity</h2>
        <p>
          You will defend and indemnify us against claims arising from your misuse of the service, your club operations,
          or your violation of these Terms, except to the extent caused by our willful misconduct.
        </p>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate access for breach, non‑payment where
          applicable, or legal requirements. Provisions that by nature should survive will survive termination.
        </p>
      </section>

      <section>
        <h2>12. Governing law</h2>
        <p>
          These Terms are governed by the laws of India, subject to mandatory local consumer protections. Courts at
          Bengaluru, Karnataka shall have exclusive jurisdiction, unless another venue is required by law.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p className="muted">
          For contractual or billing questions, use the contact channel in your operator agreement or published support
          email.
        </p>
      </section>
    </article>
  );
}
