import { Injectable, OnDestroy } from '@angular/core';
import { Store, Unsubscribe } from 'redux';
import { store } from '../../projects/sub-app1/store';

@Injectable({ providedIn: 'root' })
export class StoreListenerService implements OnDestroy {
  private readonly store: Store = store;
  // readonly: assigned once in the constructor and never reassigned.
  private readonly unsubscribe: Unsubscribe;

  constructor() {
    this.unsubscribe = this.store.subscribe(() => {
      console.log(this.store.getState());
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
