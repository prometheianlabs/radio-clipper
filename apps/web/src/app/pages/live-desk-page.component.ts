import { Component, inject } from '@angular/core';

import { AuthShellService } from '../auth-shell.service';

// Producer-facing placeholder that reserves layout for slice-03/04 live tooling.
@Component({
  selector: 'app-live-desk-page',
  template: `
    <!-- Producer workspace scaffold for upcoming live tools and transcript flows. -->
    <section class="page-shell">
      <header>
        <p class="eyebrow">Producer live desk</p>
        <h1>Authenticated shell only</h1>
        <p>
          Signed in as {{ oAuthShell.oSession()?.sName }}. This screen reserves layout space for
          station state, transcript flow, and clip creation without implementing Slice 04 yet.
        </p>
      </header>

      <!-- Panel grid reserves major operational regions before feature slices land. -->
      <div class="panel-grid">
        <article>
          <h2>Station context</h2>
          <ul>
            <li>station selector placeholder</li>
            <li>session status placeholder</li>
            <li>monitor delay badge placeholder</li>
          </ul>
        </article>

        <article>
          <h2>Transcript area</h2>
          <ul>
            <li>partial versus final transcript styling placeholder</li>
            <li>selection model will be item ID based</li>
            <li>SSE event wiring is deferred to Slice 03 and 04</li>
          </ul>
        </article>

        <article>
          <h2>Clip request</h2>
          <ul>
            <li>selected text preview placeholder</li>
            <li>derived start and end time placeholder</li>
            <li>clip job status placeholder</li>
          </ul>
        </article>
      </div>
    </section>
  `,
  styles: `
    /* Vertical rhythm wrapper for the live desk route. */
    .page-shell {
      display: grid;
      gap: 1.5rem;
    }

    /* Header copy remains readable at console distances. */
    header p {
      max-width: 48rem;
      color: var(--c-parchment-dim);
    }

    /* Section kicker to maintain page identity hierarchy. */
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      color: #9ac3c1;
    }

    /* Responsive cards flow from single to multi-column automatically. */
    .panel-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    }

    /* Each panel resembles a labeled bay on a control console. */
    article {
      padding: 1.25rem;
      border-radius: 1rem;
      background: linear-gradient(180deg, rgba(59, 44, 32, 0.75), rgba(38, 28, 21, 0.86));
      border: 1px solid rgba(182, 134, 63, 0.22);
      box-shadow: inset 0 0 0 1px rgba(244, 232, 200, 0.04);
      opacity: 0;
      animation: kfPanelReveal 500ms ease-out both;
    }

    /* Staggered timing gives a measured panel-by-panel entrance. */
    article:nth-child(1) {
      animation-delay: 80ms;
    }

    article:nth-child(2) {
      animation-delay: 170ms;
    }

    article:nth-child(3) {
      animation-delay: 260ms;
    }

    /* Section title keeps compact spacing and strong contrast. */
    h2 {
      margin-top: 0;
      margin-bottom: 0.75rem;
      font-family: var(--ff-display);
      letter-spacing: 0.03em;
      color: var(--c-parchment);
    }

    /* Placeholder list content styled as calm supporting text. */
    ul {
      padding-left: 1rem;
      margin: 0;
      display: grid;
      gap: 0.5rem;
      color: var(--c-parchment-dim);
    }

    @keyframes kfPanelReveal {
      from {
        opacity: 0;
        transform: translateY(9px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      article {
        opacity: 1;
        animation: none;
      }
    }
  `,
})
export class LiveDeskPageComponent {
  protected readonly oAuthShell = inject(AuthShellService);
}
