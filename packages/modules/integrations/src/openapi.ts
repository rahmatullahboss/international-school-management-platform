import { cloneAndFreeze } from './common.js';

export interface OpenApiDocument {
  openapi: string;
  info: Readonly<{
    title: string;
    version: string;
    description?: string;
  }>;
  servers?: readonly Readonly<{ url: string; description?: string }>[];
  paths: Readonly<Record<string, unknown>>;
  components?: Readonly<Record<string, unknown>>;
  tags?: readonly Readonly<Record<string, unknown>>[];
}

export class OpenApiRegistry {
  readonly #versions = new Map<string, Readonly<OpenApiDocument>>();

  publish(document: OpenApiDocument): Readonly<OpenApiDocument> {
    if (!/^3\./u.test(document.openapi)) throw new Error('OpenAPI 3.x is required');
    if (document.info.version.trim().length === 0) throw new Error('OpenAPI version is required');
    if (Object.keys(document.paths).length === 0) throw new Error('OpenAPI paths are required');
    if (this.#versions.has(document.info.version)) throw new Error('OpenAPI version is immutable');
    const published = cloneAndFreeze(document);
    this.#versions.set(document.info.version, published);
    return published;
  }

  resolve(version: string): Readonly<OpenApiDocument> | undefined {
    return this.#versions.get(version);
  }

  versions(): readonly string[] {
    return [...this.#versions.keys()].sort();
  }
}

export function createIntegrationOpenApiV1(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'International School Integration API',
      version: '1.0.0',
      description:
        'Tenant-scoped integration administration, external identifier and replay operations.',
    },
    servers: [{ url: '/api', description: 'Current deployment' }],
    tags: [
      { name: 'Connections' },
      { name: 'External identifiers' },
      { name: 'Webhook deliveries' },
    ],
    paths: {
      '/v1/integrations/connections/{connectionId}/health': {
        get: {
          operationId: 'getIntegrationConnectionHealth',
          tags: ['Connections'],
          security: [{ IntegrationKey: ['connection.health.read'] }],
          parameters: [
            {
              name: 'connectionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Current connection health' },
            '404': { description: 'Connection not found' },
          },
        },
      },
      '/v1/integrations/external-identifiers': {
        get: {
          operationId: 'resolveExternalIdentifier',
          tags: ['External identifiers'],
          security: [{ IntegrationKey: ['external-id.read'] }],
          responses: { '200': { description: 'Resolved identifier' } },
        },
      },
      '/v1/integrations/webhook-deliveries/{deliveryId}/replay': {
        post: {
          operationId: 'replayWebhookDelivery',
          tags: ['Webhook deliveries'],
          security: [{ IntegrationKey: ['webhook.replay'] }],
          parameters: [
            {
              name: 'deliveryId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '202': { description: 'Replay scheduled' },
            '409': { description: 'Delivery is not replayable' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        IntegrationKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Integration-Key',
          description: 'Tenant-scoped, rotatable machine credential.',
        },
      },
    },
  };
}
