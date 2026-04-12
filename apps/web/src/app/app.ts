import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthShellService } from './auth-shell.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // The root shell mirrors session state so header actions stay consistent across routed pages.
  private readonly oAuthShell = inject(AuthShellService);
  protected readonly bIsSignedIn = this.oAuthShell.bIsSignedIn;
  protected readonly sRole = this.oAuthShell.sRole;

  fnSignOut(): void {
    this.oAuthShell.fnSignOut();
  }
}
