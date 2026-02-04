/**
 * Debug Utilities
 *
 * Consistent debugging and logging utilities for the application
 */

import { browser } from '$app/environment';
import { errorLogger } from '$lib/utils/error-handler';

/**
 * Debug logging utility with consistent formatting
 */
export class DebugLogger {
  private static instance: DebugLogger;
  private isEnabled: boolean = false;

  private constructor() {
    // Check if debug mode is enabled (can be set via environment variable or config)
    this.isEnabled = import.meta.env.DEV || false;
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  /**
   * Enable debug logging
   */
  enable(): void {
    this.isEnabled = true;
    errorLogger.setLogLevel('debug');
  }

  /**
   * Disable debug logging
   */
  disable(): void {
    this.isEnabled = false;
    errorLogger.setLogLevel('error');
  }

  /**
   * Log debug information
   */
  log(message: string, data?: any, context?: any): void {
    if (this.isEnabled) {
      const logData = {
        timestamp: new Date().toISOString(),
        message,
        data,
        context,
        userAgent: browser ? navigator.userAgent : 'server',
        url: browser ? window.location.href : undefined
      };

      errorLogger.logDebug(`[DEBUG] ${message}`, context);

      if (data) {
        console.debug(`[DEBUG] ${message}:`, data);
      }
    }
  }

  /**
   * Log performance measurements
   */
  performance(label: string, duration: number, context?: any): void {
    if (this.isEnabled) {
      errorLogger.logDebug(`[PERFORMANCE] ${label}: ${duration}ms`, context);
      console.debug(`[PERFORMANCE] ${label}: ${duration}ms`);
    }
  }

  /**
   * Measure function execution time
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      this.performance(label, end - start);
      return result;
    } catch (error) {
      const end = performance.now();
      this.performance(`${label} (failed)`, end - start);
      throw error;
    }
  }
}

/**
 * Global debug logger instance
 */
export const debugLogger = DebugLogger.getInstance();
