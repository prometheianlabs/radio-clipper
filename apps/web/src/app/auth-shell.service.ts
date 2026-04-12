import { computed, Injectable, signal } from '@angular/core';

export type TRole = 'producer' | 'admin' | 'platform_admin';

type TSession = {
  sName: string;
  sRole: TRole;
};

@Injectable({ providedIn: 'root' })
export class AuthShellService {
  private readonly oCurrentSession = signal<TSession | null>(null);

  readonly oSession = computed(() => this.oCurrentSession());
  readonly bIsSignedIn = computed(() => this.oCurrentSession() !== null);
  readonly sRole = computed<TRole | null>(() => this.oCurrentSession()?.sRole ?? null);

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