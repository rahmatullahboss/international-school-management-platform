#!/usr/bin/env python3
from pathlib import Path
import sys

mode = sys.argv[1] if len(sys.argv) > 1 else ''
permission_path = Path('apps/platform-api/src/auth-permission.ts')
test_path = Path('apps/platform-api/src/auth-permission.test.ts')
index_path = Path('apps/platform-api/src/index.ts')

if mode == 'test':
    source = test_path.read_text(encoding='utf-8')
    old_import = '''  authorizeDatabasePermission,
  isPermissionDeclaredLengthAllowed,
'''
    new_import = '''  authorizeDatabasePermission,
  isPermissionContentTypeAllowed,
  isPermissionDeclaredLengthAllowed,
  readBoundedPermissionRequestBody,
'''
    if source.count(old_import) != 1:
        raise SystemExit(f'Expected one AUTH-08 import marker, found {source.count(old_import)}.')
    test = '''

  it('rejects invalid media types and bounds chunked bodies by bytes before parsing', async () => {
    expect(isPermissionContentTypeAllowed('application/json')).toBe(true);
    expect(isPermissionContentTypeAllowed('application/json; charset=utf-8')).toBe(true);
    expect(isPermissionContentTypeAllowed('text/plain')).toBe(false);

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('x'.repeat(2048)));
        controller.enqueue(encoder.encode('x'));
        controller.close();
      },
    });
    await expect(readBoundedPermissionRequestBody(body)).resolves.toBeUndefined();
  });
'''
    marker = '\n});\n'
    if source.count(marker) != 1:
        raise SystemExit(f'Expected one AUTH-08 test suite terminator, found {source.count(marker)}.')
    test_path.write_text(source.replace(old_import, new_import).replace(marker, test + marker), encoding='utf-8')
elif mode == 'implementation':
    source = permission_path.read_text(encoding='utf-8')
    source = source.replace(
        'const MAX_PERMISSION_REQUEST_LENGTH = 2048;\n',
        'export const MAX_PERMISSION_REQUEST_LENGTH = 2048;\n',
    )
    source = source.replace(
        'function isJsonContentType(value: string | undefined): boolean {\n',
        'export function isPermissionContentTypeAllowed(value: string | undefined): boolean {\n',
    )
    source = source.replace(
        '!isJsonContentType(input.contentType) ||\n',
        '!isPermissionContentTypeAllowed(input.contentType) ||\n',
    )
    marker = 'export function isPermissionDeclaredLengthAllowed(value: string | undefined): boolean {\n'
    helper = '''export async function readBoundedPermissionRequestBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<string | undefined> {
  if (body === null) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_PERMISSION_REQUEST_LENGTH) {
        await reader.cancel();
        return undefined;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The request body is already unusable; retain the sanitized failure path.
    }
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

'''
    if source.count(marker) != 1:
        raise SystemExit(f'Expected one AUTH-08 body helper marker, found {source.count(marker)}.')
    permission_path.write_text(source.replace(marker, helper + marker), encoding='utf-8')

    index = index_path.read_text(encoding='utf-8')
    old_import = '''  authorizeDatabasePermission,
  isPermissionDeclaredLengthAllowed,
} from './auth-permission.js';
'''
    new_import = '''  authorizeDatabasePermission,
  isPermissionContentTypeAllowed,
  isPermissionDeclaredLengthAllowed,
  readBoundedPermissionRequestBody,
} from './auth-permission.js';
'''
    old_body = '''  const store = durablePermissionStore(context.env);
  const contentLength = context.req.header('content-length');
  const declaredLengthAllowed = isPermissionDeclaredLengthAllowed(contentLength);
  const configured =
    store !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32;
  let rawBody = '';
  if (
    configured &&
    isAllowedAuthMutationOrigin(context.env.AUTH_ALLOWED_WEB_ORIGINS, origin) &&
    declaredLengthAllowed
  ) {
    try {
      rawBody = await context.req.text();
    } catch {
      rawBody = '';
    }
  }

  const result = await authorizeDatabasePermission({
'''
    new_body = '''  const store = durablePermissionStore(context.env);
  const contentLength = context.req.header('content-length');
  const contentType = context.req.header('content-type');
  const declaredLengthAllowed = isPermissionDeclaredLengthAllowed(contentLength);
  const contentTypeAllowed = isPermissionContentTypeAllowed(contentType);
  const configured =
    store !== undefined &&
    context.env.AUTH_SESSION_SECRET !== undefined &&
    context.env.AUTH_SESSION_SECRET.length >= 32;
  let rawBody = '';
  if (
    configured &&
    isAllowedAuthMutationOrigin(context.env.AUTH_ALLOWED_WEB_ORIGINS, origin) &&
    declaredLengthAllowed &&
    contentTypeAllowed
  ) {
    rawBody = (await readBoundedPermissionRequestBody(context.req.raw.body)) ?? '';
  }

  const result = await authorizeDatabasePermission({
'''
    old_authorize_content_type = '''  const result = await authorizeDatabasePermission({
    configured,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType: context.req.header('content-type'),
'''
    new_authorize_content_type = '''  const result = await authorizeDatabasePermission({
    configured,
    allowedOrigins: context.env.AUTH_ALLOWED_WEB_ORIGINS,
    origin,
    contentType,
'''
    if (
        index.count(old_import) != 1
        or index.count(old_body) != 1
        or index.count(old_authorize_content_type) != 1
    ):
        raise SystemExit(
            'Expected AUTH-08 route markers once, found '
            f'import={index.count(old_import)} body={index.count(old_body)} '
            f'authorize={index.count(old_authorize_content_type)}.'
        )
    index_path.write_text(
        index.replace(old_import, new_import)
        .replace(old_body, new_body)
        .replace(old_authorize_content_type, new_authorize_content_type),
        encoding='utf-8',
    )
else:
    raise SystemExit('Usage: harden_auth_08_request_body.py test|implementation')
