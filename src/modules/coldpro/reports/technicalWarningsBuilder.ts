export function buildTechnicalWarnings(warnings: string[] = [], missingFields: string[] = []) { return [...warnings, ...missingFields.map((field) => `Campo obrigatório ausente: ${field}`)]; }
