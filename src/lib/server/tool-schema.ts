/** Remove schema documentation only; literal values, property names and validation stay intact. */
export function compactToolSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactToolSchema);
  if (!value || typeof value !== 'object') return value;
  const maps = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
  const schemas = new Set(['items', 'prefixItems', 'additionalProperties', 'unevaluatedProperties', 'contains', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']);
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='$schema'&&key!=='description').map(([key,item])=>[
    key, maps.has(key) && item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).map(([name,schema])=>[name,compactToolSchema(schema)]))
      : schemas.has(key) ? compactToolSchema(item) : item,
  ]));
}
