import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export type LegalTocItem = { id: string; label: string };

type Props = {
  title: string;
  toc: LegalTocItem[];
  children: ReactNode;
  effectiveDate?: string;
  lastUpdated?: string;
  intro?: ReactNode;
  contactHref?: string;
};

export function LegalPage({
  title,
  toc,
  children,
  effectiveDate,
  lastUpdated,
  intro,
  contactHref = "mailto:a3billiards@gmail.com",
}: Props) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [activeId, setActiveId] = useState(toc[0]?.id ?? "");

  useEffect(() => {
    const nodes = toc
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node != null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActiveId(id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.1, 0.25, 0.5] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="dash-page legal-shell">
      <div className="dash-stage" aria-hidden="true">
        <img className="dash-stage-art" src="/images/auth-hero.png" alt="" draggable={false} />
        <div className="dash-stage-shade" />
      </div>

      <div className="dash-scroll">
        <header className="dash-topnav">
          <Link to="/" className="dash-brand">
            <img
              className="dash-brand-mark"
              src="/images/small-logo.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            A3 BILLIARDS OS
          </Link>
          <nav className="dash-nav" aria-label="Main">
            {!isAuthenticated ? <Link to="/register">Register</Link> : null}
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/renew">Renew</Link>
                <button
                  type="button"
                  className="dash-logout is-outlined"
                  onClick={() => {
                    void signOut().then(() => {
                      window.location.href = "/login";
                    });
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </nav>
        </header>

        <div className="legal-layout">
          <aside className="legal-aside">
            <p className="legal-toc-kicker">On this page</p>
            <nav className="legal-toc" aria-label="On this page">
              {toc.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={activeId === item.id ? "is-active" : undefined}
                >
                  {index + 1}. {item.label}
                </a>
              ))}
            </nav>

            <div className="legal-contact-card">
              <span className="legal-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M12 3l8 3.5v6c0 5-3.4 8.4-8 9.8C7.4 20.9 4 17.5 4 12.5v-6L12 3z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 12.2l2.2 2.2 4.8-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="legal-contact-title">Your privacy matters</p>
              <p className="legal-contact-copy">
                Questions about this document? Reach us by email and we will help.
              </p>
              <a className="legal-contact-btn" href={contactHref}>
                Contact us
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </aside>

          <article className="dash-card legal-card">
            <div className="legal-card-head">
              <div>
                <h1 className="legal-card-title">{title}</h1>
                {effectiveDate || lastUpdated ? (
                  <div className="legal-dates">
                    {effectiveDate ? (
                      <p>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Effective Date: {effectiveDate}
                      </p>
                    ) : null}
                    {lastUpdated ? (
                      <p>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M12 8v4.5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Last Updated: {lastUpdated}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {intro}
              </div>
              <div className="legal-hero" aria-hidden="true">
                <video
                  className="dash-hero-video"
                  src="/videos/eightball-smoke.mp4"
                  poster="/images/auth-hero.png"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="dash-hero-fade" />
              </div>
            </div>

            <div className="legal-prose">{children}</div>
          </article>
        </div>

        <footer className="dash-footer legal-page-footer">
          <nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/dpdp">DPDP</Link>
          </nav>
          <a className="dash-support" href="mailto:support@a3billiards.com">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <path
                d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 12v5a2 2 0 0 0 2 2h2v-6H4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 19v1a2.5 2.5 0 0 0 2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            support@a3billiards.com
          </a>
        </footer>
      </div>
    </div>
  );
}
