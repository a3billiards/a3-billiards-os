import { Link } from "react-router-dom";

export default function DPDP() {
  return (
    <article className="legal-doc card">
      <h1>DPDP — Data processing notice</h1>
      <p className="legal-meta muted">
        Summary aligned with the Digital Personal Data Protection Act, 2023 (India). This page is informational and does
        not replace legal advice or executed data‑processing agreements.
      </p>

      <section>
        <h2>Data fiduciary</h2>
        <p>
          For onboarding personal data collected through this website, the operator of A3 Billiards OS acts as the{" "}
          <strong>Data Fiduciary</strong> (or appoints a clearly identified fiduciary in your enterprise agreement).
        </p>
      </section>

      <section>
        <h2>Personal data collected</h2>
        <ul>
          <li>Identifiers: name, email, optional phone.</li>
          <li>Credentials: password (hashed).</li>
          <li>Commercial: club profile, venue address and coordinates, billing defaults.</li>
          <li>Transactional: payment references via Razorpay.</li>
          <li>Technical: logs and security telemetry.</li>
        </ul>
      </section>

      <section>
        <h2>Purpose &amp; lawful grounds</h2>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Ground</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Owner signup &amp; authentication</td>
              <td>Consent + performance of contract</td>
            </tr>
            <tr>
              <td>Club creation after successful payment</td>
              <td>Performance of contract</td>
            </tr>
            <tr>
              <td>Renewals &amp; receipts</td>
              <td>Performance of contract + legal / tax compliance</td>
            </tr>
            <tr>
              <td>Security monitoring</td>
              <td>Legitimate interests / compliance</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Data principals&apos; rights</h2>
        <p>
          Where applicable, you may exercise rights to access, correction, erasure (where not prohibited), grievance
          redressal, and nominate a representative. Withdrawal of consent may limit our ability to provide the service.
          Grievance escalation paths will be published alongside production support contacts.
        </p>
      </section>

      <section>
        <h2>Processors</h2>
        <p>
          We engage certified subprocessors (e.g. Convex for backend, Razorpay for payments, Google Maps for geocoding
          when enabled). Agreements impose confidentiality, security, and deletion obligations consistent with DPDP Rules
          as they evolve.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          The service is not directed to minors under 18. We do not knowingly collect personal data from users below the
          onboarding age gate.
        </p>
      </section>

      <section>
        <h2>Breach notification</h2>
        <p>
          We maintain incident response procedures and will notify affected users and authorities when required by law.
        </p>
      </section>

      <p className="muted">
        See also the full <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of Service</Link>.
      </p>
    </article>
  );
}
