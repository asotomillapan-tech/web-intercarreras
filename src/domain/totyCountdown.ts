export interface TotyCountdownSnapshot {
  configured: boolean;
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Parses an ISO-8601 deadline string into epoch milliseconds, returning null if empty or invalid.
 */
export function parseTotyDeadlineMs(deadlineIso?: string | null): number | null {
  if (!deadlineIso || typeof deadlineIso !== 'string') return null;
  const trimmed = deadlineIso.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Returns true if a valid TOTY voting deadline is set and has already passed.
 */
export function isTotyVotingClosed(
  deadlineIso?: string | null,
  nowMs: number = Date.now()
): boolean {
  const targetMs = parseTotyDeadlineMs(deadlineIso);
  if (targetMs === null) return false;
  return nowMs >= targetMs;
}

/**
 * Computes the remaining days, hours, minutes, and seconds until the TOTY voting deadline.
 */
export function computeTotyCountdown(
  deadlineIso?: string | null,
  nowMs: number = Date.now()
): TotyCountdownSnapshot {
  const targetMs = parseTotyDeadlineMs(deadlineIso);
  if (targetMs === null) {
    return {
      configured: false,
      expired: false,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const diffMs = Math.max(0, targetMs - nowMs);
  if (diffMs === 0) {
    return {
      configured: true,
      expired: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    configured: true,
    expired: false,
    totalMs: diffMs,
    days,
    hours,
    minutes,
    seconds,
  };
}

function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

/**
 * Splits an ISO timestamp into local YYYY-MM-DD and HH:mm values for HTML date/time inputs.
 */
export function isoToLocalDateAndTime(deadlineIso?: string | null): {
  date: string;
  time: string;
} {
  const ms = parseTotyDeadlineMs(deadlineIso);
  if (ms === null) return { date: '', time: '' };
  const d = new Date(ms);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * Combines local YYYY-MM-DD and HH:mm inputs into a valid UTC ISO-8601 string.
 */
export function localDateAndTimeToIso(dateStr: string, timeStr: string): string | null {
  const dMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const tMatch = /^(\d{2}):(\d{2})$/.exec((timeStr || '23:59').trim());
  if (!dMatch || !tMatch) return null;

  const year = Number(dMatch[1]);
  const month = Number(dMatch[2]);
  const day = Number(dMatch[3]);
  const hour = Number(tMatch[1]);
  const minute = Number(tMatch[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    !Number.isFinite(localDate.getTime()) ||
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null;
  }

  return localDate.toISOString();
}

/**
 * Formats a deadline ISO timestamp in human-readable Chilean Spanish (e.g. "5 dic 2026 · 23:59").
 */
export function formatTotyDeadlineDisplay(deadlineIso?: string | null): string {
  const ms = parseTotyDeadlineMs(deadlineIso);
  if (ms === null) return '';
  try {
    const d = new Date(ms);
    const datePart = d.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return deadlineIso || '';
  }
}
