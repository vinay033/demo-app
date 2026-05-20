/**
 * Contract test: Redux store state shape (JSON Schema via Ajv 8)
 *
 * This spec pins the public shape of AppState so that any change to
 * the store's structure (new top-level keys, type changes) is caught
 * before it silently breaks the host shell or other consumers.
 *
 * If you intentionally evolve the schema, update INITIAL_STATE_SCHEMA
 * here and treat the required review of this file as a breaking-change
 * signal to all consumers of sub-app1/store.
 */

import Ajv, { JSONSchemaType } from 'ajv';
import { store } from '../../store';
import type { AppState } from '../../store';

// ── Schema ──────────────────────────────────────────────────────────────────
// AppState is currently an open record { [key: string]: unknown }.
// The schema below pins that contract: an object with no required keys
// yet, but whose *presence as an object* is guaranteed.
// Add `required` / `properties` entries here as the store grows.
const INITIAL_STATE_SCHEMA: JSONSchemaType<AppState> = {
  type: 'object',
  additionalProperties: true, // open record — tighten as keys stabilise
  required: [],               // no mandatory keys in initial state
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const ajv = new Ajv();
const validate = ajv.compile(INITIAL_STATE_SCHEMA);

// ── Tests ────────────────────────────────────────────────────────────────────
describe('sub-app1 store — state shape contract', () => {

  it('initial state satisfies the AppState JSON schema', () => {
    const state = store.getState();
    const valid = validate(state);
    expect(valid)
      .withContext(`Schema violations: ${JSON.stringify(validate.errors)}`)
      .toBeTrue();
  });

  it('initial state is a plain object (not null, array, or primitive)', () => {
    const state = store.getState();
    expect(state).toBeTruthy();
    expect(typeof state).toBe('object');
    expect(Array.isArray(state)).toBeFalse();
  });

  it('dispatching an unrecognised action does not corrupt the state shape', () => {
    store.dispatch({ type: '@@UNKNOWN_ACTION' });
    const stateAfter = store.getState();
    const valid = validate(stateAfter);
    expect(valid)
      .withContext(`Schema violations after unknown dispatch: ${JSON.stringify(validate.errors)}`)
      .toBeTrue();
  });

  it('store exposes a subscribe function (required by StoreListenerService contract)', () => {
    expect(typeof store.subscribe).toBe('function');
  });

  it('store exposes a dispatch function', () => {
    expect(typeof store.dispatch).toBe('function');
  });
});
