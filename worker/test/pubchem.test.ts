import { describe, expect, it, vi } from 'vitest';
import { lookupCompound, normalizeStructure, PubChemError } from '../src/pubchem';

/** 构造 PubChem PC-Compound 形状的 3D 甲烷记录（坐标为埃单位浮点数） */
function pcMethane3d() {
  return {
    PC_Compounds: [
      {
        atoms: { aid: [1, 2, 3, 4, 5], element: [6, 1, 1, 1, 1] },
        bonds: { aid1: [1, 1, 1, 1], aid2: [2, 3, 4, 5], order: [1, 1, 1, 1] },
        coords: [
          {
            type: [12, 3],
            aid: [1, 2, 3, 4, 5],
            conformers: [
              { x: [0.0, 0.6, -0.2, -0.2, -0.2], y: [0.0, 0.6, 0.6, -0.2, -0.2], z: [0.0, 0.6, -0.2, 0.6, -0.2] },
            ],
          },
        ],
      },
    ],
  };
}

function fakeFetcher(responses: Array<{ url: RegExp; body: unknown; status?: number }>) {
  const calls: string[] = [];
  const fn = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = responses.find((r) => r.url.test(url));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return Response.json(hit.body as object, { status: hit.status ?? 200 });
  });
  return { fn, calls };
}

describe('pubchem module', () => {
  it('normalizes a 3D PC-Compound into app structure (Z -> symbol)', () => {
    const { structure, structureType } = normalizeStructure(pcMethane3d().PC_Compounds[0]);
    expect(structureType).toBe('3d');
    expect(structure.atoms[0]).toMatchObject({ id: 1, element: 'C', x: 0, y: 0, z: 0 });
    expect(structure.atoms[1].element).toBe('H');
    expect(structure.bonds).toHaveLength(4);
    expect(structure.bonds.every((b) => b.order >= 1 && b.order <= 3)).toBe(true);
  });

  it('falls back to 2d when no 3d record exists (z defaults to 0)', async () => {
    const cidBody = { IdentifierList: { CID: [2244] } };
    const propBody = {
      PropertyTable: {
        Properties: [{ CID: 2244, IUPACName: 'aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: 180.16 }],
      },
    };
    const record2d = {
      PC_Compounds: [
        {
          atoms: { element: [6, 8] },
          bonds: { aid1: [1], aid2: [2], order: [2] },
          coords: [{ conformers: [{ x: [0, 1.3], y: [0, 0.8] }] }],
        },
      ],
    };
    const { fn } = fakeFetcher([
      { url: /\/cids\/JSON/, body: cidBody },
      { url: /record_type=3d/, body: { Fault: { Code: 'PUGREST.NotFound', Message: 'No 3D' } }, status: 404 },
      { url: /\/cid\/2244\/JSON/, body: record2d },
      { url: /\/property\//, body: propBody },
    ]);

    const rec = await lookupCompound('aspirin', fn);
    expect(rec.cid).toBe(2244);
    expect(rec.structureType).toBe('2d');
    expect(rec.structure.atoms[1]).toMatchObject({ element: 'O', z: 0 });
    expect(rec.molecularFormula).toBe('C9H8O4');
  });

  it('throws 404 PubChemError for unknown compound names', async () => {
    const { fn } = fakeFetcher([
      { url: /\/cids\/JSON/, body: { Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } }, status: 404 },
    ]);
    const err = await lookupCompound('zzzznotachemical', fn).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(PubChemError);
    expect((err as PubChemError).status).toBe(404);
  });

  it('retries once on ServerBusy before giving up', async () => {
    const cidBody = { IdentifierList: { CID: [2244] } };
    let cidsCalls = 0;
    const fn = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/cids/JSON')) {
        cidsCalls += 1;
        if (cidsCalls === 1) {
          return Response.json({ Fault: { Code: 'PUGREST.ServerBusy', Message: 'busy' } }, { status: 503 });
        }
        return Response.json(cidBody);
      }
      if (url.includes('record_type=3d')) return Response.json(pcMethane3d());
      return Response.json({ PropertyTable: { Properties: [{ CID: 2244 }] } });
    });

    const rec = await lookupCompound('methane', fn);
    expect(rec.structure.atoms).toHaveLength(5);
    expect(cidsCalls).toBe(2);
  });
});
