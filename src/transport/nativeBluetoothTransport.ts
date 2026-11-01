/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transport } from './transport.ts';

/**
 * NativeBluetoothTransport Stub
 *
 * Designed for Android / iOS Capacitor deployments using a Bluetooth Serial (SPP) plugin
 * (e.g. `@capacitor-community/bluetooth-le` or `cordova-plugin-bluetooth-serial`).
 *
 * Target hardware device name: "ESP32-Arm"
 */
export class NativeBluetoothTransport implements Transport {
  // Device name filter for ESP32 Bluetooth Classic SPP or BLE UART
  public readonly targetDeviceName = 'ESP32-Arm';

  private lineCallback: ((line: string) => void) | null = null;
  private statusCallback: ((s: 'connected' | 'disconnected' | 'connecting' | 'error') => void) | null = null;
  private isConnected = false;

  onLine(cb: (line: string) => void): void {
    this.lineCallback = cb;
  }

  onStatus(cb: (s: 'connected' | 'disconnected' | 'connecting' | 'error') => void): void {
    this.statusCallback = cb;
  }

  async connect(): Promise<void> {
    this.statusCallback?.('connecting');

    // TODO: [Capacitor Plugin Integration]
    // 1. Check if running inside Capacitor native container:
    //    const isNative = Capacitor.isNativePlatform();
    // 2. Request Android Bluetooth permissions:
    //    BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION
    // 3. Scan for or connect to bonded device matching this.targetDeviceName ("ESP32-Arm"):
    //    await BluetoothSerial.connect({ address: deviceMacAddress });
    // 4. Subscribe to raw incoming stream with newline delimiter:
    //    BluetoothSerial.subscribe('\n', (line) => this.lineCallback?.(line));
    // 5. Update connection state: this.isConnected = true; this.statusCallback?.('connected');

    console.info(
      `[NativeBluetoothTransport] Stub connect called. Target device: "${this.targetDeviceName}". ` +
      `Native plugin will be attached during Android Capacitor build.`
    );

    // Provide helpful user notification in web environment
    await new Promise((res) => setTimeout(res, 300));
    this.statusCallback?.('error');
    throw new Error(
      `Native Bluetooth (SPP) for "${this.targetDeviceName}" is ready for Capacitor native wrapping. In desktop/mobile browser, please select "Simulator" or "Web Serial (USB/BT COM)".`
    );
  }

  async disconnect(): Promise<void> {
    // TODO: [Capacitor Plugin Integration]
    // await BluetoothSerial.disconnect();
    this.isConnected = false;
    this.statusCallback?.('disconnected');
  }

  async write(line: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Native Bluetooth is not connected.');
    }
    // TODO: [Capacitor Plugin Integration]
    // await BluetoothSerial.write({ data: line });
    void line;
  }
}
