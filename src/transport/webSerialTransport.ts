/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transport } from './transport.ts';

// Web Serial API types
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort(options?: unknown): Promise<SerialPort>;
  };
}

export class WebSerialTransport implements Transport {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private lineCallback: ((line: string) => void) | null = null;
  private statusCallback: ((s: 'connected' | 'disconnected' | 'connecting' | 'error') => void) | null = null;
  private isReading = false;
  private readBuffer = '';
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  onLine(cb: (line: string) => void): void {
    this.lineCallback = cb;
  }

  onStatus(cb: (s: 'connected' | 'disconnected' | 'connecting' | 'error') => void): void {
    this.statusCallback = cb;
  }

  async connect(): Promise<void> {
    const nav = navigator as NavigatorWithSerial;
    if (!nav.serial) {
      this.statusCallback?.('error');
      throw new Error(
        'Web Serial API is not supported on this browser. Use desktop Chrome, Edge, or Opera over USB / paired Bluetooth COM port.'
      );
    }

    try {
      this.statusCallback?.('connecting');
      this.port = await nav.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }

      this.isReading = true;
      this.readLoop();

      this.statusCallback?.('connected');
    } catch (err: unknown) {
      this.statusCallback?.('error');
      this.port = null;
      throw err;
    }
  }

  private async readLoop() {
    if (!this.port || !this.port.readable) return;
    try {
      this.reader = this.port.readable.getReader();
      while (this.isReading && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.readBuffer += this.textDecoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = this.readBuffer.indexOf('\n')) >= 0) {
            const line = this.readBuffer.substring(0, newlineIndex);
            this.readBuffer = this.readBuffer.substring(newlineIndex + 1);
            if (this.lineCallback) {
              this.lineCallback(line);
            }
          }
        }
      }
    } catch {
      if (this.isReading) {
        this.statusCallback?.('error');
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
  }

  async write(line: string): Promise<void> {
    if (!this.writer) {
      throw new Error('WebSerial transport is not connected.');
    }
    const data = this.textEncoder.encode(line);
    await this.writer.write(data);
  }

  async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      console.warn('Error during serial port close:', e);
    }
    this.statusCallback?.('disconnected');
  }
}
