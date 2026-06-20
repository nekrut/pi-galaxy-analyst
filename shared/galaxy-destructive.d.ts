export interface GalaxyDestructiveOp {
  kind: "history-delete" | "history-purge" | "dataset-delete" | "dataset-purge";
  historyId?: string;
  datasetId?: string;
  irreversible: boolean;
}
export function classifyGalaxyDestructive(
  toolName: string,
  input: Record<string, unknown>,
): GalaxyDestructiveOp | null;
export function describeGalaxyDestructive(op: GalaxyDestructiveOp): { headline: string };
export function isGalaxyDestructiveCurl(command: string): GalaxyDestructiveOp | null;
