import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { app } from 'common/netsuite';
import { createAppRouter } from '@/router';
import '@/styles/app.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
            staleTime: 5 * 60 * 1000,
        },
    },
});

const router = createAppRouter();

// NetSuite can evaluate the inline HTML field more than once; mount only into an empty root.
const rootElement = document.getElementById(app.rootElementId);
if (rootElement && !rootElement.hasChildNodes()) {
    createRoot(rootElement).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </StrictMode>,
    );
}
