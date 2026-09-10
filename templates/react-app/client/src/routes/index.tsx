import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/features/customers/CustomersPage';

// File-based routing: this file is the "/" route. Add src/routes/orders.tsx for "/orders",
// src/routes/orders.$orderId.tsx for "/orders/:orderId", and so on. The Vite plugin keeps
// src/routeTree.gen.ts in sync; never edit that file by hand.
export const Route = createFileRoute('/')({
    component: CustomersPage,
});
