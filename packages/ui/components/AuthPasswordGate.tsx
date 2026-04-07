import type { ReactNode } from 'react';

export type SignInMethod = 'email' | 'google';

/**
 * PRD v23: Owner + Customer apps must not show a password field on Google sign-in flows.
 * Wrap password inputs so they render only for email/password (`method === 'email'`).
 */
export function AuthPasswordGate(props: {
  method: SignInMethod;
  children: ReactNode;
}) {
  if (props.method === 'google') return null;
  return <>{props.children}</>;
}
