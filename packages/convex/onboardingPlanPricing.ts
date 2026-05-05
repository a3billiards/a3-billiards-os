/** Shared subscription plan amounts for onboarding web (env-backed). */

export type OnboardingPlanId = "monthly" | "yearly";

export type OnboardingPlanRow = {
  id: OnboardingPlanId;
  label: string;
  periodMs: number;
  amountPaise: number;
  currency: "INR";
};

const DAY_MS = 86_400_000;

export function listOnboardingPlansFromEnv(): OnboardingPlanRow[] {
  const monthlyPaise = Number(process.env.RAZORPAY_PLAN_MONTHLY_PAISE ?? "99900");
  const yearlyPaise = Number(process.env.RAZORPAY_PLAN_YEARLY_PAISE ?? "999900");
  return [
    {
      id: "monthly",
      label: "Monthly",
      periodMs: 30 * DAY_MS,
      amountPaise: Number.isFinite(monthlyPaise) ? monthlyPaise : 99900,
      currency: "INR",
    },
    {
      id: "yearly",
      label: "Yearly",
      periodMs: 365 * DAY_MS,
      amountPaise: Number.isFinite(yearlyPaise) ? yearlyPaise : 999900,
      currency: "INR",
    },
  ];
}
