import { createRootRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';

/** The layout every route renders inside. Child routes appear at AppShell's <Outlet />. */
export const Route = createRootRoute({
    component: AppShell,
});
