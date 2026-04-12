import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthShellService } from './auth-shell.service';

// Any signed-in role can access the live desk placeholder.
export const fnAuthGuard: CanActivateFn = (_oRoute, oState) => {
  const oAuthShell = inject(AuthShellService);
  const oRouter = inject(Router);

  if (oAuthShell.bIsSignedIn()) {
    return true;
  }

  return oRouter.createUrlTree(['/login'], {
    queryParams: { sRedirectTo: oState.url || '/live' },
  });
};

// Admin route requires admin or platform_admin and redirects all others safely.
export const fnAdminGuard: CanActivateFn = () => {
  const oAuthShell = inject(AuthShellService);
  const oRouter = inject(Router);

  if (!oAuthShell.bIsSignedIn()) {
    return oRouter.createUrlTree(['/login'], {
      queryParams: { sRedirectTo: '/admin' },
    });
  }

  if (oAuthShell.fnCanAccessAdmin()) {
    return true;
  }

  return oRouter.createUrlTree(['/live']);
};
