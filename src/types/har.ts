/**
 * HAR (HTTP Archive) 1.2 Specification & Security Analysis Types
 * Extended with forensic and audit metadata for client-side investigation.
 */

export interface HarHeader {
  name: string;
  value: string;
  comment?: string;
}

export interface HarQueryString {
  name: string;
  value: string;
  comment?: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | string;
  comment?: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: Array<{
    name: string;
    value?: string;
    fileName?: string;
    contentType?: string;
    comment?: string;
  }>;
  comment?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryString[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: 'base64' | string;
  comment?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number; // TTFB
  receive: number;
  ssl?: number;
  comment?: string;
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityIssue {
  id: string;
  entryId: string;
  severity: SecuritySeverity;
  category: 'auth' | 'headers' | 'transport' | 'leakage' | 'cors' | 'privacy';
  title: string;
  description: string;
  recommendation: string;
  cwe?: string;
  evidence?: string;
}

export interface EnrichedHarEntry {
  id: string;
  index: number;
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: Record<string, unknown>;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;

  // Forensic & Audit enrichments
  parsedUrl: {
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
    port: string;
    isHttps: boolean;
    isThirdParty: boolean;
  };
  resourceType: 'document' | 'xhr' | 'fetch' | 'script' | 'stylesheet' | 'image' | 'font' | 'media' | 'websocket' | 'other';
  isError: boolean;
  statusCategory: '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'failed';
  securityIssues: SecurityIssue[];
}

export interface HarPageTiming {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTiming;
  comment?: string;
}

export interface HarCreator {
  name: string;
  version: string;
  comment?: string;
}

export interface HarLog {
  version: string;
  creator: HarCreator;
  browser?: HarCreator;
  pages?: HarPage[];
  entries: EnrichedHarEntry[];
  comment?: string;
}

export interface HarRoot {
  log: HarLog;
}

export interface HarMetrics {
  totalRequests: number;
  totalSize: number;
  totalTransferred: number;
  totalErrors: number;
  totalDurationMs: number;
  statusCounts: {
    ok: number; // 2xx
    redirect: number; // 3xx
    clientError: number; // 4xx
    serverError: number; // 5xx
    failed: number; // 0 or network error
  };
  methodCounts: Record<string, number>;
  mimeTypeCounts: Record<string, number>;
  domainsCount: number;
  thirdPartyCount: number;
  securitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  startTime?: string;
  endTime?: string;
}
