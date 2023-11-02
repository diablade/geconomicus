import {ChangeDetectionStrategy, Component, Inject, VERSION} from '@angular/core';
import {BarcodeFormat} from '@zxing/library';
import {BehaviorSubject} from 'rxjs';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-scanner-dialog-v2',
  templateUrl: './scanner-dialog-v2.component.html',
  styleUrls: ['./scanner-dialog-v2.component.scss']
})
export class ScannerDialogV2Component {

  availableDevices: MediaDeviceInfo[] | undefined;
  deviceCurrent: MediaDeviceInfo | undefined;
  deviceSelected: string | undefined;

  formatsEnabled: BarcodeFormat[] = [
    BarcodeFormat.QR_CODE,
  ];

  hasDevices: boolean | undefined;
  hasPermission: boolean | undefined;

  qrResultString: string | undefined;

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(false);
  tryHarder = false;

  constructor(public dialogRef: MatDialogRef<ScannerDialogV2Component>, private readonly _dialog: MatDialog) {

  }

  clearResult(): void {
    this.qrResultString = undefined;
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
  }

  onCodeResult(resultString: string) {
    this.qrResultString = resultString;
    this.dialogRef.close(resultString);
  }

  onDeviceSelectChange(selected: string) {
    const selectedStr = selected || '';
    if (this.deviceSelected === selectedStr) {
      return;
    }
    this.deviceSelected = selectedStr;
    // @ts-ignore
    const device = this.availableDevices.find(x => x.deviceId === selected);
    this.deviceCurrent = device || undefined;
  }

  onDeviceChange(device: MediaDeviceInfo) {
    const selectedStr = device?.deviceId || '';
    if (this.deviceSelected === selectedStr) {
      return;
    }
    this.deviceSelected = selectedStr;
    this.deviceCurrent = device || undefined;
  }

  onHasPermission(has: boolean) {
    this.hasPermission = has;
  }

  openInfoDialog() {
    const data = {
      hasDevices: this.hasDevices,
      hasPermission: this.hasPermission,
    };

    this._dialog.open(AppInfoDialogComponent, {data});
  }

  onTorchCompatible(isCompatible: boolean): void {
    this.torchAvailable$.next(isCompatible || false);
  }

  toggleTorch(): void {
    this.torchEnabled = !this.torchEnabled;
  }

  toggleTryHarder(): void {
    this.tryHarder = !this.tryHarder;
  }
}

@Component({
  selector: 'app-info-dialog',
  template: `
    <table class="table-scanner-state">
      <thead>
      <tr>
        <th>Status</th>
        <th>Property</th>
      </tr>
      </thead>
      <tbody>
      <tr>
        <td><code>{{ stateToEmoji(hasDevices) }}</code></td>
        <td>Devices</td>
      </tr>
      <tr>
        <td><code>{{ stateToEmoji(hasPermission) }}</code></td>
        <td>Permissions</td>
      </tr>
      </tbody>
    </table>

    <p matLine class="ng-version">Angular version: {{ ngVersion }}</p>
    <mat-dialog-actions>
      <button mat-flat-button color="primary" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInfoDialogComponent {

  hasDevices: boolean;
  hasPermission: boolean;
  ngVersion = VERSION.full;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: any,
  ) {
    this.hasDevices = data.hasDevices;
    this.hasPermission = data.hasPermission;
  }

  stateToEmoji(state: boolean): string {

    const states = {
      // not checked
      undefined: '❔',
      // failed to check
      null: '⭕',
      // success
      true: '✔',
      // can't touch that
      false: '❌'
    };

    // @ts-ignore
    return states['' + state];
  }
}
