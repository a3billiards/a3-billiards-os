import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <article className="legal-doc card">
      <h1>Terms and Conditions</h1>
      <p className="legal-meta muted">
        <strong>Effective Date:</strong> 06-07-2026 · <strong>Last Updated:</strong> 06-07-2026
      </p>

      <section>
        <h2>1. Agreement to Terms and Parties</h2>
        <p>
          These Terms and Conditions (&quot;Agreement,&quot; &quot;Terms&quot;) govern access to and use of{" "}
          <strong>A3 Billiards OS</strong> (the &quot;Product,&quot; &quot;Service,&quot; or
          &quot;Platform&quot;), a multi-panel software-as-a-service application comprising the A3 Billiards
          OS Admin App, Owner App, and Customer App (each a mobile application built with React Native/Expo),
          and the A3 Billiards OS Onboarding Website (collectively, the &quot;Apps&quot;), together with the
          shared backend infrastructure that powers them.
        </p>
        <p>
          This Agreement is between you and <strong>A3 Billiards OS</strong>, a company registered at A3, 1st
          Floor at 167 &amp; 168, Tavarekere Main Road, near Mytri Mart and Sahity PG in Narayan Gowda
          Layout, 1st Stage, BTM Layout, Bengaluru, Karnataka 560029 (&quot;we,&quot; &quot;us,&quot;
          &quot;our,&quot; &quot;Company&quot;). If a payment processor or merchant of record is used for
          any transaction (see Section 7), the applicable checkout terms of that processor also apply to that
          transaction.
        </p>
        <p>
          By downloading, installing, accessing, or using any of the Apps, you agree to be bound by this
          Agreement. If you do not agree, you must not use the Service. If you are using the Service on
          behalf of a business (e.g., as a Club Owner registering a billiards club), you represent that you
          have authority to bind that business to this Agreement.
        </p>
      </section>

      <section>
        <h2>2. Definitions</h2>
        <ul>
          <li>
            <strong>&quot;Club Owner&quot;</strong> — an individual or business that registers a billiards
            club account via the Onboarding Website and operates the Owner App for that club. Each club is a
            separate, independently managed account; there is no multi-club login in the current version of
            the Service.
          </li>
          <li>
            <strong>&quot;Staff&quot;</strong> — an individual granted restricted access to the Owner App by
            a Club Owner, with permissions scoped by role (e.g., access to Slots, Snacks, Financials,
            Complaints, Bookings, Documents, Kitchen, Loyalty, or Live Stream functions only, as configured
            by the Club Owner).
          </li>
          <li>
            <strong>&quot;Customer&quot;</strong> — an end-user who uses the Customer App to discover clubs,
            book tables, view session history, track loyalty status, or watch live streams.
          </li>
          <li>
            <strong>&quot;Admin&quot;</strong> — a platform-level administrator employed or authorized by the
            Company with global oversight of the Platform.
          </li>
          <li>
            <strong>&quot;Booking&quot;</strong> — an online reservation request submitted by a Customer for
            a table at a specific club, subject to Club Owner approval.
          </li>
          <li>
            <strong>&quot;Session&quot;</strong> — a table booking from start to checkout, whether originating
            from a walk-in or a Booking.
          </li>
          <li>
            <strong>&quot;Live Stream&quot;</strong> — a real-time video broadcast initiated by a Club Owner
            or authorized Staff member from the Owner App, viewable by Customers platform-wide.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Consumer Right of Withdrawal (Digital Content)</h2>
        <p>
          Where you purchase a paid subscription for club access through the Onboarding Website, that
          content is digital and is made available to you promptly upon purchase. By completing checkout and
          beginning to use the subscription, you acknowledge that, to the extent permitted by applicable law,
          your statutory right of withdrawal or cancellation for digital content may be waived once
          performance has begun. This does not affect any separate refund policy we may publish for initial
          purchases, nor any non-waivable consumer protection rights available to you under mandatory law in
          your jurisdiction.
        </p>
      </section>

      <section>
        <h2>4. Eligibility and Accounts</h2>
        <ul>
          <li>
            You must be at least 18 years old, or the age of legal majority in your jurisdiction, to register
            as a Club Owner or to hold a Customer account. The Service is not directed at children, and we do
            not knowingly permit children to create accounts.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your login credentials and Settings
            Passcode (a separate 6-digit PIN used to gate the Owner App&apos;s Settings panel and
            Staff-to-Owner mode transitions), and for all activity that occurs under your account.
          </li>
          <li>
            Phone number verification is performed via One-Time Password (OTP) delivered through WhatsApp
            Business API. We do not use SMS-based OTP or third-party SMS relay services for this purpose.
          </li>
          <li>
            You must notify us promptly if you become aware of any unauthorized use of your account or any
            security breach.
          </li>
          <li>
            We are not responsible for failures to deliver the Service caused by inaccurate account or
            contact information you provide.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Description of the Service</h2>
        <p>
          A3 Billiards OS is an operations platform for billiards club owners and their customers. Depending
          on the App and your role, the Service may include:
        </p>
        <ul>
          <li>
            <strong>Table/Slot Management</strong> — tracking table availability and session status in real
            time.
          </li>
          <li>
            <strong>Online Booking</strong> — Customers may request table reservations, subject to Club Owner
            approval; bookings are reservation-only and do not currently include in-app deposit or payment
            collection.
          </li>
          <li>
            <strong>Billing and Checkout</strong> — session charges, snack orders, and discounts are recorded
            within the app for the Club Owner&apos;s own bookkeeping; see Section 7 regarding payment
            processing scope.
          </li>
          <li>
            <strong>Customer Complaints</strong> — Club Owners may flag a Customer&apos;s account under
            defined categories (Violent Behaviour, Theft, Runaway Without Payment, Late Credit Payment). See
            Section 10.
          </li>
          <li>
            <strong>Document Holder</strong> — Club Owners may photograph and store images of the club&apos;s
            own physical business documents within the Owner App for their internal reference.
          </li>
          <li>
            <strong>Directions</strong> — the Customer App may show a static in-app map preview of the route
            to a club and hand off to your device&apos;s native maps app for full navigation.
          </li>
          <li>
            <strong>GST &amp; Tax Report</strong> — an owner-facing tool that produces estimated GST and
            profit-and-loss figures for the club&apos;s own bookkeeping convenience.
          </li>
          <li>
            <strong>Kitchen &amp; Chef Role</strong> — order tracking for a club&apos;s snack/kitchen
            operations.
          </li>
          <li>
            <strong>Membership Loyalty</strong> — a Club Owner-configurable programme that automatically
            tracks Customer play-time and awards free-visit credits according to rules the Club Owner sets.
          </li>
          <li>
            <strong>Walk-In Booking Conflict Alert</strong> — an advisory, in-app notice shown to
            Staff/Owners when starting a walk-in session on a table with a near-term confirmed booking.
          </li>
          <li>
            <strong>Live Streaming</strong> — Club Owners and authorized Staff may broadcast live video from
            the Owner App; any authenticated Customer, platform-wide, may view any club&apos;s active stream
            at no charge. See Section 9 for specific terms governing this feature.
          </li>
        </ul>
        <p>
          Features available to you depend on your role and the permissions configured by the relevant Club
          Owner or Company Admin. We may add, modify, or remove features at our discretion.
        </p>
      </section>

      <section>
        <h2>6. Multi-Club Data Structure and Staff Access</h2>
        <p>
          Each club operates as an independent account. Financial, operational, and customer-interaction data
          associated with one club (e.g., sessions, bookings, snacks, financial records, loyalty ledgers,
          kitchen orders, club documents) is logically isolated from every other club within our backend and
          is not accessible to other Club Owners. Certain identity and safety-related information (e.g.,
          basic Customer account identity and Complaint records) is shared across clubs by design, so that all
          clubs can benefit from a shared customer-safety history — see the{" "}
          <Link to="/privacy">Privacy Policy</Link> for details.
        </p>
        <p>
          Staff access within a club&apos;s Owner App is restricted according to the roles and permissions (
          <code>allowedTabs</code>) configured by that club&apos;s Owner. A Club Owner is responsible for the
          accuracy of role assignments and for any actions taken by Staff under their club&apos;s account.
        </p>
      </section>

      <section>
        <h2>7. Subscriptions, Billing, and Payments</h2>
        <ul>
          <li>
            <strong>Club subscriptions</strong> are sold to Club Owners through the Onboarding Website.
            Payment processing for club subscriptions is handled by <strong>Razorpay</strong> as our payment
            processor. By subscribing, you also agree to that processor&apos;s applicable checkout and
            consumer terms.
          </li>
          <li>
            <strong>In-app payments within the mobile apps are record-only.</strong> The Owner App allows
            Staff to record how a Customer paid for a session (e.g., cash, card terminal, UPI, or credit) for
            the Club Owner&apos;s own bookkeeping.{" "}
            <strong>
              No card data or other payment instrument data is collected, transmitted, or stored by the
              mobile apps themselves
            </strong>
            , and no in-app payment processing occurs within the Owner, Customer, or Admin Apps in the current
            version of the Service. Booking-time deposits and in-app booking payments are not currently
            supported.
          </li>
          <li>
            Failure to pay a club subscription fee when due may result in suspension or restriction of that
            club&apos;s access to the Owner App and related features (a &quot;frozen&quot; or &quot;grace&quot;
            state), as described further in the Service&apos;s account-status handling.
          </li>
          <li>
            Live Streaming, as described in Section 9, carries no separate fee, subscription, or pay-per-view
            charge to Customers or Club Owners in the current phase, and is subject to change with notice.
          </li>
          <li>
            There are no refunds for unused subscription periods except as required by applicable law or as
            set out in a separate refund policy we may publish.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. GST &amp; Tax Report Disclaimer</h2>
        <p>
          The GST &amp; Tax Report feature produces <strong>estimates for the Club Owner&apos;s own internal
          bookkeeping convenience only</strong>. It is not tax, legal, or accounting advice, does not file or
          submit anything to any government portal on your behalf, and does not account for
          multi-state/multi-GSTIN apportionment, asset-level depreciation, partner-remuneration deductions, or
          surcharge-slab automation.{" "}
          <strong>
            A3 Billiards OS is not a substitute for a qualified Chartered Accountant, tax advisor, or filing
            software
          </strong>
          , and we make no guarantee as to the statutory accuracy of any figure the Service produces. You are
          solely responsible for your club&apos;s tax compliance.
        </p>
      </section>

      <section>
        <h2>9. Live Streaming — Additional Terms</h2>
        <p>
          Because Live Streaming makes a club&apos;s broadcast visible to{" "}
          <strong>any authenticated Customer platform-wide</strong>, regardless of whether they are a
          customer of that specific club, the following additional terms apply:
        </p>
        <ul>
          <li>
            <strong>Broadcaster responsibility.</strong> If you broadcast (as a Club Owner or authorized
            Staff member), you are solely responsible for the content of your broadcast. You must have the
            right to broadcast whatever is shown on camera and must not broadcast unlawful content, content
            that infringes another person&apos;s rights, or content that violates this Agreement.
          </li>
          <li>
            <strong>No auto-inclusion of identifying data.</strong> The Service is designed so that no
            Customer- or session-identifying information (names, phone numbers, booking details) is
            automatically included in a stream&apos;s public title or metadata; you are responsible for not
            manually disclosing such information in a title you choose to type.
          </li>
          <li>
            <strong>License to transmit.</strong> By broadcasting, you grant us a non-exclusive, worldwide,
            royalty-free license to transmit, distribute, and display your broadcast in real time to Customers
            using the Service, solely for the purpose of operating the Live Streaming feature. You retain
            ownership of your broadcast content. We do not record, archive, or create video-on-demand copies
            of streams in the current phase.
          </li>
          <li>
            <strong>No payment gate; free to view.</strong> Viewing is free to any authenticated Customer in
            the current phase. We may introduce payment, subscription, or access tiers in the future with
            notice.
          </li>
          <li>
            <strong>One active stream per club; no external hardware.</strong> Broadcasting is limited to one
            simultaneous stream per club, via the in-app broadcast tool using your device&apos;s camera.
            Multi-camera setups, external capture hardware, and screen-sharing are not supported.
          </li>
          <li>
            <strong>Moderation and force-end.</strong> We reserve the right, through platform Admins, to
            immediately terminate (&quot;force-end&quot;) any live broadcast at any time, with a logged reason,
            including where we believe content violates this Agreement, applicable law, or is otherwise
            inappropriate. We may retain a log of force-end actions for audit purposes. We do not currently
            offer a Customer-facing content-reporting mechanism; moderation in this phase is
            administrator-initiated only.
          </li>
          <li>
            <strong>Best-effort metrics.</strong> Viewer counts and similar metrics displayed during a
            broadcast are best-effort estimates, not guaranteed real-time-accurate figures.
          </li>
          <li>
            <strong>No warranty of continuous availability.</strong> Live video delivery depends on third-party
            infrastructure (see Section 12) and your and viewers&apos; network conditions; we do not guarantee
            uninterrupted streaming or a specific latency.
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Customer Complaints System</h2>
        <p>
          Club Owners may record a Complaint against a Customer&apos;s account under one of four defined
          categories (Violent Behaviour, Theft, Runaway Without Payment, Late Credit Payment). Complaints are
          visible to other Club Owners on the platform as part of a shared customer-safety record.{" "}
          <strong>
            Complaints reflect the reporting Club Owner&apos;s own account of events and are not independently
            verified by us.
          </strong>{" "}
          We do not adjudicate disputes between Club Owners and Customers regarding the accuracy of a
          Complaint. If you believe a Complaint filed against you is inaccurate, contact us using the details
          in Section 19; we may, at our discretion, review the record, but filing, correcting, or removing a
          Complaint is generally the responsibility of the Club Owner who filed it.
        </p>
      </section>

      <section>
        <h2>11. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law;</li>
          <li>
            Attempt to circumvent role-based access controls, staff permission restrictions, or club data
            isolation;
          </li>
          <li>
            Extract, scrape, or resell data made available through the Service, including live stream content,
            without our prior written consent;
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the Service, including its live streaming
            or payment-recording functionality;
          </li>
          <li>Impersonate another person or misrepresent your affiliation with a club;</li>
          <li>
            Upload or broadcast content that is defamatory, obscene, infringing, or otherwise unlawful.
          </li>
        </ul>
        <p>We reserve the right to suspend or terminate access for violation of this Section.</p>
      </section>

      <section>
        <h2>12. Third-Party Services</h2>
        <p>
          The Service relies on the following third-party infrastructure providers, each governed by their
          own terms and privacy practices in addition to this Agreement:
        </p>
        <ul>
          <li><strong>Convex</strong> — application backend and database.</li>
          <li><strong>Firebase Cloud Messaging (Google)</strong> — push notification delivery.</li>
          <li><strong>WhatsApp Business API (Meta)</strong> — one-time password delivery for phone verification.</li>
          <li>
            <strong>Amazon Web Services — Interactive Video Service (AWS IVS)</strong> — live video ingest,
            transport, and playback for the Live Streaming feature.
          </li>
          <li>
            <strong>Razorpay</strong> — payment processing for club subscriptions via the Onboarding Website
            only.
          </li>
        </ul>
        <p>
          We are not responsible for the acts or omissions of these third-party providers, though we take
          reasonable steps to select providers with appropriate security practices.
        </p>
      </section>

      <section>
        <h2>13. Intellectual Property</h2>
        <p>
          The Service, including its software, design, trademarks, and branding, is owned by us or our
          licensors and is protected by intellectual property laws. Except for the limited license to use the
          Service as intended, no rights are transferred to you. Club Owners and Customers retain ownership of
          content they upload or broadcast (e.g., club documents, live stream video), subject to the license
          granted in Section 9.
        </p>
      </section>

      <section>
        <h2>14. Termination and Suspension</h2>
        <p>
          We may suspend or terminate your access to the Service, without prior notice, if we believe you have
          violated this Agreement, if fraudulent or unlawful activity is suspected, or if a club&apos;s
          subscription lapses. Termination does not affect any rights or obligations that accrued before
          termination, including any amounts owed. Club Owners may close their own club account at any time
          by contacting us; certain data may be retained as described in the{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>15. Disclaimers and Limitation of Liability</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any
          kind, express or implied, to the fullest extent permitted by law, including as to merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be
          uninterrupted, error-free, or secure.
        </p>
        <p>
          To the fullest extent permitted by law, we and our affiliates will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including loss of profits, revenue, data,
          goodwill, or business opportunity, arising from or related to your use of, or inability to use, the
          Service — including any Live Stream content, GST/Tax Report figures, or Complaint record accuracy.
        </p>
      </section>

      <section>
        <h2>16. Indemnification</h2>
        <p>
          You agree to indemnify and hold us harmless from any claims, damages, liabilities, and expenses
          (including reasonable legal fees) arising from your use of the Service, your violation of this
          Agreement, your broadcast content, or your violation of any third party&apos;s rights.
        </p>
      </section>

      <section>
        <h2>17. Governing Law and Dispute Resolution</h2>
        <p>
          This Agreement is governed by the laws of <strong>India</strong>, without regard to its
          conflict-of-laws principles. Any dispute arising out of or relating to this Agreement will be
          subject to the exclusive jurisdiction of the courts located in <strong>Bengaluru, India</strong>.
        </p>
      </section>

      <section>
        <h2>18. Changes to This Agreement</h2>
        <p>
          We may update this Agreement from time to time. Material changes will be notified through the App
          or by email where practicable. Continued use of the Service after changes take effect constitutes
          acceptance of the revised Agreement.
        </p>
      </section>

      <section>
        <h2>19. Contact Us</h2>
        <p>Questions about this Agreement can be directed to:</p>
        <p>
          <strong>A3 Billiards OS</strong>
          <br />
          Email: <a href="mailto:a3billiards@gmail.com">a3billiards@gmail.com</a>
          <br />
          Address: A3, 1st Floor at 167 &amp; 168, Tavarekere Main Road, near Mytri Mart and Sahity PG in
          Narayan Gowda Layout, 1st Stage, BTM Layout, Bengaluru, Karnataka 560029
        </p>
      </section>
    </article>
  );
}
