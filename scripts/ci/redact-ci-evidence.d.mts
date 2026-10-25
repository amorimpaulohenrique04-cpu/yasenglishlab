type CIEnv = Record<string, string | undefined>;
export function redactCIText(text: string, env?: CIEnv): string;
export function sanitizeEvidence(root: string, env?: CIEnv): Promise<void>;
