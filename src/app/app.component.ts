import { Component } from '@angular/core';
import { Store } from 'redux';
import { Provider } from 'react-redux';
import { store } from '../../projects/sub-app1/store';

@Component({
  selector: 'app-root',
  template: `
    <provider [store]="store">
      <h1>Root Application</h1>
      <router-outlet></router-outlet>
    </provider>
  `,
})
export class AppComponent {
  title = 'demo-app';
  public store: Store;

  constructor() {
    this.store = store;
    this.store.subscribe(() => {
      console.log(this.store.getState());
    });
  }
}
