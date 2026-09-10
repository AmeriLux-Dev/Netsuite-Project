import { createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/** The Suitelet URL cannot change, so the router keeps its location in the hash. */
export function createAppRouter() {
    return createRouter({ routeTree, history: createHashHistory() });
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createAppRouter>;
    }
}
