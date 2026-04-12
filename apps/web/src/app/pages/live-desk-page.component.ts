import { Component, inject } from '@angular/core';

import { AuthShellService } from '../auth-shell.service';

@Component({
  selector: 'app-live-desk-page',
  template: `
    <section class="page-shell">
      <header>
        <p class="eyebrow">Producer live desk</p>
        <h1>Authenticated shell only</h1>
        <p>
          Signed in as {{ oAuthShell.oSession()?.sName }}. This screen reserves layout space for
          station state, transcript flow, and clip creation without implementing Slice 04 yet.
        </p>
      </header>

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
    .page-shell {
      display: grid;
      gap: 1.5rem;
    }

    header p {
      max-width: 48rem;
      color: rgba(226, 232, 240, 0.84);
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      color: #38bdf8;
    }

    .panel-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    }

    article {
      padding: 1.25rem;
      border-radius: 1.25rem;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    h2 {
      margin-top: 0;
      margin-bottom: 0.75rem;
    }

    ul {
      padding-left: 1rem;
      margin: 0;
      display: grid;
      gap: 0.5rem;
      color: rgba(226, 232, 240, 0.84);
    }
  `,
})
export class LiveDeskPageComponent {
  protected readonly oAuthShell = inject(AuthShellService);
}