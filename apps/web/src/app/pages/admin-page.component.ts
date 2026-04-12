import { Component } from '@angular/core';

// Admin route placeholder keeps operations sections visible for later slices.
@Component({
  selector: 'app-admin-page',
  template: `
    <!-- Operations overview scaffold for upcoming admin and reliability workflows. -->
    <section class="page-shell">
      <p class="eyebrow">Admin shell</p>
      <h1>Operations placeholder</h1>
      <!-- Cards represent top-level operations surfaces for future slices. -->
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
    /* Main vertical layout for admin route content. */
    .page-shell {
      display: grid;
      gap: 1.5rem;
    }

    /* Uppercase route label for hierarchy and consistency. */
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.75rem;
      color: #a6cc98;
    }

    /* Responsive operation cards that adapt to viewport width. */
    .panel-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    }

    /* Card container echoes brass-trimmed console modules. */
    article {
      padding: 1.25rem;
      border-radius: 1rem;
      background: linear-gradient(180deg, rgba(57, 43, 31, 0.78), rgba(35, 26, 19, 0.88));
      border: 1px solid rgba(182, 134, 63, 0.24);
      box-shadow: inset 0 0 0 1px rgba(244, 232, 200, 0.04);
      opacity: 0;
      animation: kfOpsReveal 500ms ease-out both;
    }

    /* Cards enter in sequence to communicate ordered operations flow. */
    article:nth-child(1) {
      animation-delay: 90ms;
    }

    article:nth-child(2) {
      animation-delay: 170ms;
    }

    article:nth-child(3) {
      animation-delay: 250ms;
    }

    /* Card heading appears in full-contrast parchment. */
    h2 {
      margin-top: 0;
      margin-bottom: 0.5rem;
      font-family: var(--ff-display);
      letter-spacing: 0.03em;
      color: var(--c-parchment);
    }

    /* Body copy remains softer for comfortable scanning. */
    p {
      margin: 0;
      color: var(--c-parchment-dim);
      line-height: 1.45;
    }

    @keyframes kfOpsReveal {
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
      article {
        opacity: 1;
        animation: none;
      }
    }

    @media (max-width: 700px) {
      .page-shell {
        gap: 1rem;
      }

      h1 {
        margin: 0.3rem 0 0.65rem;
        font-size: clamp(1.5rem, 7.2vw, 2rem);
      }

      .panel-grid {
        grid-template-columns: 1fr;
      }

      article {
        padding: 1rem;
      }
    }

    @media (max-width: 420px) {
      article {
        padding: 0.9rem;
      }

      p {
        font-size: 0.95rem;
      }
    }
  `,
})
export class AdminPageComponent {}
