/** Growth program, monetization and withdrawals: the shapes App\Domain\Growth and the monetization pages return. */

import type { Labeled } from "@/types/wallet";

export type GoalMetric = "episodes" | "lives" | "streak" | "subscribers" | "live_peak";

export type StreakState = "fresh" | "active" | "at_risk" | "broken";

export interface Goal {
  key: string;
  metric: GoalMetric;
  title: string;
  description: string;
  target: number;
  current: number;
  achieved: boolean;
  achieved_at: string | null;
  /** Unlocked during the last days. */
  recent: boolean;
  /** Unlocked by this very visit. */
  fresh: boolean;
}

export interface Streak {
  current: number;
  best: number;
  active_today: boolean;
  state: StreakState;
  headline: string;
  message: string;
  next_target: number | null;
}

export interface ActivityDay {
  date: string;
  live: boolean;
  episode: boolean;
  peak: number;
}

/** App\Domain\Monetization\Support\Eligibility::toArray() plus the approval date. */
export interface MonetizationProgress {
  eligible: boolean;
  monetized_at: string | null;
  subscribers: { current: number; target: number; met: boolean };
  live: {
    threshold: number;
    days_required: number;
    best_run: number;
    best_run_days: { date: string; peak: number }[];
    current_run: number;
    recent_days: { date: string; peak: number; qualifies: boolean }[];
    met: boolean;
  };
}

/** App\Domain\Growth\GrowthProgram::snapshot() */
export interface GrowthSnapshot {
  today: string;
  metrics: { episodes: number; lives: number; best_peak: number; subscribers: number };
  streak: Streak;
  calendar: ActivityDay[];
  goals: Goal[];
  next_goal: Goal | null;
  achieved_count: number;
  recent: Goal[];
  monetization: MonetizationProgress;
}

/** App\Domain\Growth\GrowthProgram::summary(), for the studio dashboard. */
export interface GrowthSummary {
  streak: Streak;
  week: ActivityDay[];
  next_goal: Goal | null;
  achieved_count: number;
  total_goals: number;
  latest_achievement: Goal | null;
  monetization: {
    eligible: boolean;
    monetized_at: string | null;
    subscribers: { current: number; target: number; met: boolean };
    live: { threshold: number; days_required: number; best_run: number };
  };
}

export type MonetizationRequestStatus = "pending" | "approved" | "rejected";

/** App\Http\Resources\MonetizationRequestResource */
export interface MonetizationRequestRow {
  id: number;
  status: Labeled<MonetizationRequestStatus>;
  subscribers: number;
  snapshot: {
    subscribers: number;
    min_subscribers: number;
    live_listeners: number;
    live_days: number;
    qualifying_days: { date: string; peak: number }[];
  };
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  station?: { id: number; display_name: string; slug: string; follower_count: number; owner: { name: string; email: string } | null };
  requester?: string | null;
  reviewer?: string | null;
}

export type WithdrawalStatus = "pending" | "paid" | "rejected";

export type PayoutMethodValue = "bank_transfer" | "yape" | "plin" | "paypal";

export interface PayoutMethodOption {
  value: PayoutMethodValue;
  label: string;
  account_label: string;
  needs_bank: boolean;
}

/** App\Http\Resources\WithdrawalRequestResource */
export interface WithdrawalRow {
  id: number;
  amount_cents: number;
  currency: string;
  status: Labeled<WithdrawalStatus>;
  payout_method: Labeled<PayoutMethodValue>;
  destination: string;
  /** Only for staff allowed to pay withdrawals. */
  payout_details?: { holder: string; account: string; bank: string | null };
  paid_reference: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  station?: { id: number; display_name: string; slug: string; monetized: boolean };
  requester?: { name: string; email: string } | null;
  reviewer?: string | null;
}
