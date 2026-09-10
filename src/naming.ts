/** Case conversions shared by the scaffold and the controller generator. */

function splitIntoWords(value: string): string[] {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);
}

export function toPascalCase(value: string): string {
    return splitIntoWords(value)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export function toCamelCase(value: string): string {
    const pascal = toPascalCase(value);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(value: string): string {
    return splitIntoWords(value)
        .map((word) => word.toLowerCase())
        .join('-');
}

export function toSnakeCase(value: string): string {
    return splitIntoWords(value)
        .map((word) => word.toLowerCase())
        .join('_');
}

export function toTitleCase(value: string): string {
    return splitIntoWords(value)
        .map((word) => (word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(' ');
}

/** Lowercase alphanumerics of the name, truncated to 8; padded so it is never shorter than 2. */
export function defaultPrefixForProjectName(projectName: string): string {
    const compact = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const withLeadingLetter = /^[a-z]/.test(compact) ? compact : `a${compact}`;
    const truncated = withLeadingLetter.slice(0, 8);
    return truncated.length >= 2 ? truncated : `${truncated}app`.slice(0, 8);
}
