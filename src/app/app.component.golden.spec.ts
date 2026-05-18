/**
 * Contract test: AppComponent rendered HTML (golden file comparison)
 *
 * This spec guards the *public visual contract* of the host shell's root
 * component — the exact HTML structure consumers (e.g. e2e tests, visual
 * regression tools, accessibility audits) can rely on.
 *
 * To update the golden after an intentional template change:
 *   1. Delete src/app/__golden__/app.component.golden.ts
 *   2. Re-run: ng test --no-watch --browsers=ChromeHeadlessCI
 *      The spec will fail with a diff showing the new output.
 *   3. Copy the "actual" value printed in the failure into the golden file.
 *   4. Commit both the template change and the updated golden together so
 *      reviewers can see exactly what changed visually.
 */

import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { StoreListenerService } from './store-listener.service';
import { APP_COMPONENT_GOLDEN } from './__golden__/app.component.golden';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalises rendered HTML for stable comparison:
 *  - collapses whitespace / newlines between tags
 *  - trims leading/trailing whitespace
 */
function normalise(html: string): string {
  return html
    .replace(/\s+/g, ' ')       // collapse runs of whitespace
    .replace(/>\s+</g, '><')    // remove whitespace between tags
    .trim();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AppComponent — golden file contract', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent],
      providers: [StoreListenerService],
    }).compileComponents();
  });

  it('rendered HTML matches the golden snapshot', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const actual = normalise(fixture.nativeElement.innerHTML);
    const expected = normalise(APP_COMPONENT_GOLDEN);

    if (actual !== expected) {
      // Emit a clear diff-friendly message
      console.error('\n── Golden mismatch ──────────────────────────────────');
      console.error('EXPECTED:\n', expected);
      console.error('ACTUAL:\n', actual);
      console.error('────────────────────────────────────────────────────\n');
    }

    expect(actual)
      .withContext(
        `Rendered HTML no longer matches the golden.\n` +
        `Expected:\n  ${expected}\n` +
        `Actual:\n  ${actual}\n\n` +
        `If this change is intentional, update src/app/__golden__/app.component.golden.ts`
      )
      .toBe(expected);
  });

  it('rendered HTML contains the root heading', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).withContext('Root <h1> must exist').toBeTruthy();
    expect(h1.textContent.trim()).toBe('Root Application');
  });

  it('rendered HTML contains a router-outlet placeholder', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    expect(outlet).withContext('<router-outlet> must exist for micro-frontend routing').toBeTruthy();
  });
});
