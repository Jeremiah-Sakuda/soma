import { describe, expect, it } from 'vitest';
import { compactToolSchema } from '../../src/lib/server/tool-schema';
describe('bounded tool schema replay', () => {
  it('preserves a data property named description and literal enum values', () => {
    expect(
      compactToolSchema({
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Help', minLength: 1 },
          choice: { enum: [{ description: 'literal', value: 1 }] },
        },
        required: ['description'],
      }),
    ).toEqual({
      type: 'object',
      properties: {
        description: { type: 'string', minLength: 1 },
        choice: { enum: [{ description: 'literal', value: 1 }] },
      },
      required: ['description'],
    });
  });
  it('removes documentation metadata without removing nested validation constraints or changing input', () => {
    const schema = {
      $schema: 'example',
      description: 'Long repeated help',
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Explain', minLength: 1, maxLength: 20 },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number', minimum: 0, maximum: 24 },
        },
      },
      required: ['note', 'options'],
      additionalProperties: false,
    };
    const original = structuredClone(schema),
      result = compactToolSchema(schema);
    expect(result).toEqual({
      type: 'object',
      properties: {
        note: { type: 'string', minLength: 1, maxLength: 20 },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number', minimum: 0, maximum: 24 },
        },
      },
      required: ['note', 'options'],
      additionalProperties: false,
    });
    expect(schema).toEqual(original);
  });
});
