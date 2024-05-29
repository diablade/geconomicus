import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {NgxScannerQrcodeComponent, ScannerQRCodeConfig, ScannerQRCodeResult} from "ngx-scanner-qrcode";
import {MatDialogRef} from "@angular/material/dialog";


@Component({
	selector: 'app-scanner-dialog-v3',
	templateUrl: './scanner-dialog-v3.component.html',
	styleUrls: ['./scanner-dialog-v3.component.scss']
})
export class ScannerDialogV3Component implements AfterViewInit, OnDestroy{
	@ViewChild('action') scanner!: NgxScannerQrcodeComponent;

	config: ScannerQRCodeConfig = {
		fps: 4,
		vibrate: 300, /** support mobile */
	};

	constructor(public dialogRef: MatDialogRef<ScannerDialogV3Component>) {
	}


	closeDialog(): void {
		this.scanner.stop();
		this.dialogRef.close();
	}

	onEvent($event: ScannerQRCodeResult[], scanner: NgxScannerQrcodeComponent) {
		this.scanner.stop();
		this.dialogRef.close($event[0].value);
	}

	public handle(scanner: any, fn: string): void {
		const playDeviceFacingBack = (devices: any[]) => {
			// front camera or back camera check here!
			const device = devices.find(f => (/back|rear|environment/gi.test(f.label))); // Default Back Facing Camera
			scanner.playDevice(device ? device.deviceId : devices[0].deviceId);
		}

		if (fn === 'start') {
			scanner[fn](playDeviceFacingBack);
		} else {
			scanner[fn]();
		}
	}

	ngAfterViewInit(): void {
		this.scanner.isReady.subscribe((res: any) => {
			this.handle(this.scanner, 'start');
		});
	}

	ngOnDestroy(): void {
		this.scanner.stop();
	}
}
