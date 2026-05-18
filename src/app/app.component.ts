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

  constructor(public storeListener: StoreListenerService) {}
}

