import { computed, Injectable, signal } from '@angular/core';

export type TRole = 'producer' | 'admin' | 'platform_admin';

type TSession = {
  sName: string;
  sRole: TRole;
};

// Temporary in-memory auth shell for slice scaffolding before Cognito integration.
@Injectable({ providedIn: 'root' })
export class AuthShellService {
  private readonly oCurrentSession = signal<TSession | null>(null);

  readonly oSession = computed(() => this.oCurrentSession());
  readonly bIsSignedIn = computed(() => this.oCurrentSession() !== null);
  readonly sRole = computed<TRole | null>(() => this.oCurrentSession()?.sRole ?? null);

  // Assign role-aware demo identity so route guards and role badges can be exercised.
  fnSignInAs(sRole: TRole): void {
    this.oCurrentSession.set({
      sName: sRole === 'producer' ? 'Producer Demo' : 'Admin Demo',
      sRole,
    });
  }

  fnSignOut(): void {
    this.oCurrentSession.set(null);
  }

  fnCanAccessAdmin(): boolean {
    return this.sRole() === 'admin' || this.sRole() === 'platform_admin';
  }
}
