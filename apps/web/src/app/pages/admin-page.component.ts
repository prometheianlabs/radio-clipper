import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-page',
  template: `
    <section class="page-shell">
      <p class="eyebrow">Admin shell</p>
      <h1>Operations placeholder</h1>
      <div class="panel-grid">
        <article>
          <h2>Station health</h2>
          <p>Reserved for heartbeat, reconnect count, and transcript lag.</p>
        </article>
        <article>
          <h2>Credential operations</h2>
          <p>Reserved for rotation and audit-driven admin actions.</p>
        </article>
        <article>
          <h2>Alerts</h2>
          <p>Reserved for CloudWatch alarms and export failure investigation.</p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .page-shell {
      display: grid;
      gap: 1.5rem;
    }

    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      color: #4ade80;
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
      margin-bottom: 0.5rem;
    }

    p {
      margin: 0;
      color: rgba(226, 232, 240, 0.84);
    }
  `,
})
export class AdminPageComponent {}