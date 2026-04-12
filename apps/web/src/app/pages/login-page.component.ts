import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthShellService, TRole } from '../auth-shell.service';

// Placeholder login view that exercises role selection and guarded route redirects.
@Component({
  selector: 'app-login-page',
  template: `
    <!-- Login card simulates a station desk sign-in panel until real auth is wired. -->
    <section class="login-card">
      <p class="eyebrow">Slice 01 auth shell</p>
      <h1>Radio Clipper</h1>
      <p class="summary">
        This placeholder sign-in flow proves route guarding, role inspection,
        and navigation boundaries before real Amplify Auth wiring.
      </p>

      <!-- Each role button keeps test auth flows explicit for slice validation. -->
      <div class="actions">
        <button type="button" (click)="fnSignIn('producer')">Sign in as producer</button>
        <button type="button" (click)="fnSignIn('admin')">Sign in as admin</button>
        <button type="button" (click)="fnSignIn('platform_admin')">Sign in as platform admin</button>
      </div>
    </section>
  `,
  styles: `
    /* Centered sign-in panel with warm metallic styling for vintage studio tone. */
    .login-card {
      width: min(40rem, 100%);
      padding: 2rem;
      border-radius: 1.2rem;
      background: linear-gradient(180deg, rgba(56, 42, 31, 0.9), rgba(32, 24, 18, 0.92));
      border: 1px solid rgba(182, 134, 63, 0.35);
      box-shadow: var(--shadow-console);
    }

    /* Small uppercase kicker keeps internal slice context visible. */
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.75rem;
      color: var(--c-brass-soft);
      margin-bottom: 0.75rem;
    }

    /* Hero title uses high-contrast parchment against dark walnut panel. */
    h1 {
      margin: 0 0 1rem;
      font-size: clamp(2rem, 6vw, 3.5rem);
      line-height: 1.02;
      font-family: var(--ff-display);
      letter-spacing: 0.035em;
      color: var(--c-parchment);
    }

    /* Intro paragraph stays readable but slightly dimmer than headings. */
    .summary {
      max-width: 32rem;
      color: var(--c-parchment-dim);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    /* Action buttons stack in a clean vertical list on all sizes. */
    .actions {
      display: grid;
      gap: 0.75rem;
      animation: kfLoginReveal 460ms ease-out 150ms both;
    }

    /* Primary controls use brass gradient and subtle motion for tactile feel. */
    button {
      padding: 0.95rem 1.1rem;
      border-radius: 999px;
      border: 1px solid rgba(211, 173, 105, 0.48);
      background: linear-gradient(135deg, #97662f, #b6863f 60%, #c19656);
      color: #fff5dd;
      font: inherit;
      font-weight: 700;
      letter-spacing: 0.015em;
      cursor: pointer;
      transition: transform 140ms ease, filter 140ms ease;
    }

    /* Lift effect reinforces interactive affordance without being noisy. */
    button:hover,
    button:focus-visible {
      transform: translateY(-1px);
      filter: brightness(1.05);
      outline: none;
    }

    /* Card fade-in uses a short delay so header text settles first. */
    .login-card {
      animation: kfLoginReveal 520ms ease-out both;
    }

    @keyframes kfLoginReveal {
      from {
        opacity: 0;
        transform: translateY(8px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .login-card,
      .actions {
        animation: none;
      }
    }
  `,
})
export class LoginPageComponent {
  private readonly oAuthShell = inject(AuthShellService);
  private readonly oRouter = inject(Router);
  private readonly oRoute = inject(ActivatedRoute);

  // Keep redirect semantics aligned with auth guards by honoring sRedirectTo first.
  fnSignIn(sRole: TRole): void {
    this.oAuthShell.fnSignInAs(sRole);

    const sRedirectTarget = this.oRoute.snapshot.queryParamMap.get('sRedirectTo');
    const sFallbackRoute = sRole === 'producer' ? '/live' : '/admin';

    void this.oRouter.navigateByUrl(sRedirectTarget || sFallbackRoute);
  }
}
