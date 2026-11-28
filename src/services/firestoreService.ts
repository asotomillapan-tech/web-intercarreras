/**
 * Backwards-compatible barrel re-exporting modular domain persistence repositories.
 * Prefer importing directly from `src/services/repositories/*` in new code.
 */
export * from './repositories/coreRepository';
export * from './repositories/usersRepository';
export * from './repositories/rosterRepository';
export * from './repositories/contentRepository';
export * from './repositories/votingRepository';
