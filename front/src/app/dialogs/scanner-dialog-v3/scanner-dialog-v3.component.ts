import {AfterViewInit, Component, ViewChild} from '@angular/core';
import {NgxScannerQrcodeComponent, ScannerQRCodeConfig, ScannerQRCodeResult} from "ngx-scanner-qrcode";
import {MatDialogRef} from "@angular/material/dialog";


@Component({
	selector: 'app-scanner-dialog-v3',
	templateUrl: './scanner-dialog-v3.component.html',
	styleUrls: ['./scanner-dialog-v3.component.scss']
})
export class ScannerDialogV3Component implements AfterViewInit {
	@ViewChild('action') action!: NgxScannerQrcodeComponent;

	config: ScannerQRCodeConfig = {
		fps: 4,
		vibrate: 300, /** support mobile */
	};

	constructor(public dialogRef: MatDialogRef<ScannerDialogV3Component>) {
	}


	closeDialog(): void {
		this.dialogRef.close();
	}

	onEvent($event: ScannerQRCodeResult[], action: NgxScannerQrcodeComponent) {
		console.log($event);
		action.stop();
		this.dialogRef.close($event[0].value);
	}

	public handle(action: any, fn: string): void {
		const playDeviceFacingBack = (devices: any[]) => {
			// front camera or back camera check here!
			const device = devices.find(f => (/back|rear|environment/gi.test(f.label))); // Default Back Facing Camera
			action.playDevice(device ? device.deviceId : devices[0].deviceId);
		}

		if (fn === 'start') {
			action[fn](playDeviceFacingBack);
		} else {
			action[fn]();
		}
	}

	ngAfterViewInit(): void {
		this.action.isReady.subscribe((res: any) => {
			this.handle(this.action, 'start');
		});
	}

}
