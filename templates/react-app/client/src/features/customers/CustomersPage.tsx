import { useState } from 'react';
import { useCustomers } from './useCustomers';

export function CustomersPage() {
    const [search, setSearch] = useState('');
    const customers = useCustomers({ search: search.trim() || undefined });

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Customers</h2>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter by company name"
                    className="w-64 max-w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
            </div>

            {customers.isPending && <p className="text-sm text-slate-500">Loading customers…</p>}

            {customers.isError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    Could not load customers: {customers.error.message}
                </p>
            )}

            {customers.isSuccess && customers.data.customers.length === 0 && (
                <p className="text-sm text-slate-500">No customers match.</p>
            )}

            {customers.isSuccess && customers.data.customers.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                                <th scope="col" className="px-3 py-2 font-medium">Id</th>
                                <th scope="col" className="px-3 py-2 font-medium">Company</th>
                                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {customers.data.customers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 tabular-nums text-slate-500">{customer.id}</td>
                                    <td className="px-3 py-2 font-medium text-slate-900">{customer.companyName}</td>
                                    <td className="px-3 py-2 text-slate-700">{customer.email ?? <span className="text-slate-400">none</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                        Showing up to {customers.data.limit} customers.
                    </p>
                </div>
            )}
        </section>
    );
}
