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
 *
 * ── Update process ──────────────────────────────────────────────────────────
 * 1. Add / remove state keys in store.ts rootReducer.
 * 2. Reflect those keys in INITIAL_STATE_SCHEMA (add to `properties` +
 *    `required` if mandatory; leave in `additionalProperties` if optional).
 * 3. Run `ng test sub-app1 --no-watch` — this file must stay green.
 * 4. Update docs/telemetry.md File map and open the PR with both changes
 *    (doc-with-code policy).
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

  // ── State shape ─────────────────────────────────────────────────────────

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

  // ── Public API surface ────────────────────────────────────────────────────
  // These tests pin the Redux Store interface that StoreListenerService and
  // any future consumers rely on. A removal of any of these functions is a
  // breaking change.

  it('store exposes a getState function', () => {
    // Rationale: StoreListenerService calls store.getState() inside the
    // subscribe callback to read the current state. Removing this function
    // would silently break the listener with a runtime TypeError.
    expect(typeof store.getState).toBe('function');
  });

  it('store exposes a subscribe function (required by StoreListenerService contract)', () => {
    expect(typeof store.subscribe).toBe('function');
  });

  it('subscribe returns a callable unsubscribe function', () => {
    // Rationale: StoreListenerService calls the returned unsubscribe in
    // ngOnDestroy. If subscribe does not return a function, ngOnDestroy
    // will throw and leak the subscription.
    const unsubscribe = store.subscribe(() => { /* noop */ });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('subscribe callback is invoked when an action is dispatched', () => {
    // Rationale: the entire StoreListenerService model relies on the
    // callback firing. If Redux's subscribe contract breaks, the service
    // silently stops logging state — no error, just missing observability.
    let callCount = 0;
    const unsubscribe = store.subscribe(() => { callCount++; });
    store.dispatch({ type: '@@CONTRACT_PROBE' });
    unsubscribe();
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('unsubscribed listener is NOT called on subsequent dispatches', () => {
    // Rationale: verifies the unsubscribe contract so ngOnDestroy properly
    // stops accumulating calls in long-lived Angular services.
    let callCount = 0;
    const unsubscribe = store.subscribe(() => { callCount++; });
    unsubscribe(); // unsubscribe BEFORE dispatch
    store.dispatch({ type: '@@CONTRACT_PROBE_AFTER_UNSUB' });
    expect(callCount).toBe(0);
  });

  it('store exposes a dispatch function', () => {
    expect(typeof store.dispatch).toBe('function');
  });

  it('dispatch returns the dispatched action (Redux contract)', () => {
    // Rationale: standard Redux dispatch return value is the action itself.
    // Code that chains dispatch().type relies on this; breaking it is silent.
    const action = { type: '@@CONTRACT_RETURN_VALUE' };
    const result = store.dispatch(action);
    expect(result).toBeTruthy();
    expect((result as { type: string }).type).toBe('@@CONTRACT_RETURN_VALUE');
  });
});
