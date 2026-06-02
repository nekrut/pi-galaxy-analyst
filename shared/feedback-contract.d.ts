export declare const SCHEMA_VERSION: 1;
export declare const FEEDBACK_ROUTE: "/feedback";
export declare const FEEDBACK_KEY_HEADER: "X-Orbit-Feedback-Key";
export declare const FEEDBACK_ENDPOINT_URL: string;

export interface FeedbackSysinfo {
  appVersion?: string;
  platform?: string;
  arch?: string;
  electron?: string;
  chrome?: string;
  node?: string;
  llmProvider?: string;
  llmModel?: string;
  galaxyConfigured?: boolean;
}

export interface FeedbackPayload {
  schemaVersion: 1;
  source: "orbit" | "loom-cli";
  title: string;
  body: string;
  sysinfo?: FeedbackSysinfo;
  activityTail?: string;
  shellTail?: string;
  clientTs: string;
}

export declare function validateFeedbackPayload(obj: unknown): obj is FeedbackPayload;
