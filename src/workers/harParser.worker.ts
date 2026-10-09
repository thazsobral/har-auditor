/**
 * Web Worker for Streaming HAR Parsing & Security Diagnostics
 * Reads the File via streams (file.stream()), tracks progress,
 * normalizes HAR 1.2 records, and performs automated client-side security audits.
 */

import type {
  HarRoot,
  HarMetrics,
  EnrichedHarEntry,
  SecurityIssue,
  SecuritySeverity,
  HarHeader,
  HarCookie,
} from '../types/har.ts';

export type WorkerInMessage =
  | { type: 'PARSE_FILE'; file: File }
  | { type: 'PARSE_TEXT'; text: string; fileName: string; fileSize: number };

export type WorkerOutMessage =
  | {
      type: 'PROGRESS';
      stage: 'reading' | 'parsing' | 'analyzing';
      progress: number;
      bytesRead: number;
      totalBytes: number;
      message?: string;
    }
  | {
      type: 'SUCCESS';
      har: HarRoot;
      metrics: HarMetrics;
      fileName: string;
      fileSize: number;
    }
  | {
      type: 'ERROR';
      error: string;
    };

// Heuristic pattern definitions for security auditing
const SENSITIVE_QUERY_PARAMS = [
  'token',
  'access_token',
  'auth',
  'api_key',
  'apikey',
  'secret',
  'password',
  'jwt',
  'bearer',
  'session',
  'sessionid',
  'client_secret',
  'key',
];

const SENSITIVE_COOKIE_NAMES = [
  'session',
  'sessionid',
  'sess',
  'token',
  'jwt',
  'auth',
  'authtoken',
  'id_token',
  'refresh_token',
  'sid',
  'connect.sid',
];

function determineResourceType(
  url: string,
  mimeType: string = ''
): EnrichedHarEntry['resourceType'] {
  const mime = mimeType.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (mime.includes('text/html')) return 'document';
  if (mime.includes('application/json') || mime.includes('text/plain')) {
    if (lowerUrl.includes('/api/') || lowerUrl.includes('/v1/') || lowerUrl.includes('/graphql')) {
      return 'fetch';
    }
    return 'xhr';
  }
  if (mime.includes('javascript') || lowerUrl.endsWith('.js') || lowerUrl.endsWith('.mjs')) return 'script';
  if (mime.includes('text/css') || lowerUrl.endsWith('.css')) return 'stylesheet';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|ico|avif)(\?|$)/i.test(lowerUrl)) return 'image';
  if (mime.includes('font') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(lowerUrl)) return 'font';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media';
  if (lowerUrl.startsWith('ws://') || lowerUrl.startsWith('wss://')) return 'websocket';

  return 'other';
}

function auditEntrySecurity(
  entry: any,
  entryId: string,
  primaryHostname: string
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const request = entry.request || {};
  const response = entry.response || {};
  const urlStr = request.url || '';

  let parsed: URL | null = null;
  try {
    parsed = new URL(urlStr);
  } catch {
    // Malformed URL
  }

  // 1. Cleartext HTTP Transport
  if (parsed && parsed.protocol === 'http:') {
    issues.push({
      id: `${entryId}-cleartext`,
      entryId,
      severity: 'high',
      category: 'transport',
      title: 'Insecure Cleartext HTTP Protocol',
      description: `Request transmitting data without TLS encryption (${parsed.origin}). Sensitive payloads may be intercepted by man-in-the-middle attackers.`,
      recommendation: 'Enforce HTTPS via HTTP Strict Transport Security (HSTS) and 301 redirects.',
      cwe: 'CWE-319: Cleartext Transmission of Sensitive Information',
      evidence: request.url,
    });
  }

  // 2. Sensitive Credential / Token Leaks in URL query parameters
  if (parsed) {
    for (const [key, val] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_QUERY_PARAMS.some((param) => lowerKey.includes(param)) &&
        val.length > 4
      ) {
        issues.push({
          id: `${entryId}-param-leak-${key}`,
          entryId,
          severity: 'critical',
          category: 'leakage',
          title: `Sensitive Token Exposed in URL Query String (${key})`,
          description: `Query parameter "${key}" contains sensitive token or credential data. URLs are logged in web server access logs, browser history, and Referer headers.`,
          recommendation: 'Transmit authorization tokens via HTTP headers (e.g., Authorization: Bearer <token>) or encrypted POST payloads.',
          cwe: 'CWE-598: Use of GET Request Method With Sensitive Query Strings',
          evidence: `${key}=${val.slice(0, 4)}...[REDACTED]`,
        });
      }
    }
  }

  // 3. Response Security Headers Analysis (for HTML documents and APIs)
  const respHeaders: HarHeader[] = response.headers || [];
  const headerMap = new Map<string, string>();
  for (const h of respHeaders) {
    if (h && h.name) {
      headerMap.set(h.name.toLowerCase(), h.value);
    }
  }

  const mime = (response.content?.mimeType || '').toLowerCase();
  const isDocument = mime.includes('text/html');

  if (isDocument) {
    // Missing Content-Security-Policy
    if (!headerMap.has('content-security-policy')) {
      issues.push({
        id: `${entryId}-missing-csp`,
        entryId,
        severity: 'medium',
        category: 'headers',
        title: 'Missing Content-Security-Policy (CSP)',
        description: 'Document does not define a CSP header, leaving application vulnerable to Cross-Site Scripting (XSS) and data injection.',
        recommendation: "Define a restrictive Content-Security-Policy header (e.g., default-src 'self').",
        cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers or Scripts',
      });
    }

    // Missing X-Frame-Options or frame-ancestors
    if (!headerMap.has('x-frame-options') && !headerMap.get('content-security-policy')?.includes('frame-ancestors')) {
      issues.push({
        id: `${entryId}-missing-xfo`,
        entryId,
        severity: 'medium',
        category: 'headers',
        title: 'Missing Clickjacking Defense (X-Frame-Options)',
        description: 'No X-Frame-Options or CSP frame-ancestors directive configured. The page may be embedded inside malicious iframes.',
        recommendation: 'Send "X-Frame-Options: DENY" or "SAMEORIGIN".',
        cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers or Frames',
      });
    }
  }

  // Missing Strict-Transport-Security on HTTPS responses
  if (parsed?.protocol === 'https:' && !headerMap.has('strict-transport-security')) {
    issues.push({
      id: `${entryId}-missing-hsts`,
      entryId,
      severity: 'low',
      category: 'transport',
      title: 'Missing HSTS (Strict-Transport-Security)',
      description: 'The server does not enforce HTTPS connections for future visits via HSTS.',
      recommendation: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains".',
      cwe: 'CWE-523: Unprotected Transport-Layer Information Pre-condition',
    });
  }

  // Missing X-Content-Type-Options
  if (!headerMap.has('x-content-type-options')) {
    issues.push({
      id: `${entryId}-missing-xcto`,
      entryId,
      severity: 'low',
      category: 'headers',
      title: 'Missing X-Content-Type-Options Header',
      description: 'MIME-sniffing protection header is absent. Browsers may misinterpret content types.',
      recommendation: 'Add "X-Content-Type-Options: nosniff".',
      cwe: 'CWE-79: Cross-site Scripting through MIME Confusion',
    });
  }

  // Wildcard CORS with Authorization
  const corsOrigin = headerMap.get('access-control-allow-origin');
  const reqHeaders: HarHeader[] = request.headers || [];
  const hasAuth = reqHeaders.some((h) => h.name.toLowerCase() === 'authorization' || h.name.toLowerCase() === 'cookie');

  if (corsOrigin === '*' && hasAuth) {
    issues.push({
      id: `${entryId}-permissive-cors`,
      entryId,
      severity: 'high',
      category: 'cors',
      title: 'Overly Permissive CORS Origin (*)',
      description: 'Server returns "Access-Control-Allow-Origin: *" on an endpoint receiving credentials or authorization tokens.',
      recommendation: 'Restrict allowed origins to trusted domains and avoid wildcard origins on authenticated endpoints.',
      cwe: 'CWE-942: Permissive Cross-Domain Policy with Credentials',
    });
  }

  // 4. Insecure Cookies Analysis
  const cookies: HarCookie[] = response.cookies || [];
  for (const c of cookies) {
    const isSessionCookie = SENSITIVE_COOKIE_NAMES.some((s) => c.name.toLowerCase().includes(s));
    
    // Missing Secure flag
    if (!c.secure) {
      issues.push({
        id: `${entryId}-cookie-${c.name}-insecure`,
        entryId,
        severity: isSessionCookie ? 'high' : 'medium',
        category: 'auth',
        title: `Cookie "${c.name}" Missing "Secure" Flag`,
        description: `Cookie is not marked as Secure, allowing transmission over unencrypted HTTP channels.`,
        recommendation: 'Set the "; Secure" attribute on all sensitive cookies.',
        cwe: 'CWE-614: Sensitive Cookie in HTTPS Session Without Secure Attribute',
        evidence: `Set-Cookie: ${c.name}=...`,
      });
    }

    // Missing HttpOnly on sensitive token/session cookie
    if (!c.httpOnly && isSessionCookie) {
      issues.push({
        id: `${entryId}-cookie-${c.name}-nohttponly`,
        entryId,
        severity: 'high',
        category: 'auth',
        title: `Session Cookie "${c.name}" Missing "HttpOnly" Flag`,
        description: `Cookie can be accessed via client-side JavaScript document.cookie, making it vulnerable to session hijacking via XSS.`,
        recommendation: 'Set the "; HttpOnly" attribute on session and authentication cookies.',
        cwe: 'CWE-1004: Sensitive Cookie Without HttpOnly Flag',
        evidence: `Set-Cookie: ${c.name}=...`,
      });
    }

    // Missing or weak SameSite attribute
    if (!c.sameSite || c.sameSite.toLowerCase() === 'none') {
      issues.push({
        id: `${entryId}-cookie-${c.name}-samesite`,
        entryId,
        severity: isSessionCookie ? 'medium' : 'low',
        category: 'auth',
        title: `Cookie "${c.name}" Weak or Missing "SameSite" Attribute`,
        description: `Cookie lacks SameSite=Lax or SameSite=Strict, potentially exposing endpoints to Cross-Site Request Forgery (CSRF).`,
        recommendation: 'Set SameSite=Lax or SameSite=Strict on state-changing cookies.',
        cwe: 'CWE-1275: Sensitive Cookie with Improper SameSite Attribute',
      });
    }
  }

  return issues;
}

async function streamFileToText(
  file: File,
  onProgress: (bytesRead: number, totalBytes: number) => void
): Promise<string> {
  const totalBytes = file.size;
  let bytesRead = 0;

  // Utilize ReadableStream API
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let result = '';

  let lastReportTime = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      bytesRead += value.length;
      result += decoder.decode(value, { stream: true });

      const now = performance.now();
      if (now - lastReportTime > 80 || bytesRead === totalBytes) {
        lastReportTime = now;
        onProgress(bytesRead, totalBytes);
      }
    }
  }

  result += decoder.decode(); // flush
  return result;
}

function processHar(
  rawJson: string,
  fileName: string,
  fileSize: number
): { har: HarRoot; metrics: HarMetrics } {
  // Parsing stage
  postMessage({
    type: 'PROGRESS',
    stage: 'parsing',
    progress: 85,
    bytesRead: fileSize,
    totalBytes: fileSize,
    message: 'Parsing JSON structure...',
  } as WorkerOutMessage);

  const rawParsed = JSON.parse(rawJson);

  if (!rawParsed || !rawParsed.log) {
    throw new Error('Formato HAR inválido: objeto raiz deve conter a propriedade "log".');
  }

  const log = rawParsed.log;
  const rawEntries: any[] = Array.isArray(log.entries) ? log.entries : [];

  // Stage: Security diagnostics and enrichment
  postMessage({
    type: 'PROGRESS',
    stage: 'analyzing',
    progress: 92,
    bytesRead: fileSize,
    totalBytes: fileSize,
    message: 'Executando auditoria de segurança e diagnóstico...',
  } as WorkerOutMessage);

  // Identify primary domain from pages or first entry
  let primaryHostname = '';
  if (rawEntries.length > 0 && rawEntries[0].request?.url) {
    try {
      primaryHostname = new URL(rawEntries[0].request.url).hostname;
    } catch {
      // ignore
    }
  }

  const metrics: HarMetrics = {
    totalRequests: rawEntries.length,
    totalSize: 0,
    totalTransferred: 0,
    totalErrors: 0,
    totalDurationMs: 0,
    statusCounts: {
      ok: 0,
      redirect: 0,
      clientError: 0,
      serverError: 0,
      failed: 0,
    },
    methodCounts: {},
    mimeTypeCounts: {},
    domainsCount: 0,
    thirdPartyCount: 0,
    securitySummary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    },
  };

  const domainSet = new Set<string>();
  const enrichedEntries: EnrichedHarEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const id = `entry-${i}-${Math.random().toString(36).slice(2, 7)}`;
    const req = raw.request || {};
    const res = raw.response || {};
    const status = typeof res.status === 'number' ? res.status : 0;
    const urlStr = req.url || '';

    let parsedUrl = {
      protocol: '',
      hostname: '',
      pathname: '',
      search: '',
      port: '',
      isHttps: false,
      isThirdParty: false,
    };

    try {
      const u = new URL(urlStr);
      parsedUrl = {
        protocol: u.protocol,
        hostname: u.hostname,
        pathname: u.pathname,
        search: u.search,
        port: u.port,
        isHttps: u.protocol === 'https:',
        isThirdParty: primaryHostname ? !u.hostname.endsWith(primaryHostname) : false,
      };
      domainSet.add(u.hostname);
      if (parsedUrl.isThirdParty) {
        metrics.thirdPartyCount++;
      }
    } catch {
      // invalid URL string fallback
      parsedUrl.pathname = urlStr;
    }

    // Method counts
    const method = (req.method || 'GET').toUpperCase();
    metrics.methodCounts[method] = (metrics.methodCounts[method] || 0) + 1;

    // MIME type counts
    const mime = (res.content?.mimeType || 'unknown').split(';')[0].trim().toLowerCase();
    metrics.mimeTypeCounts[mime] = (metrics.mimeTypeCounts[mime] || 0) + 1;

    // Sizes
    const resSize = Number(res.content?.size) || 0;
    const bodySize = Number(res.bodySize) >= 0 ? Number(res.bodySize) : resSize;
    const headersSize = Number(res.headersSize) >= 0 ? Number(res.headersSize) : 0;
    const transferSize = bodySize + headersSize;

    metrics.totalSize += resSize;
    metrics.totalTransferred += transferSize > 0 ? transferSize : resSize;

    // Duration
    const duration = Number(raw.time) || 0;
    metrics.totalDurationMs += duration;

    // Status classifications
    let statusCategory: EnrichedHarEntry['statusCategory'] = '2xx';
    let isError = false;

    if (status === 0 || status === undefined) {
      statusCategory = 'failed';
      isError = true;
      metrics.statusCounts.failed++;
    } else if (status >= 100 && status < 200) {
      statusCategory = '1xx';
    } else if (status >= 200 && status < 300) {
      statusCategory = '2xx';
      metrics.statusCounts.ok++;
    } else if (status >= 300 && status < 400) {
      statusCategory = '3xx';
      metrics.statusCounts.redirect++;
    } else if (status >= 400 && status < 500) {
      statusCategory = '4xx';
      isError = true;
      metrics.statusCounts.clientError++;
    } else if (status >= 500) {
      statusCategory = '5xx';
      isError = true;
      metrics.statusCounts.serverError++;
    }

    if (isError) {
      metrics.totalErrors++;
    }

    // Security audit for this entry
    const securityIssues = auditEntrySecurity(raw, id, primaryHostname);
    for (const issue of securityIssues) {
      metrics.securitySummary[issue.severity]++;
      metrics.securitySummary.total++;
    }

    const resourceType = determineResourceType(urlStr, mime);

    enrichedEntries.push({
      id,
      index: i,
      pageref: raw.pageref,
      startedDateTime: raw.startedDateTime || new Date().toISOString(),
      time: duration,
      request: req,
      response: res,
      cache: raw.cache || {},
      timings: raw.timings || { send: 0, wait: 0, receive: 0 },
      serverIPAddress: raw.serverIPAddress,
      connection: raw.connection,
      comment: raw.comment,
      parsedUrl,
      resourceType,
      isError,
      statusCategory,
      securityIssues,
    });
  }

  metrics.domainsCount = domainSet.size;

  if (enrichedEntries.length > 0) {
    metrics.startTime = enrichedEntries[0].startedDateTime;
    metrics.endTime = enrichedEntries[enrichedEntries.length - 1].startedDateTime;
  }

  const har: HarRoot = {
    log: {
      version: log.version || '1.2',
      creator: log.creator || { name: 'HAR Auditor Client', version: '1.0' },
      browser: log.browser,
      pages: log.pages || [],
      entries: enrichedEntries,
      comment: log.comment,
    },
  };

  return { har, metrics };
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const data = e.data;

  try {
    let rawText = '';
    let fileName = 'arquivo.har';
    let fileSize = 0;

    if (data.type === 'PARSE_FILE') {
      fileName = data.file.name;
      fileSize = data.file.size;

      postMessage({
        type: 'PROGRESS',
        stage: 'reading',
        progress: 1,
        bytesRead: 0,
        totalBytes: fileSize,
        message: 'Lendo dados via ReadableStream...',
      } as WorkerOutMessage);

      rawText = await streamFileToText(data.file, (bytesRead, totalBytes) => {
        const progress = Math.min(80, Math.round((bytesRead / totalBytes) * 80));
        postMessage({
          type: 'PROGRESS',
          stage: 'reading',
          progress,
          bytesRead,
          totalBytes,
          message: `Lendo stream: ${(bytesRead / (1024 * 1024)).toFixed(2)} MB processados...`,
        } as WorkerOutMessage);
      });
    } else if (data.type === 'PARSE_TEXT') {
      rawText = data.text;
      fileName = data.fileName;
      fileSize = data.fileSize;
    }

    const { har, metrics } = processHar(rawText, fileName, fileSize);

    postMessage({
      type: 'PROGRESS',
      stage: 'analyzing',
      progress: 100,
      bytesRead: fileSize,
      totalBytes: fileSize,
      message: 'Concluído com sucesso!',
    } as WorkerOutMessage);

    postMessage({
      type: 'SUCCESS',
      har,
      metrics,
      fileName,
      fileSize,
    } as WorkerOutMessage);
  } catch (err: any) {
    postMessage({
      type: 'ERROR',
      error: err?.message || 'Falha ao processar arquivo HAR.',
    } as WorkerOutMessage);
  }
};
