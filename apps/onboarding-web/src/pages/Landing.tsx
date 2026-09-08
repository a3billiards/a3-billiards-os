import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

function IconArrow({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 17l6-6 4 4 7-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LANDING_FEATURE_CARDS = [
  {
    label: "Live Tables",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Walk-ins",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM9 22V12l-3 2M13 12l2 10M9 12h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Kitchen & Snacks",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 14c0-4 2.5-7 6-7s6 3 6 7v1H6v-1zM5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Bookings",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="12" cy="15" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Inbox",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6h16v12H4V6zM4 6l8 7 8-7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Complaints",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 5h14v10H8l-3 3V5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M9 10h.01M12 10h.01M15 10h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Reports",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9h-9V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13.5 3.5A8.5 8.5 0 0 1 20.5 10.5H13.5V3.5z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Documents",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M5.1 18.9l1.6-1.6M17.3 6.7l1.6-1.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Passcode",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Club Rates",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M9 9.5c.6-1 1.6-1.5 3-1.5 1.7 0 3 .8 3 2.2S13.7 12 12 12s-3 .7-3 2.2c0 1.4 1.3 2.3 3 2.3 1.4 0 2.4-.5 3-1.5M12 6.5V8M12 16v1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

const LANDING_GOLIVE_STEPS = [
  {
    step: "1",
    title: "Account",
    body: "Create your owner account and verify your email.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    step: "2",
    title: "Club",
    body: "Add your club details — tables, address, and hours.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 10h16v10H4V10zM8 10V6.5A2 2 0 0 1 10 4.5h4a2 2 0 0 1 2 2V10M9 14h2M13 14h2M9 17h2M13 17h2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    step: "3",
    title: "Subscribe",
    body: "Pick a plan and pay securely with Razorpay.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18M7 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "4",
    title: "Go Live",
    body: "Land in the Owner App and start running your floor.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9M3.6 6.6a13 13 0 0 1 16.8 0M20.4 17.4a13 13 0 0 1-16.8 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

const LANDING_REVIEWS = [
  {
    name: "Arjun Mehta",
    role: "Owner, Cue Masters — Bengaluru",
    quote:
      "Walk-ins and table close-outs finally live in one place. Our front desk stopped using paper slips within a week of going live on A3.",
    initials: "AM",
  },
  {
    name: "Priya Nair",
    role: "Manager, Break Point Club — Kochi",
    quote:
      "Staff roles and the settings passcode keep the floor honest. Bookings approvals are clear, and kitchen orders no longer get lost mid-shift.",
    initials: "PN",
  },
  {
    name: "Rohan Desai",
    role: "Owner, Rack & Roll — Pune",
    quote:
      "Financials and GST reports saved us hours every month. We know which tables pay for themselves — and which shifts need a closer look.",
    initials: "RD",
  },
] as const;

export default function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewDir, setReviewDir] = useState<"next" | "prev" | null>(null);
  const [reviewAnimKey, setReviewAnimKey] = useState(0);
  const featuresTitleId = useId();
  const menuTitleId = useId();
  const review = LANDING_REVIEWS[reviewIndex] ?? LANDING_REVIEWS[0];

  const goToReview = (index: number, dir: "next" | "prev") => {
    const next = ((index % LANDING_REVIEWS.length) + LANDING_REVIEWS.length) % LANDING_REVIEWS.length;
    if (next === reviewIndex) return;
    setReviewDir(dir);
    setReviewIndex(next);
    setReviewAnimKey((k) => k + 1);
  };

  const nextReview = () => goToReview(reviewIndex + 1, "next");
  const prevReview = () => goToReview(reviewIndex - 1, "prev");

  useEffect(() => {
    if (!menuOpen && !featuresOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, featuresOpen]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const sections = document.querySelectorAll<HTMLElement>("[data-section-bg]");

    if (reduce) {
      nodes.forEach((el) => el.classList.add("is-in"));
      sections.forEach((el) => el.classList.add("is-in-view"));
      return;
    }

    const revealIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle("is-in", entry.isIntersecting);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((el) => revealIo.observe(el));

    const sectionIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle("is-in-view", entry.isIntersecting);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -4% 0px" },
    );
    sections.forEach((el) => sectionIo.observe(el));

    return () => {
      revealIo.disconnect();
      sectionIo.disconnect();
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="pf-page">
      <div className="pf-void" aria-hidden="true" />
      <div className="pf-top-blur" aria-hidden="true" />

      <header className="pf-header">
        <nav className="pf-nav" aria-label="Main">
          <Link to="/" className="pf-brand" onClick={closeMenu}>
            <img
              className="pf-cue-ball"
              src="/images/small-logo.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
            />
            <span className="pf-brand-text">BILLIARDS OS</span>
          </Link>

          <div className="pf-nav-links">
            <a href="#story">Product</a>
            {/* feature preserved: Features → #features grid + go-live steps */}
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="mailto:support@a3billiards.com">Contact</a>
          </div>

          <div className="pf-nav-actions">
            {!isAuthenticated ? (
              <Link className="pf-link-quiet pf-desktop-only" to="/login">
                Log In
              </Link>
            ) : (
              <>
                <Link className="pf-link-quiet pf-desktop-only" to="/dashboard">
                  Dashboard
                </Link>
                <Link className="pf-link-quiet pf-desktop-only" to="/renew">
                  Renew
                </Link>
              </>
            )}
            <Link className="pf-pill-cta" to="/register">
              <span>Get Started</span>
              <IconArrow />
            </Link>
            <button
              type="button"
              className="pf-burger"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="pf-mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={menuOpen ? "pf-burger-lines is-open" : "pf-burger-lines"}>
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {menuOpen ? (
        <div
          id="pf-mobile-menu"
          className="pf-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby={menuTitleId}
        >
          <button type="button" className="pf-menu-backdrop" aria-label="Close menu" onClick={closeMenu} />
          <div className="pf-menu-panel">
            <div className="pf-menu-head">
              <h2 id={menuTitleId}>Menu</h2>
              <button type="button" className="pf-menu-close" onClick={closeMenu} aria-label="Close">
                ✕
              </button>
            </div>
            <nav className="pf-menu-nav" aria-label="Mobile">
              <a href="#story" onClick={closeMenu}>
                Product
              </a>
              <a href="#features" onClick={closeMenu}>
                Features
              </a>
              <a href="#pricing" onClick={closeMenu}>
                Pricing
              </a>
              <a href="mailto:support@a3billiards.com" onClick={closeMenu}>
                Contact
              </a>
              {!isAuthenticated ? (
                <Link to="/login" onClick={closeMenu}>
                  Log In
                </Link>
              ) : (
                <>
                  <Link to="/dashboard" onClick={closeMenu}>
                    Dashboard
                  </Link>
                  <Link to="/renew" onClick={closeMenu}>
                    Renew
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      void signOut().then(() => {
                        window.location.href = "/login";
                      });
                    }}
                  >
                    Logout
                  </button>
                </>
              )}
              <Link className="pf-menu-cta" to="/register" onClick={closeMenu}>
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      ) : null}

      <main className="pf-main">
        <section className="pf-hero">
          <div className="pf-hero-stage" aria-hidden="true">
            <img
              src="/images/landing-stage.png"
              alt=""
              fetchPriority="high"
              decoding="async"
            />
            <div className="pf-hero-stage-shade" />
          </div>
          <div className="pf-hero-inner">
            <div className="pf-live-pill" data-reveal>
              <span className="pf-live-dot-wrap">
                <span className="pf-live-ping" />
                <span className="pf-live-dot" />
              </span>
              <span>Now onboarding clubs across India</span>
            </div>
            <h1 className="pf-hero-title chrome-text chrome-text--live" data-reveal data-reveal-delay="1">
              Elevate Your
              <br />
              Billiards Experience
            </h1>
            <p className="pf-hero-lede" data-reveal data-reveal-delay="2">
              A3 Billiards OS is the Owner App built for club owners and staff — live tables,
              walk-ins, bookings, snacks, and reporting in one place.{" "}
              <span className="pf-lede-strong">Register. Subscribe. Go live.</span>
            </p>
            <div className="pf-hero-ctas" data-reveal data-reveal-delay="3">
              <Link className="chrome-cta chrome-cta--live" to="/register">
                <span>
                  Get Started <IconArrow />
                </span>
              </Link>
              {!isAuthenticated ? (
                <Link className="pf-ghost-cta" to="/login">
                  Log In
                </Link>
              ) : (
                <Link className="pf-ghost-cta" to="/dashboard">
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </section>

        <section id="story" className="pf-section pf-section--scene" data-section-bg>
          <div className="pf-section-media" aria-hidden="true">
            <img
              src="/images/product-backgound.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="pf-section-media-shade" />
          </div>
          <div className="pf-section-content">
            <div className="pf-section-head" data-reveal>
              <h2>
                Built for the <span className="chrome-text">front desk</span>
              </h2>
              <p>
                Everything you and your staff touch in a day — from a walk-in at table 4 to
                end-of-month reporting — lives in the Owner App.
              </p>
            </div>
            <div className="pf-card-grid">
              <article
                className="rail-card rail-card--photo rail-card--floor"
                data-reveal
                data-reveal-delay="1"
              >
                <div className="rail-card-scrim" aria-hidden="true" />
                <div className="rail-card-body">
                  <div className="pf-card-icon">
                    <IconGrid />
                  </div>
                  <h3>Floor</h3>
                  <p>
                    Live tables and sessions, walk-ins, add time, snacks, and close-out — so the floor
                    stays clear without paper tickets.
                  </p>
                </div>
              </article>
              <article
                className="rail-card rail-card--photo rail-card--staff"
                data-reveal
                data-reveal-delay="2"
                data-photo-bg
              >
                <div className="rail-card-scrim" aria-hidden="true" />
                <div className="rail-card-body">
                  <div className="pf-card-icon">
                    <IconUsers />
                  </div>
                  <h3>Staff</h3>
                  <p>
                    Role-based access, booking approvals, complaints, and a settings passcode that
                    keeps the front desk honest.
                  </p>
                </div>
              </article>
              <article
                className="rail-card rail-card--photo rail-card--business"
                data-reveal
                data-reveal-delay="3"
              >
                <div className="rail-card-scrim" aria-hidden="true" />
                <div className="rail-card-body">
                  <div className="pf-card-icon">
                    <IconTrend />
                  </div>
                  <h3>Business</h3>
                  <p>
                    Billing, inventory, and reporting in one view — so you know which table pays for
                    itself and which shift needs a look.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="features" className="pf-section pf-section--scene pf-features-section" data-section-bg>
          <div className="pf-section-media" aria-hidden="true">
            <img
              src="/images/featureSectiom.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="pf-section-media-shade" />
          </div>
          <div className="pf-section-content">
            <div className="pf-features-intro" data-reveal>
              <p className="pf-features-kicker">Features</p>
              <h2>Everything you need to run your club, effortlessly.</h2>
            </div>
            <div className="pf-feature-grid">
              {LANDING_FEATURE_CARDS.map((card, i) => (
                <article
                  key={card.label}
                  className="pf-feature-tile"
                  data-reveal
                  data-reveal-delay={String((i % 4) + 1)}
                >
                  <span className="pf-feature-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <h3>{card.label}</h3>
                  <span className="pf-feature-rule" aria-hidden="true" />
                </article>
              ))}
            </div>
            <div className="pf-features-cta" data-reveal>
              <Link className="chrome-cta" to="/register">
                <span>
                  Get Started <IconArrow />
                </span>
              </Link>
            </div>
            <p className="pf-features-trust" data-reveal>
              Trusted by club owners
            </p>

            {/* feature preserved: onboarding steps + Quick overview sheet */}
            <div className="pf-golive-panel" data-reveal>
              <div className="pf-golive-inner">
                <h3 className="pf-golive-title">Four steps to go live</h3>
                <div className="pf-golive-track">
                  <div className="pf-golive-progress" aria-hidden="true">
                    <span className="pf-golive-line" />
                    {LANDING_GOLIVE_STEPS.map((item) => (
                      <span key={item.step} className="pf-golive-dot" />
                    ))}
                  </div>
                  <div className="pf-golive-cards">
                    {LANDING_GOLIVE_STEPS.map((item, i) => (
                      <article
                        key={item.step}
                        className="pf-golive-card"
                        data-reveal
                        data-reveal-delay={String(Math.min(i + 1, 4))}
                      >
                        <span className="pf-golive-card-num">{item.step}</span>
                        <span className="pf-golive-card-icon">{item.icon}</span>
                        <h4>{item.title}</h4>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="pf-golive-actions">
                  <button
                    type="button"
                    className="pf-golive-overview"
                    onClick={() => setFeaturesOpen(true)}
                  >
                    Quick overview <IconArrow />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="pf-section pf-section--scene pf-section--pricing"
          data-section-bg
        >
          <div className="pf-section-media" aria-hidden="true">
            <img
              src="/images/pricing-backround.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="pf-section-media-shade" />
          </div>
          <div className="pf-section-content">
            <div className="pf-section-head" data-reveal>
              <h2>Simple pricing, one currency</h2>
              <p>
                First month free on Monthly. Then ₹999/mo. GST added at checkout. Tax invoice issued
                right after you pay.
              </p>
            </div>
            <div className="pf-pricing-grid">
              <article className="pf-price-card" data-reveal data-reveal-delay="1">
                <h3>Monthly</h3>
                <p className="pf-price-sub">First month free. Then pay as you go — cancel any time.</p>
                <div className="pf-price">
                  <span className="pf-rupee">₹</span>
                  <span className="pf-amount">0</span>
                  <span className="pf-period">first month</span>
                </div>
                <p className="pf-price-then">
                  then <strong>₹999</strong>/mo, ex‑GST
                </p>
                <Link className="pf-price-btn" to="/register?plan=monthly">
                  Choose Monthly
                </Link>
              </article>
              <article className="pf-price-card pf-price-featured" data-reveal data-reveal-delay="2">
                <div className="pf-price-badge">Most Popular</div>
                <h3>Yearly</h3>
                <p className="pf-price-sub">Two months free versus monthly.</p>
                <div className="pf-price">
                  <span className="pf-rupee">₹</span>
                  <span className="pf-amount">9,999</span>
                  <span className="pf-period">/yr, ex‑GST</span>
                </div>
                <p className="pf-price-then pf-price-then--spacer" aria-hidden="true">
                  &nbsp;
                </p>
                <Link className="pf-price-btn pf-price-btn-solid" to="/register?plan=yearly">
                  Choose Yearly
                </Link>
              </article>
            </div>
            <p className="pf-pricing-note" data-reveal data-reveal-delay="3">
              Already on A3?{" "}
              <Link to="/renew">Renew your subscription</Link> from your dashboard.
            </p>
          </div>
        </section>

        <section
          id="reviews"
          className="pf-section pf-section--scene pf-section--reviews pf-reviews-section"
          data-section-bg
        >
          <div className="pf-section-media" aria-hidden="true">
            <img
              src="/images/reviews.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="pf-section-media-shade" />
          </div>
          <div className="pf-section-content">
            <div className="pf-reviews-shell" data-reveal>
            <div className="pf-reviews-stack" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="pf-reviews-panel">
              <div className="pf-reviews-cta">
                <h2>Shape your club&apos;s next chapter today</h2>
                <p>
                  Club owners across India already run their floor on A3 — what are you waiting for?
                </p>
                <div className="pf-reviews-actions">
                  {!isAuthenticated ? (
                    <Link className="pf-reviews-demo" to="/login">
                      <span className="pf-reviews-play" aria-hidden="true">
                        ▶
                      </span>
                      Log In
                    </Link>
                  ) : (
                    <Link className="pf-reviews-demo" to="/dashboard">
                      <span className="pf-reviews-play" aria-hidden="true">
                        ▶
                      </span>
                      Dashboard
                    </Link>
                  )}
                  <Link className="pf-reviews-signup" to="/register">
                    Get Started
                  </Link>
                </div>
              </div>

              <div className="pf-reviews-card" aria-live="polite">
                <button
                  type="button"
                  className="pf-reviews-nav pf-reviews-prev"
                  onClick={prevReview}
                  aria-label="Previous review"
                >
                  <IconArrow />
                </button>
                <div
                  key={reviewAnimKey}
                  className={
                    reviewDir ? `pf-reviews-slide is-${reviewDir}` : "pf-reviews-slide"
                  }
                >
                  <div className="pf-reviews-stars" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} aria-hidden="true">
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="pf-reviews-quote">&ldquo;{review.quote}&rdquo;</p>
                  <div className="pf-reviews-author">
                    <span className="pf-reviews-avatar" aria-hidden="true">
                      {review.initials}
                    </span>
                    <div className="pf-reviews-author-meta">
                      <strong>{review.name}</strong>
                      <span>{review.role}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pf-reviews-nav pf-reviews-next"
                  onClick={nextReview}
                  aria-label="Next review"
                >
                  <IconArrow />
                </button>
              </div>
            </div>
            <div className="pf-reviews-dots" role="tablist" aria-label="Reviews">
              {LANDING_REVIEWS.map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  role="tab"
                  aria-selected={i === reviewIndex}
                  className={i === reviewIndex ? "is-active" : undefined}
                  aria-label={`Show review ${i + 1}`}
                  onClick={() => {
                    if (i === reviewIndex) return;
                    const forward =
                      (i - reviewIndex + LANDING_REVIEWS.length) % LANDING_REVIEWS.length;
                    const backward =
                      (reviewIndex - i + LANDING_REVIEWS.length) % LANDING_REVIEWS.length;
                    goToReview(i, forward <= backward ? "next" : "prev");
                  }}
                />
              ))}
            </div>
            </div>
          </div>
        </section>

        <section
          className="pf-section pf-section--scene pf-section--cta-band pf-cta-band"
          data-section-bg
        >
          <div className="pf-section-media" aria-hidden="true">
            <img
              src="/images/finalband.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="pf-section-media-shade" />
          </div>
          <div className="pf-section-content">
            <div className="rail-card pf-cta-card" data-reveal>
              <div className="pf-lamp" aria-hidden="true" />
              <h2 className="chrome-text">Open your Owner App.</h2>
              <p>Register your club today and be running tables from the Owner App by the weekend.</p>
              <Link className="chrome-cta" to="/register">
                <span>
                  Get Started <IconArrow />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="pf-footer" data-reveal>
        <div className="pf-footer-grid">
          <div className="pf-footer-brand">
            <div className="pf-brand pf-footer-logo">
              <img
                className="pf-cue-ball"
                src="/images/small-logo.png"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="pf-brand-text">BILLIARDS OS</span>
            </div>
            <p>
              Owner App for billiards clubs — live tables, walk-ins, bookings, snacks, staff roles,
              billing, inventory, and reporting.
            </p>
            <p className="pf-address">
              Narayan Gowda Layout, 1st Stage,
              <br />
              BTM Layout, Bengaluru, Karnataka 560029
            </p>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              <li>
                <Link to="/login">Log In</Link>
              </li>
              <li>
                <Link to="/register">Register</Link>
              </li>
              <li>
                <Link to="/forgot-password">Forgot Password</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="/renew">Renew Subscription</Link>
              </li>
              {isAuthenticated ? (
                <li>
                  <button
                    type="button"
                    className="pf-footer-logout"
                    onClick={() => {
                      void signOut().then(() => {
                        window.location.href = "/login";
                      });
                    }}
                  >
                    Logout
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <h4>Legal &amp; Support</h4>
            <ul>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link to="/dpdp">DPDP Notice</Link>
              </li>
              <li>
                <a href="mailto:support@a3billiards.com">support@a3billiards.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pf-watermark" aria-hidden="true">
          A3 BILLIARDS
        </div>

        <div className="pf-footer-bottom">
          <p>© 2026 A3 Billiards OS. All rights reserved.</p>
          <p>Made for club owners across India</p>
        </div>
      </footer>

      {featuresOpen ? (
        <div
          className="landing-features-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={featuresTitleId}
        >
          <div className="landing-features-sheet-card">
            <h2 id={featuresTitleId}>How onboarding works</h2>
            <p>
              Register your club, verify your email, choose a subscription, and start using the Owner
              App.
            </p>
            <div className="landing-steps">
              <span className="landing-step">1 · Account</span>
              <span className="landing-step">2 · Club</span>
              <span className="landing-step">3 · Subscribe</span>
              <span className="landing-step">4 · Go live</span>
            </div>
            <div className="landing-features-sheet-actions">
              <Link className="landing-sheet-cta" to="/register">
                Get Started
              </Link>
              <button
                type="button"
                className="landing-sheet-close"
                onClick={() => setFeaturesOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
