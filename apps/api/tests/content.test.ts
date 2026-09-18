import { expect, test } from "bun:test";
import { ticketRateCreateSchema } from "@umbul-nogo/contracts/ticket-rates";
import { canonicalJson, intentHash } from "../src/content/canonical";

const ticket = {
  name: " Contoh tarif — data uji ",
  priceIdr: 0,
  unit: "per orang",
  terms: "Fixture",
  applicabilityNote: null,
  expectedContentVersion: 0,
};
test("hash memakai normalisasi/default, mengurutkan key rekursif, mempertahankan array dan null", () => {
  expect(intentHash(ticketRateCreateSchema.parse(ticket))).toBe(
    intentHash(
      ticketRateCreateSchema.parse({ ...ticket, name: ticket.name.trim(), isVisible: false }),
    ),
  );
  expect(canonicalJson({ z: [{ y: 2, x: 1 }], a: { "2": 2, "10": 10 } })).toBe(
    '{"a":{"10":10,"2":2},"z":[{"x":1,"y":2}]}',
  );
  expect(intentHash({ a: 1, b: { x: 2, y: 3 } })).toBe(intentHash({ b: { y: 3, x: 2 }, a: 1 }));
  expect(intentHash({ ids: [1, 2] })).not.toBe(intentHash({ ids: [2, 1] }));
  expect(intentHash({ value: null })).not.toBe(intentHash({ value: 0 }));
  expect(intentHash({ expectedContentVersion: 1 })).not.toBe(
    intentHash({ expectedContentVersion: 0 }),
  );
  expect(canonicalJson(-0)).toBe("0");
});
test("kanonisasi menolak nilai non-JSON agar tidak menyamakan niat berbeda", () => {
  for (const value of [
    undefined,
    NaN,
    Infinity,
    1n,
    new Date(),
    { x: undefined },
    [undefined],
    Array(2),
  ])
    expect(() => canonicalJson(value)).toThrow();
});
