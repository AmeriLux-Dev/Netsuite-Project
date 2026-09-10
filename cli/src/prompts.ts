import * as clack from '@clack/prompts';

/**
 * Thin wrappers over @clack/prompts. Every prompt has a flag twin on the command line,
 * so a caller that already has the answer never sees a question; `--yes` (or a
 * non-interactive terminal) takes the default for whatever is left.
 */

export class PromptCancelledError extends Error {
    constructor() {
        super('Cancelled.');
        this.name = 'PromptCancelledError';
    }
}

function unwrap<T>(value: T | symbol): T {
    if (clack.isCancel(value)) throw new PromptCancelledError();
    return value as T;
}

export interface TextPromptOptions {
    message: string;
    initialValue?: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
}

export async function promptText(options: TextPromptOptions): Promise<string> {
    const value = await clack.text({
        message: options.message,
        initialValue: options.initialValue,
        placeholder: options.placeholder,
        validate: options.validate ? (input) => options.validate!(String(input ?? '')) : undefined,
    });
    return unwrap(value).trim();
}

export async function promptConfirm(message: string, initialValue: boolean): Promise<boolean> {
    return unwrap(await clack.confirm({ message, initialValue }));
}

export interface SelectOption<T extends string> {
    value: T;
    label: string;
    hint?: string;
}

export async function promptSelect<T extends string>(message: string, options: SelectOption<T>[], initialValue?: T): Promise<T> {
    // clack's Option<T> is a conditional type that TypeScript cannot relate to a generic T; the shapes match.
    const clackOptions = options as unknown as Parameters<typeof clack.select<T>>[0]['options'];
    return unwrap(await clack.select<T>({ message, options: clackOptions, initialValue }));
}

export const ui = {
    intro: (title: string) => clack.intro(title),
    outro: (message: string) => clack.outro(message),
    note: (message: string, title?: string) => clack.note(message, title),
    info: (message: string) => clack.log.info(message),
    warn: (message: string) => clack.log.warn(message),
    error: (message: string) => clack.log.error(message),
    success: (message: string) => clack.log.success(message),
    step: (message: string) => clack.log.step(message),
    cancel: (message: string) => clack.cancel(message),
};

export function isInteractiveTerminal(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
