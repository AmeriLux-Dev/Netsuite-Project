/**
 * NetSuite script-id arithmetic and the name rules the scaffold enforces.
 *
 * `customscript_`, `customdeploy_` and `customrecord_` are all 13 characters and
 * NetSuite caps a script id at 40, so `<prefix>_<name>` must fit in 27.
 */

export const SCRIPT_ID_TYPE_PREFIX_LENGTH = 13;
export const SCRIPT_ID_MAX_LENGTH = 40;
export const SCRIPT_ID_BODY_BUDGET = SCRIPT_ID_MAX_LENGTH - SCRIPT_ID_TYPE_PREFIX_LENGTH;

export const PROJECT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;
export const PROJECT_NAME_MIN_LENGTH = 2;
export const PROJECT_NAME_MAX_LENGTH = 40;

export const PREFIX_PATTERN = /^[a-z][a-z0-9]{1,9}$/;
export const PREFIX_MIN_LENGTH = 2;
export const PREFIX_MAX_LENGTH = 10;

export const OBJECT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const CONTROLLER_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export const PROJECT_TYPES = ['react-app'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: string): value is ProjectType {
    return (PROJECT_TYPES as readonly string[]).includes(value);
}

/** Characters left for the object name once the prefix and its separating underscore are taken. */
export function remainingObjectNameBudget(prefix: string): number {
    return SCRIPT_ID_BODY_BUDGET - prefix.length - 1;
}

export function isValidNpmPackageName(name: string): boolean {
    if (name.length === 0 || name.length > 214) return false;
    if (name.startsWith('.') || name.startsWith('_')) return false;
    if (name !== name.toLowerCase()) return false;
    if (encodeURIComponent(name) !== name) return false;
    return true;
}

/** Returns an error message, or undefined when the value is acceptable. */
export function validateProjectName(name: string): string | undefined {
    if (!name) return 'Project name is required.';
    if (name.length < PROJECT_NAME_MIN_LENGTH) {
        return `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters.`;
    }
    if (name.length > PROJECT_NAME_MAX_LENGTH) {
        return `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters.`;
    }
    if (!PROJECT_NAME_PATTERN.test(name)) {
        return 'Project name must start with a letter and contain only letters, digits and hyphens.';
    }
    return undefined;
}

export function validatePrefix(prefix: string): string | undefined {
    if (!prefix) return 'Prefix is required.';
    if (!PREFIX_PATTERN.test(prefix)) {
        return `Prefix must be ${PREFIX_MIN_LENGTH}-${PREFIX_MAX_LENGTH} lowercase letters or digits, starting with a letter (no underscores).`;
    }
    return undefined;
}

/** A snake_case object name that, together with the prefix, keeps every derived script id under the 40-character cap. */
export function validateObjectName(objectName: string, prefix: string): string | undefined {
    if (!objectName) return 'Name is required.';
    if (!OBJECT_NAME_PATTERN.test(objectName)) {
        return 'Name must be lowercase letters, digits and underscores, starting with a letter.';
    }
    const budget = remainingObjectNameBudget(prefix);
    if (objectName.length > budget) {
        return `Name must be at most ${budget} characters with prefix "${prefix}" (script ids are capped at ${SCRIPT_ID_MAX_LENGTH}).`;
    }
    return undefined;
}

export function validateControllerName(controllerName: string): string | undefined {
    if (!controllerName) return 'Controller name is required.';
    if (!CONTROLLER_NAME_PATTERN.test(controllerName)) {
        return 'Controller name must be camelCase: start with a lowercase letter, letters and digits only.';
    }
    if (controllerName.endsWith('Controller')) {
        return 'Leave the "Controller" suffix off; it is added for you.';
    }
    return undefined;
}

export function buildScriptId(prefix: string, objectName: string): string {
    return `customscript_${prefix}_${objectName}`;
}

export function buildDeployId(prefix: string, objectName: string): string {
    return `customdeploy_${prefix}_${objectName}`;
}
