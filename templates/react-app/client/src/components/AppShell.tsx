import { Outlet } from '@tanstack/react-router';
import { app } from 'common/netsuite';

export function AppShell() {
    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-3">
                <h1 className="text-xl font-semibold text-slate-900">{app.title}</h1>
                <span className="text-xs text-slate-400" title={`build ${__BUILD_ID__}`}>v{__APP_VERSION__}</span>
            </header>
            <main className="min-h-0 flex-1 overflow-auto p-4">
                <Outlet />
            </main>
        </div>
    );
}
