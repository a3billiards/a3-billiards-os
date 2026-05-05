export default function Privacy() {
  return (
    <article className="legal-doc card">
      <h1>Privacy Policy</h1>
      <p className="legal-meta muted">
        Last updated: May 2026 · A3 Billiards OS onboarding services (India). This policy supplements any in‑app notices.
      </p>

      <section>
        <h2>1. Who we are</h2>
        <p>
          This Privacy Policy describes how we collect, use, store, and share personal information when you use the A3
          Billiards OS onboarding website (registration and subscription renewal). References to &quot;we&quot;,
          &quot;us&quot;, or &quot;the service&quot; mean the operator of this platform.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>
            <strong>Account &amp; identity:</strong> email address, password (stored using secure hashing), name, age,
            and optional phone number.
          </li>
          <li>
            <strong>Club &amp; venue:</strong> club name, address, geocoded coordinates, billing defaults (currency,
            base rate, minimum bill minutes), and timezone.
          </li>
          <li>
            <strong>Payment metadata:</strong> transaction identifiers and amounts processed by our payment partner
            (Razorpay). We do not store full card numbers on our servers.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, browser type, device identifiers, and diagnostic logs needed
            for security and reliability.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <ul>
          <li>Create and secure your owner account and club profile.</li>
          <li>Process subscription payments and renewals and comply with tax / audit obligations.</li>
          <li>Send operational emails (e.g. onboarding confirmation, renewal receipts) where applicable.</li>
          <li>Detect fraud, abuse, and misuse; enforce our Terms.</li>
          <li>Improve performance and troubleshoot issues (including optional analytics where configured).</li>
        </ul>
      </section>

      <section>
        <h2>4. Legal bases &amp; consent</h2>
        <p>
          Where the Digital Personal Data Protection Act, 2023 (India) applies, we rely on your{" "}
          <strong>consent</strong> for onboarding processing that you opt into via the registration checkbox, and on{" "}
          <strong>contractual necessity</strong> to deliver the subscription you purchase. We may also rely on{" "}
          <strong>legal obligations</strong> and <strong>legitimate interests</strong> (e.g. security) where permitted.
        </p>
      </section>

      <section>
        <h2>5. Sharing</h2>
        <p>
          We share data with processors strictly as needed: hosting / backend (Convex), authentication, maps/geocoding
          (Google Maps platform when enabled), payments (Razorpay), and optional observability (e.g. Sentry, PostHog)
          when keys are configured. We do not sell your personal information.
        </p>
      </section>

      <section>
        <h2>6. Retention</h2>
        <p>
          We retain account, club, and billing records for as long as your subscription is active and for a reasonable
          period afterward to meet legal, tax, and dispute‑resolution needs. Draft onboarding data may be removed after
          successful club creation.
        </p>
      </section>

      <section>
        <h2>7. Security</h2>
        <p>
          We use industry‑standard safeguards including TLS in transit, access controls, and hashed passwords. No method
          of transmission or storage is 100% secure; please use a strong, unique password.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          Subject to applicable law, you may request access, correction, deletion, or withdrawal of consent for processing
          based on consent. Contact us using the channel published in your agreement or support documentation. You may
          also lodge a complaint with the Data Protection Board of India when the regime is fully operational.
        </p>
      </section>

      <section>
        <h2>9. International transfers</h2>
        <p>
          Our subprocessors may process data outside India. Where required, we implement appropriate safeguards and
          contractual clauses compatible with Indian requirements.
        </p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be highlighted on this page or through the
          product. Continued use after changes constitutes acceptance where permitted by law.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p className="muted">
          For privacy requests, contact your A3 Billiards OS account representative or the support email published in your
          operator agreement (placeholder until production contact is finalized).
        </p>
      </section>
    </article>
  );
}
