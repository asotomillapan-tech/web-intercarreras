import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFirestoreError,
  computeSyncHealthSummary,
  createInitialSyncHealthState,
  markSyncStreamHealthy,
  PUBLIC_READ_DEGRADED_NOTICE,
  recordSyncIncident,
  shouldEmitThrottledQuotaLog,
  shouldShowPublicReadNotice,
} from './syncHealthEngine';

test('classifyFirestoreError detects quota_exceeded, permission_denied, network, and unknown errors', () => {
  assert.equal(
    classifyFirestoreError(
      new Error(
        "Quota limit exceeded. Cause - Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
      )
    ),
    'quota_exceeded'
  );
  assert.equal(classifyFirestoreError({ code: 'resource-exhausted', message: '' }), 'quota_exceeded');
  assert.equal(
    classifyFirestoreError(new Error('Missing or insufficient permissions.')),
    'permission_denied'
  );
  assert.equal(
    classifyFirestoreError(new Error('Failed to get document because the client is offline.')),
    'network'
  );
  assert.equal(classifyFirestoreError(new Error('Unexpected parse error')), 'unknown');
});

test('recordSyncIncident deduplicates repeated quota errors across multiple streams into a single incident', () => {
  let health = createInitialSyncHealthState();
  const quotaErr = new Error('Quota limit exceeded: Free daily read units per project');

  health = recordSyncIncident(health, {
    streamKey: 'matches',
    context: 'Lectura de partidos',
    err: quotaErr,
    nowIso: '2026-11-27T13:00:00.000Z',
  });
  health = recordSyncIncident(health, {
    streamKey: 'teams',
    context: 'Lectura de equipos',
    err: quotaErr,
    nowIso: '2026-11-27T13:00:01.000Z',
  });
  health = recordSyncIncident(health, {
    streamKey: 'matches',
    context: 'Lectura de partidos',
    err: quotaErr,
    nowIso: '2026-11-27T13:00:02.000Z',
  });

  assert.ok(health.incident);
  assert.equal(health.incident.kind, 'quota_exceeded');
  assert.equal(health.incident.occurrences, 3);
  assert.equal(health.incident.firstSeenAt, '2026-11-27T13:00:00.000Z');
  assert.equal(health.incident.lastSeenAt, '2026-11-27T13:00:02.000Z');
  assert.deepEqual(health.incident.affectedStreams, ['matches', 'teams']);
  assert.deepEqual(health.failedStreams, ['matches', 'teams']);
});

test('shouldShowPublicReadNotice hides banner once dismissed for the active incident kind even if more streams fail', () => {
  let health = createInitialSyncHealthState();
  const quotaErr = new Error('Quota limit exceeded');

  health = recordSyncIncident(health, { streamKey: 'matches', context: 'matches', err: quotaErr });
  const summary1 = computeSyncHealthSummary(health, { usingLocalCache: true });

  assert.equal(summary1.status, 'quota_exceeded');
  assert.equal(summary1.publicNoticeMessage, PUBLIC_READ_DEGRADED_NOTICE);
  assert.equal(shouldShowPublicReadNotice({ summary: summary1, dismissedKind: null }), true);
  assert.equal(
    shouldShowPublicReadNotice({ summary: summary1, dismissedKind: 'quota_exceeded' }),
    false
  );

  // Another collection fails with the same quota error -> stays dismissed!
  health = recordSyncIncident(health, { streamKey: 'players', context: 'players', err: quotaErr });
  const summary2 = computeSyncHealthSummary(health, { usingLocalCache: true });
  assert.equal(
    shouldShowPublicReadNotice({ summary: summary2, dismissedKind: 'quota_exceeded' }),
    false
  );
  assert.equal(summary2.incident?.occurrences, 2);
});

test('markSyncStreamHealthy clears failed status and transitions summary back to healthy when recovered', () => {
  let health = createInitialSyncHealthState();
  health = recordSyncIncident(health, {
    streamKey: 'teams',
    context: 'teams',
    err: new Error('network offline'),
    nowIso: '2026-11-27T13:00:00.000Z',
  });

  assert.equal(computeSyncHealthSummary(health, { usingLocalCache: false }).status, 'degraded');

  health = markSyncStreamHealthy(health, 'teams', '2026-11-27T13:02:00.000Z');
  const recovered = computeSyncHealthSummary(health, { usingLocalCache: false });

  assert.equal(recovered.status, 'healthy');
  assert.equal(recovered.hasReadIssues, false);
  assert.equal(recovered.failedStreamsCount, 0);
  assert.equal(recovered.activeStreamsCount, 1);
  assert.equal(recovered.lastSuccessfulSyncAt, '2026-11-27T13:02:00.000Z');
  assert.equal(recovered.incident, null);
});

test('shouldEmitThrottledQuotaLog suppresses repeated quota logs inside cooldown window', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(shouldEmitThrottledQuotaLog(null, t0), true);
  assert.equal(shouldEmitThrottledQuotaLog(t0, t0 + 10_000), false);
  assert.equal(shouldEmitThrottledQuotaLog(t0, t0 + 59_999), false);
  assert.equal(shouldEmitThrottledQuotaLog(t0, t0 + 60_000), true);
});
