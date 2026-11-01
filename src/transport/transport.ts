/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(line: string): Promise<void>; // appends nothing; caller includes "\n"
  onLine(cb: (line: string) => void): void;
  onStatus(cb: (s: 'connected' | 'disconnected' | 'connecting' | 'error') => void): void;
}
