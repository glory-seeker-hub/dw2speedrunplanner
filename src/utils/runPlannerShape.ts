import { z } from 'zod';

// Wire shape only. Gameplay, canonical IDs and chronological consistency remain
// owned by the shared storage/invariant validators, never a second rules engine.
const text = z.string();
const number = z.number().finite();
const strings = z.array(text);
const cap = z.object({ min: number, max: number, resolved: number.nullable() }).strict();
const source = z.discriminatedUnion('type', [
  z.object({ type: z.literal('starter') }).strict(),
  z.object({ type: z.literal('trade'), tradeId: text, givenInstanceId: text }).strict(),
  z.object({ type: z.literal('dna'), parentInstanceIds: z.tuple([text, text]) }).strict(),
  z.object({ type: z.literal('capture'), encounterId: number, enemySlot: number }).strict(),
]);
const techniqueSource = z.discriminatedUnion('type', [
  z.object({ type: z.literal('trade'), tradeId: text }).strict(),
  z.object({ type: z.literal('starter'), speciesId: text }).strict(),
  z.object({ type: z.literal('own-species'), speciesId: text }).strict(),
  z.object({ type: z.literal('capture'), encounterId: number, enemySlot: number }).strict(),
  z.object({ type: z.literal('inherited'), parentInstanceId: text }).strict(),
]);
const unlock = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available') }).strict(),
  z.object({ status: z.literal('discarded') }).strict(),
  z.object({ status: z.literal('pending'), level: number }).strict(),
  z.object({ status: z.literal('missed'), level: number }).strict(),
]);
const roster = z.array(z.object({
  instanceId: text, speciesId: text, name: text, source, level: number,
  totalXp: number, dp: number, levelCap: cap,
  stats: z.object({ hp: number, mp: number, atk: number, def: number, spd: number }).strict(),
  techs: strings,
  techniquePool: z.array(z.object({ key: text, name: text, rank: text, unlock, sources: z.array(techniqueSource) }).strict()),
}).strict());
const checkpoint = z.object({ roster, digiline: strings, totalBits: number }).strict();
const base = { id: text, order: number, preActionCheckpoint: checkpoint };
const event = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('battle'),
    techniqueMisses: z.array(z.object({ instanceId: text, missed: strings }).strict()).optional(),
    techniqueChoices: z.array(z.object({ instanceId: text, learned: strings, discarded: strings }).strict()),
    domainId: text, phase: text, floor: number, encounterId: number,
    digilineInstanceIds: strings, capturedEnemySlot: number.nullable(),
    capturedInstanceId: text.nullable(), capturedLevelCap: cap.nullable(), xpReward: number, bitsReward: number,
  }).strict(),
  z.object({ ...base, type: z.literal('digivolve'), instanceId: text,
    fromName: text, toName: text, fromSpeciesId: text, toSpeciesId: text,
    fromRank: text, toRank: text, level: number, dp: number, levelCap: cap, hpBonus: number, mpBonus: number,
  }).strict(),
  z.object({ ...base, type: z.literal('dna'),
    parentAInstanceId: text, parentBInstanceId: text, parentASpeciesId: text, parentAName: text,
    parentBSpeciesId: text, parentBName: text, childInstanceId: text, childSpeciesId: text, childName: text,
    matrixSelectionRank: text, matrixSelectionType: text, actualResultRank: text, actualResultType: text,
    isMutation: z.boolean(), childStartingLevel: number, childDp: number, childMaxLevel: number,
    techniqueChoice: z.object({ kept: strings, discarded: strings }).strict(),
  }).strict(),
  z.object({ ...base, type: z.literal('trade'), tradeId: text, givenInstanceId: text,
    givenSpeciesId: text, givenName: text, receivedInstanceId: text, receivedSpeciesId: text,
    receivedName: text, receivedLevel: number, receivedDp: number, receivedMaxLevel: number,
  }).strict(),
]);
export const runPlannerWireShape = z.object({
  schemaVersion: z.literal(7), activeRunId: text.nullable(),
  runs: z.array(z.object({ id: text, name: text, starterInstanceId: text.nullable(),
    starterDefinitionId: text, roster, digiline: strings, history: z.array(event),
    totalBits: number, createdAt: text, updatedAt: text,
  }).strict()),
}).strict();
