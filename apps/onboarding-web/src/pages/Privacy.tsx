export default function Privacy() {
  return (
    <article className="legal-doc card">
      <h1>Privacy Policy</h1>
      <p className="legal-meta muted">
        <strong>Effective Date:</strong> 06-07-2026 · <strong>Last Updated:</strong> 06-07-2026
      </p>
      <p>
        This Privacy Policy explains how A3 Billiards OS (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;)
        collects, uses, shares, and protects information in connection with{" "}
        <strong>A3 Billiards OS</strong> — comprising the Admin App, Owner App, and Customer App
        (React Native/Expo mobile applications) and the Onboarding Website (collectively, the
        &quot;Service&quot;).
      </p>

      <section>
        <h2>1. Information We Collect</h2>
        <h3>1.1 Account and Identity Information</h3>
        <ul>
          <li>
            <strong>Club Owners and Staff:</strong> name, email address, phone number, assigned role
            and permissions (<code>allowedTabs</code>), club association, and Settings Passcode (stored
            in hashed/secured form).
          </li>
          <li>
            <strong>Customers:</strong> name, phone number, and (optionally) email, used to create and
            identify your account, plus phone verification records generated during OTP sign-up (via
            WhatsApp Business API — we do not use SMS-based OTP or third-party SMS relay providers).
          </li>
          <li>
            <strong>Platform Admins:</strong> name, email, and access-level credentials, restricted to
            authorized platform personnel.
          </li>
        </ul>

        <h3>1.2 Operational and Transactional Data</h3>
        <ul>
          <li>Table/slot status and session records (start/end time, duration, billed amount).</li>
          <li>Booking records (requested date, time, table type, duration, and approval status).</li>
          <li>Snack and kitchen order records.</li>
          <li>
            Billing figures recorded by club Staff for a session (e.g., amount and payment method
            recorded — <strong>note: we do not collect or store card numbers or other payment
            instrument data through the mobile apps</strong>, since in-app payment recording is manual
            and record-only).
          </li>
          <li>
            Customer Complaint records filed by a Club Owner (category, notes) — see Section 4.
          </li>
          <li>
            Club Documents: images of a club&apos;s own physical business documents, uploaded by a Club
            Owner or Staff member for that club&apos;s internal reference only. These are never exposed
            to Customers.
          </li>
          <li>
            GST &amp; Tax Report inputs and outputs (club-level tax configuration and computed estimates)
            — used solely for the Club Owner&apos;s own bookkeeping; see the Terms and Conditions for the
            accompanying disclaimer.
          </li>
          <li>
            Loyalty programme configuration, per-customer play-time logs, and credit balances, where a
            club has an active Loyalty Programme.
          </li>
        </ul>

        <h3>1.3 Live Streaming Data</h3>
        <ul>
          <li>
            When a Club Owner or authorized Staff member starts a broadcast, we process live video and
            audio captured by the broadcasting device&apos;s camera and microphone, and transmit it in
            real time via AWS Interactive Video Service (AWS IVS) to viewing Customers.
          </li>
          <li>
            We do <strong>not</strong> record, archive, or retain broadcast video/audio beyond the live
            transmission in the current phase — streams are live-only, with no video-on-demand or rewind
            capability.
          </li>
          <li>
            We retain limited metadata about each stream (club, title if provided, optional table label,
            start/end time, who started it, best-effort peak viewer count, and how the stream ended) for
            operational and moderation purposes.
          </li>
          <li>
            If a platform Administrator force-ends a stream, the reason provided is logged in an internal
            moderation record for audit purposes.
          </li>
          <li>
            We do not automatically populate any Customer- or session-identifying information into a
            stream&apos;s public title or metadata.
          </li>
        </ul>

        <h3>1.4 Location Data</h3>
        <p>
          The Customer App&apos;s Directions feature uses your device&apos;s current location, with your
          permission, to display a one-time static route preview to a selected club. This location is
          used to render the preview and hand off to your device&apos;s native maps app; it is not
          continuously tracked or stored as a location history by us.
        </p>

        <h3>1.5 Device and Usage Data</h3>
        <ul>
          <li>
            Push notification tokens (Firebase Cloud Messaging) used to deliver session, booking, loyalty,
            and (for Club Owners) live-stream moderation notifications.
          </li>
          <li>
            Standard technical data such as device type, app version, and crash/error diagnostics, used to
            maintain and improve the Service.
          </li>
        </ul>

        <h3>1.6 Data From the Onboarding Website</h3>
        <p>
          Club registration details, email verification status, and subscription/payment status. Payment
          card details for club subscriptions are collected and processed by our payment processor{" "}
          <strong>Razorpay</strong> directly; we do not store full card numbers on our own servers.
        </p>
        <p>We minimize data collection to what is necessary to operate the Service and do not collect biometric data.</p>
      </section>

      <section>
        <h2>2. How We Use Information</h2>
        <p>We use the information described above to:</p>
        <ul>
          <li>
            Operate core features: table/slot management, bookings, billing records, snacks, kitchen
            orders, complaints, document storage, GST/tax estimates, loyalty tracking, walk-in conflict
            alerts, and live streaming;
          </li>
          <li>Authenticate accounts and enforce role-based access control;</li>
          <li>
            Send push notifications relevant to your account (e.g., booking status, loyalty credit
            awards, live-stream moderation actions);
          </li>
          <li>
            Maintain platform safety, including cross-club visibility of Customer Complaint records (see
            Section 4);
          </li>
          <li>Process club subscription billing via our payment processor;</li>
          <li>Comply with legal obligations and enforce our Terms and Conditions.</li>
        </ul>
        <p>
          <strong>
            We do not use your operational or personal data for advertising, and we do not sell your data
            to third parties.
          </strong>
        </p>
      </section>

      <section>
        <h2>3. Data Segregation and Multi-Club Structure</h2>
        <p>Our backend maintains two logical data areas:</p>
        <ul>
          <li>
            <strong>Central Database</strong> — data shared across the platform, such as user accounts,
            Customer Complaint records, notifications, and booking logs. This enables cross-club
            visibility of Customer safety flags and platform-wide features like Live Streaming discovery.
          </li>
          <li>
            <strong>Club Database</strong> — data specific to a single club (sessions, tables, snacks,
            financial records, bookings, club documents, loyalty programme data, kitchen orders, live
            stream records). Club Database data is strictly isolated:{" "}
            <strong>no club can access another club&apos;s operational or financial data.</strong>
          </li>
        </ul>
        <p>
          Within a club, a Club Owner has full visibility into their own club&apos;s data; Staff
          visibility is limited to the sections their assigned role permits.
        </p>
      </section>

      <section>
        <h2>4. Customer Complaints — Cross-Club Visibility</h2>
        <p>
          Unlike most operational data, Customer Complaint records (Violent Behaviour, Theft, Runaway
          Without Payment, Late Credit Payment) are stored centrally and are visible to Club Owners across
          the platform, so that clubs can be aware of safety-relevant history before serving a Customer.
          This is a core safety function of the Service. Complaint records reflect the filing Club
          Owner&apos;s own account of an incident and are not independently verified by us. If you believe
          a Complaint about you is inaccurate, you may contact us using the details in Section 13.
        </p>
      </section>

      <section>
        <h2>5. Live Streaming — Privacy Considerations</h2>
        <p>
          Because a Live Stream is visible to <strong>any authenticated Customer platform-wide</strong>,
          not only customers of the broadcasting club:
        </p>
        <ul>
          <li>
            Broadcasters (Club Owners/Staff) are responsible for what their camera and microphone capture
            and transmit. Anyone appearing on camera during a broadcast, including other customers
            physically present at the club, may be visible to viewers across the platform. Club Owners are
            responsible for ensuring their broadcast practices comply with applicable law regarding filming
            individuals on their premises.
          </li>
          <li>We do not store or archive stream video/audio after a broadcast ends.</li>
          <li>
            Viewer-side data collected is limited to what is needed to grant a short-lived Stream Access
            Token (an access-control mechanism, not a payment gate) and best-effort viewer-count metrics;
            we do not track which specific Customer watched which stream beyond what is operationally
            necessary to serve the token and is not used for profiling.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Data Sharing and Disclosure</h2>
        <p>We share information only as follows:</p>
        <ul>
          <li>
            <strong>Service providers / processors</strong>, strictly to operate the Service:
            <ul>
              <li><strong>Convex</strong> (application backend and database hosting);</li>
              <li><strong>Firebase Cloud Messaging / Google</strong> (push notification delivery);</li>
              <li><strong>WhatsApp Business API / Meta</strong> (OTP delivery for phone verification);</li>
              <li>
                <strong>Amazon Web Services (AWS IVS)</strong> (live video transport and playback);
              </li>
              <li>
                <strong>Razorpay</strong> (club subscription payment processing on the Onboarding Website
                only).
              </li>
            </ul>
          </li>
          <li>
            <strong>Legal compliance</strong> — where required by subpoena, court order, applicable law, or
            to protect the rights, property, or safety of our users or the public.
          </li>
          <li>
            <strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of
            assets, subject to continued protection of your data under a substantially similar policy.
          </li>
        </ul>
        <p>
          We do not sell personal data, and we do not share operational or personal data with third
          parties for their own advertising or marketing purposes.
        </p>
      </section>

      <section>
        <h2>7. Data Security</h2>
        <p>
          We apply industry-standard security measures, including encryption in transit (TLS) and
          role-based access control enforced both in the app and at the backend query level, to protect
          data across all four surfaces of the Service. Access to club-specific data is limited by the
          isolation model described in Section 3, and access to live-stream broadcasting credentials
          (stream keys) is never exposed to any Customer-facing or Admin-facing query — it is resolved
          only transiently, server-side, for the authenticated broadcaster. Despite these measures, no
          method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute
          security.
        </p>
      </section>

      <section>
        <h2>8. Data Retention and Deletion</h2>
        <ul>
          <li>
            We retain account and operational data for as long as an account or club subscription is active
            and as necessary to provide the Service.
          </li>
          <li>
            On account deletion, we apply a grace period (currently 30 days) before permanent removal of
            certain records, after which associated data (e.g., unredeemed loyalty credits) is deleted and
            cannot be recovered. Some historical audit records (e.g., credit award/redemption logs) may be
            retained in anonymized form to preserve accurate club-level reporting without identifying you.
          </li>
          <li>
            Live stream video is not retained beyond the live broadcast; limited stream metadata (see
            Section 1.3) is retained for operational and moderation purposes.
          </li>
          <li>
            You may request deletion of your personal data at any time by contacting us (Section 13),
            subject to any legal retention obligations we may have.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Your Rights</h2>
        <p>Subject to applicable law in your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you;</li>
          <li>Correct inaccurate personal data;</li>
          <li>Request deletion of your personal data;</li>
          <li>Object to or restrict certain processing;</li>
          <li>Receive a copy of your data in a portable format, where applicable.</li>
        </ul>
        <p>
          Club Owners can access, correct, or export their own club&apos;s operational data directly within
          the Owner App. Customers can manage their profile directly within the Customer App or by
          contacting us. Requests can be submitted using the contact details in Section 13.
        </p>
      </section>

      <section>
        <h2>10. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed at, and we do not knowingly collect personal data from, children under
          the age of 18 (or the applicable age of digital consent in your jurisdiction). If we become
          aware that we have inadvertently collected data from a child, we will take steps to delete it.
        </p>
      </section>

      <section>
        <h2>11. International Data Transfers</h2>
        <p>
          Because we use infrastructure providers such as AWS, Google (Firebase), and Meta (WhatsApp
          Business API), your data may be processed or transmitted in countries other than your own. Where
          this occurs, we take reasonable steps to ensure such transfers are subject to appropriate
          safeguards consistent with applicable data protection law.
        </p>
      </section>

      <section>
        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in the Service (for
          example, when new features are introduced) or in applicable law. We will indicate the
          &quot;Last Updated&quot; date above and, for material changes, provide notice through the App or
          by email where practicable.
        </p>
      </section>

      <section>
        <h2>13. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise any of the rights described
          above, contact:
        </p>
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
