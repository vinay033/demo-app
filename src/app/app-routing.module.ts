import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/**
 * mfeTimed — wraps a lazy loadChildren factory with a performance.now() timer.
 * Logs a `[mfe] load timing=Xms remote=<name>` line and emits a PerformanceMeasure
 * entry visible in DevTools > Performance > User Timings.
 *
 * Replace the console.log with TelemetryService.timing() once the Angular DI
 * context is available here (e.g. via an APP_INITIALIZER factory).
 *
 * @see Epic #2 issue: MFE webpack wiring (src/app/app-routing.module.ts lazy routes)
 */
// Intentional scaffolding: function is wired in the commented-out route definitions below
// and will be uncommented as part of the MFE webpack wiring work (Epic #2).
// Removing it would lose the implementation and JSDoc context before the epic starts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function mfeTimed<T>(remote: string, factory: () => Promise<T>): () => Promise<T> {
  return () => {
    const t0 = performance.now();
    return factory().then(module => {
      const durationMs = Math.round(performance.now() - t0);
      performance.measure(`mfe-load:${remote}`, { start: t0 });
      console.log(`[mfe] load timing=${durationMs}ms remote=${remote}`);
      return module;
    }).catch(err => {
      const durationMs = Math.round(performance.now() - t0);
      console.error(`[mfe] load-error timing=${durationMs}ms remote=${remote}`, err);
      return Promise.reject(err);
    });
  };
}

// TODO: wire real lazy routes once sub-app1 and sub-app2 expose remoteEntry.js.
// Example (uncomment and adjust module name once webpack.config.js is in place):
//
// const routes: Routes = [
//   {
//     path: 'app1',
//     loadChildren: mfeTimed('subapp1', () =>
//       import('subapp1/Module').then(m => m.AppModule)),
//   },
//   {
//     path: 'app2',
//     loadChildren: mfeTimed('subapp2', () =>
//       import('subapp2/Module').then(m => m.AppModule)),
//   },
// ];

const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
