import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthShellService, TRole } from '../auth-shell.service';

@Component({
  selector: 'app-login-page',
  template: `
    <section class="login-card">
      <p class="eyebrow">Slice 01 auth shell</p>
      <h1>Radio Clipper</h1>
      <p class="summary">
        This placeholder sign-in flow proves route guarding, role inspection,
        and navigation boundaries before real Amplify Auth wiring.
      </p>

      <div class="actions">
        <button type="button" (click)="fnSignIn('producer')">Sign in as producer</button>
        <button type="button" (click)="fnSignIn('admin')">Sign in as admin</button>
        <button type="button" (click)="fnSignIn('platform_admin')">Sign in as platform admin</button>
      </div>
    </section>
  `,
  styles: `
    .login-card {
      width: min(40rem, 100%);
      padding: 2rem;
      border-radius: 1.5rem;
      background: rgba(12, 20, 36, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      color: #f59e0b;
      margin-bottom: 0.75rem;
    }

    h1 {
      margin: 0 0 1rem;
      font-size: clamp(2rem, 6vw, 3.5rem);
    }

    .summary {
      max-width: 32rem;
      color: rgba(226, 232, 240, 0.88);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .actions {
      display: grid;
      gap: 0.75rem;
    }

    button {
      padding: 0.95rem 1.1rem;
      border-radius: 999px;
      border: 0;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: #fff7ed;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
  `,
})
export class LoginPageComponent {
  private readonly oAuthShell = inject(AuthShellService);
  private readonly oRouter = inject(Router);
  private readonly oRoute = inject(ActivatedRoute);

  fnSignIn(sRole: TRole): void {
    this.oAuthShell.fnSignInAs(sRole);

    const sRedirectTarget = this.oRoute.snapshot.queryParamMap.get('sRedirectTo');
    const sFallbackRoute = sRole === 'producer' ? '/live' : '/admin';

    void this.oRouter.navigateByUrl(sRedirectTarget || sFallbackRoute);
  }
}