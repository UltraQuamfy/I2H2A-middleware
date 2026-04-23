import fetch from 'node-fetch';
import { resolveDidDocument } from '../src/resolve-did';

jest.mock('node-fetch', () => jest.fn());

const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

function mockResolverJson(ok: boolean, status: number, body: unknown): void {
  mockedFetch.mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Awaited<ReturnType<typeof fetch>>);
}

describe('resolveDidDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves did:key locally without any network call', async () => {
    const did = 'did:key:zDnaeiboHoaMf4yS2Nn81WhnWL7Khz16WYs7MNNUFW5kSNDUz';

    const doc = await resolveDidDocument(did);

    expect(doc.id).toBe(did);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('returns correct verification method for a valid did:key (P-256, multicodec 0x1200)', async () => {
    const did = 'did:key:zDnaeiboHoaMf4yS2Nn81WhnWL7Khz16WYs7MNNUFW5kSNDUz';

    const doc = await resolveDidDocument(did);
    const vm = doc.verificationMethod?.[0];

    expect(vm).toBeDefined();
    expect(vm?.type).toBe('JsonWebKey2020');
    expect(vm?.controller).toBe(did);
    expect(vm?.id).toBe(`${did}#${did.slice('did:key:'.length)}`);
    expect(vm?.publicKeyJwk).toMatchObject({
      kty: 'EC',
      crv: 'P-256',
    });
    expect(typeof vm?.publicKeyJwk?.x).toBe('string');
    expect((vm?.publicKeyJwk?.x as string).length).toBeGreaterThan(0);
  });

  it.each([
    '',
    'example:123',
    'did:',
  ])('throws for an invalid DID string: %p', async (did) => {
    await expect(resolveDidDocument(did)).rejects.toThrow();
  });

  it('resolves did:example via universal resolver when mocked', async () => {
    const exampleDid = 'did:example:123';
    const expected = {
      id: exampleDid,
      verificationMethod: [
        {
          id: `${exampleDid}#key-1`,
          type: 'JsonWebKey2020',
          controller: exampleDid,
          publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
        },
      ],
    };
    mockResolverJson(true, 200, { didDocument: expected });

    const doc = await resolveDidDocument(exampleDid, 'https://dev.uniresolver.io/1.0/identifiers/');

    expect(doc).toEqual(expected);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://dev.uniresolver.io/1.0/identifiers/did%3Aexample%3A123',
      { headers: { Accept: 'application/did+json,application/json' } }
    );
  });

  it('throws when universal resolver returns non-200 for did:web', async () => {
    mockResolverJson(false, 503, {});

    await expect(
      resolveDidDocument('did:web:example.com', 'https://dev.uniresolver.io/1.0/identifiers/')
    ).rejects.toThrow(
      'DID resolution HTTP 503 from https://dev.uniresolver.io/1.0/identifiers/: did:web:example.com'
    );
  });

  it('throws when universal resolver returns no didDocument for did:web', async () => {
    mockResolverJson(true, 200, { didResolutionMetadata: {} });

    await expect(
      resolveDidDocument('did:web:example.com', 'https://dev.uniresolver.io/1.0/identifiers/')
    ).rejects.toThrow(
      'DID resolver returned no didDocument for did:web:example.com (resolver: https://dev.uniresolver.io/1.0/identifiers/)'
    );
  });

  it('resolves did:web via universal resolver and returns didDocument', async () => {
    const webDid = 'did:web:example.com';
    const expected = {
      id: webDid,
      verificationMethod: [
        {
          id: `${webDid}#key-1`,
          type: 'JsonWebKey2020',
          controller: webDid,
          publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
        },
      ],
    };
    mockResolverJson(true, 200, { didDocument: expected });

    const doc = await resolveDidDocument(webDid, 'https://dev.uniresolver.io/1.0/identifiers/');

    expect(doc).toEqual(expected);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://dev.uniresolver.io/1.0/identifiers/did%3Aweb%3Aexample.com',
      { headers: { Accept: 'application/did+json,application/json' } }
    );
  });

  it('strips fragment from DID before resolving', async () => {
    const didWithFragment = 'did:key:zDnaeiboHoaMf4yS2Nn81WhnWL7Khz16WYs7MNNUFW5kSNDUz#key-1';

    const doc = await resolveDidDocument(didWithFragment);

    expect(doc.id).toBe('did:key:zDnaeiboHoaMf4yS2Nn81WhnWL7Khz16WYs7MNNUFW5kSNDUz');
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
