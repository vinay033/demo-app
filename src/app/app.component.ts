import { Component } from '@angular/core';
import { StoreListenerService } from './store-listener.service';

@Component({
  selector: 'app-root',
  template: `
    <h1>Root Application</h1>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  title = 'demo-app';

  // Angular 14 constructor injection; migrate to inject() when upgrading to Angular 16+ (Epic #2).
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(public storeListener: StoreListenerService) {}
}

