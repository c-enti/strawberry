export interface EnvVars {
  [key: string]: string | undefined;
}

export interface NetworkOptions {
  latency?: number; // Simulated network latency in ms
  failureRate?: number; // Rate of simulated network failures (0-1)
  timeout?: number; // Network timeout in ms
}

export interface DatabaseState {
  isOnline: boolean;
  responseTime?: number;
  connections?: number;
  errors?: string[];
}

export interface MetricsResult {
  duration: bigint; // Duration in nanoseconds
  success: boolean;
  memory?: {
    heapUsed: number;
    heapTotal: number;
  };
  error?: Error;
}
