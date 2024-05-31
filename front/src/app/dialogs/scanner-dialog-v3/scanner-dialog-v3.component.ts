import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {NgxScannerQrcodeComponent, ScannerQRCodeConfig, ScannerQRCodeResult} from "ngx-scanner-qrcode";
import {MatDialogRef} from "@angular/material/dialog";
import {LocalStorageService} from "../../services/local-storage/local-storage.service";


@Component({
	selector: 'app-scanner-dialog-v3',
	templateUrl: './scanner-dialog-v3.component.html',
	styleUrls: ['./scanner-dialog-v3.component.scss']
})
export class ScannerDialogV3Component implements AfterViewInit, OnDestroy {
	@ViewChild('action') scanner!: NgxScannerQrcodeComponent;

	config: ScannerQRCodeConfig = {
		fps: 4,
		vibrate: 300, /** support mobile */
	};
	cameras: any[] = [];
	cameraSelected: any | undefined;
	itemCamera = "preferedCameraId";

	constructor(public dialogRef: MatDialogRef<ScannerDialogV3Component>, private localStorageService: LocalStorageService,) {
		this.cameraSelected = this.localStorageService.getItem(this.itemCamera);
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
			if (this.cameraSelected) {
				scanner.playDevice(this.cameraSelected);
			} else {
				this.cameras = devices;
				const device = devices.find(c => (/environment|back|rear/gi.test(c.label)));
				this.cameraSelected = device ? device.deviceId : devices[0].deviceId
				scanner.playDevice(this.cameraSelected);
			}
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

	cameraChanged(cameraId: any) {
		this.scanner.playDevice(cameraId);
		this.cameraSelected = cameraId;
		this.localStorageService.setItem(this.itemCamera, cameraId);
	}
}
