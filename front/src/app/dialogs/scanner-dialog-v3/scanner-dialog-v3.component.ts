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
	stream: any;
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

	public async checkCameraPermission() {
		try {
			// Check if camera access is already granted
			this.stream = await navigator.mediaDevices.getUserMedia({video: true});
			console.log("Camera access granted");

			// Stop the stream to release the camera
			this.stream.getTracks().forEach((track: { stop: () => any; }) => track.stop());
		} catch (error: any) {
			if (error.name === "NotAllowedError") {
				console.warn("Camera access denied by the user");
			} else if (error.name === "NotFoundError") {
				console.error("No camera devices found");
			} else {
				console.error("Error accessing camera:", error);
			}
		}
	}


	public handle(scanner: any, fn: string): void {
		this.checkCameraPermission();

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

	async ngOnDestroy(){
		this.stream.getTracks().forEach((track: { stop: () => any; }) => track.stop());
		this.scanner.stop();
		this.scanner.ngOnDestroy();
	}

	cameraChanged(cameraId: any) {
		this.scanner.playDevice(cameraId);
		this.cameraSelected = cameraId;
		this.localStorageService.setItem(this.itemCamera, cameraId);
	}
}
