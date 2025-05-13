export function buildMongooseProjection(fields: Set<string>): string {
  return [...fields].join(' ');
}