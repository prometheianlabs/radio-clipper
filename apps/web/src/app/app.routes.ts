import { Routes } from '@angular/router';

import { fnAdminGuard, fnAuthGuard } from './auth.guards';
import { AdminPageComponent } from './pages/admin-page.component';
import { LiveDeskPageComponent } from './pages/live-desk-page.component';
import { LoginPageComponent } from './pages/login-page.component';

// Keep login public while role-based guards enforce access to live/admin placeholders.
export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'login',
	},
	{
		path: 'login',
		component: LoginPageComponent,
	},
	{
		path: 'live',
		canActivate: [fnAuthGuard],
		component: LiveDeskPageComponent,
	},
	{
		path: 'admin',
		canActivate: [fnAdminGuard],
		component: AdminPageComponent,
	},
	{
		path: '**',
		redirectTo: 'login',
	},
];
