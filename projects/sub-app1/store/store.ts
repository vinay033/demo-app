import { createStore, Store } from 'redux';

export interface AppState {
  [key: string]: unknown;
}

function rootReducer(state: AppState = {}): AppState {
  return state;
}

export const store: Store<AppState> = createStore(rootReducer);
