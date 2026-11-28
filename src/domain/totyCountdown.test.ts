import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTotyCountdown,
  isTotyVotingClosed,
  isoToLocalDateAndTime,
  localDateAndTimeToIso,
  parseTotyDeadlineMs,
} from './totyCountdown.ts';

test('parseTotyDeadlineMs handles valid ISO strings and rejects empty or invalid values', () => {
  assert.equal(parseTotyDeadlineMs(undefined), null);
  assert.equal(parseTotyDeadlineMs(''), null);
  assert.equal(parseTotyDeadlineMs('not-a-date'), null);
  assert.equal(parseTotyDeadlineMs('2026-12-05T23:59:00.000Z'), Date.parse('2026-12-05T23:59:00.000Z'));
});

test('computeTotyCountdown computes exact days, hours, minutes, and seconds before deadline', () => {
  const deadline = '2026-12-05T15:30:45.000Z';
  const now = Date.parse('2026-12-03T13:20:15.000Z');
  const snap = computeTotyCountdown(deadline, now);

  assert.deepEqual(snap, {
    configured: true,
    expired: false,
    totalMs: (2 * 86400 + 2 * 3600 + 10 * 60 + 30) * 1000,
    days: 2,
    hours: 2,
    minutes: 10,
    seconds: 30,
  });
  assert.equal(isTotyVotingClosed(deadline, now), false);
});

test('computeTotyCountdown marks expired when current time reaches or passes deadline', () => {
  const deadline = '2026-12-05T15:30:00.000Z';
  const atDeadline = Date.parse(deadline);
  const afterDeadline = atDeadline + 5000;

  assert.deepEqual(computeTotyCountdown(deadline, atDeadline), {
    configured: true,
    expired: true,
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  assert.equal(isTotyVotingClosed(deadline, atDeadline), true);
  assert.equal(isTotyVotingClosed(deadline, afterDeadline), true);
  assert.equal(isTotyVotingClosed(undefined, afterDeadline), false);
});

test('localDateAndTimeToIso and isoToLocalDateAndTime round-trip local date and time accurately', () => {
  const iso = localDateAndTimeToIso('2026-12-10', '21:45');
  assert.ok(iso);
  assert.deepEqual(isoToLocalDateAndTime(iso), { date: '2026-12-10', time: '21:45' });

  // Reject impossible calendar dates (e.g., Feb 31) and malformed inputs
  assert.equal(localDateAndTimeToIso('2026-02-31', '12:00'), null);
  assert.equal(localDateAndTimeToIso('2026-12-10', '25:99'), null);
  assert.equal(localDateAndTimeToIso('', '12:00'), null);
});
