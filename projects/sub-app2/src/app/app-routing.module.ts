import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// TODO: Expose the root AppComponent (or a dedicated shell component) as a
// named route so this sub-app's remoteEntry.js can be lazy-loaded by the
// host shell via Module Federation. Until routes are wired up here and in
// the host's AppRoutingModule, the remote will mount but render nothing.
const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
