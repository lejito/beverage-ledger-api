import { call } from './http';

interface SchemaObject {
  $ref?: string;
  allOf?: SchemaObject[];
  type?: string;
  enum?: unknown[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
}

interface OpenApiDocument {
  components: { schemas: Record<string, SchemaObject> };
}

let document: OpenApiDocument | undefined;

async function openApi(): Promise<OpenApiDocument> {
  if (!document) {
    const response = await call<OpenApiDocument>('GET', '/docs-json');
    if (response.status !== 200) throw new Error(`/docs-json answered ${response.status}`);
    document = response.body;
  }
  return document;
}

function resolve(schema: SchemaObject, doc: OpenApiDocument): SchemaObject {
  if (schema.$ref) return resolve(doc.components.schemas[schema.$ref.split('/').pop()!]!, doc);
  if (schema.allOf?.length === 1)
    return { ...resolve(schema.allOf[0]!, doc), nullable: schema.nullable };
  return schema;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function violations(
  value: unknown,
  schema: SchemaObject,
  doc: OpenApiDocument,
  path: string,
): string[] {
  const resolved = resolve(schema, doc);

  if (value === null) return resolved.nullable ? [] : [`${path} is null but not nullable`];
  if (resolved.enum && !resolved.enum.includes(value))
    return [`${path}=${String(value)} is not in the enum`];

  const actual = typeOf(value);
  const expected = resolved.type ?? (resolved.properties ? 'object' : undefined);

  if (expected === 'number' && (actual === 'number' || actual === 'integer')) return [];
  if (expected && expected !== actual && !(expected === 'integer' && actual === 'number')) {
    return [`${path} is ${actual}, the contract says ${expected}`];
  }

  if (expected === 'array' && resolved.items) {
    return (value as unknown[]).flatMap((item, index) =>
      violations(item, resolved.items!, doc, `${path}[${index}]`),
    );
  }

  if (expected === 'object' && resolved.properties) {
    const record = value as Record<string, unknown>;
    const missing = (resolved.required ?? [])
      .filter((key) => !(key in record))
      .map((key) => `${path}.${key} is missing`);
    const undeclared = Object.keys(record)
      .filter((key) => !(key in resolved.properties!))
      .map((key) => `${path}.${key} is not in the contract`);
    const nested = Object.entries(record)
      .filter(([key]) => key in resolved.properties!)
      .flatMap(([key, item]) =>
        violations(item, resolved.properties![key]!, doc, `${path}.${key}`),
      );
    return [...missing, ...undeclared, ...nested];
  }

  return [];
}

/**
 * Checks a response body against a schema of the deployed `/docs-json`: required
 * fields, types, enums, nullability, and no field the contract does not declare.
 * Returns the violations so a failed assertion lists all of them at once.
 */
export async function contractViolations(body: unknown, schemaName: string): Promise<string[]> {
  const doc = await openApi();
  const schema = doc.components.schemas[schemaName];
  if (!schema) return [`${schemaName} is not in /docs-json`];
  return violations(body, schema, doc, schemaName);
}
