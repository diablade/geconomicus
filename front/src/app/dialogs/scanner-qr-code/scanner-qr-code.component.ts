import { AfterViewInit, Component, Inject, OnDestroy, Optional, ViewChild } from '@angular/core';
import { NgxScannerQrcodeComponent, ScannerQRCodeConfig, ScannerQRCodeResult } from 'ngx-scanner-qrcode';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Platform } from '@angular/cdk/platform';
import { LocalStorageService } from '../../services/local-storage/local-storage.service';

export interface ScannerQrCodeData {
	allowShortCode?: boolean;
}

export interface ScannerQrCodeOutcome {
	value?: string;
	useShortCode?: boolean;
}

export type CameraFailure = 'denied' | 'notFound' | 'busy' | 'unavailable';

const FAILURE_MESSAGE_KEYS: Record<CameraFailure, string> = {
	denied: 'DIALOG.QR_SCAN.DENIED',
	notFound: 'DIALOG.QR_SCAN.NOT_FOUND',
	busy: 'DIALOG.QR_SCAN.BUSY',
	unavailable: 'DIALOG.QR_SCAN.UNAVAILABLE',
};

@Component({
	selector: 'app-scanner-dialog-v3',
	templateUrl: './scanner-qr-code.component.html',
	styleUrls: ['./scanner-qr-code.component.scss'],
})
export class ScannerQrCode implements AfterViewInit, OnDestroy {
	@ViewChild('action') scanner!: NgxScannerQrcodeComponent;

	config: ScannerQRCodeConfig = {
		fps: 4,
		vibrate: 300, /** support mobile */
	};
	cameraSelected: any | undefined;
	failure: CameraFailure | undefined;
	itemCamera = 'preferedCameraId';

	constructor(
		public dialogRef: MatDialogRef<ScannerQrCode, ScannerQrCodeOutcome>,
		private localStorageService: LocalStorageService,
		private platform: Platform,
		@Optional() @Inject(MAT_DIALOG_DATA) private data: ScannerQrCodeData | null
	) {
		this.cameraSelected = this.localStorageService.getItem(this.itemCamera);
	}

	get shortCodeOffered(): boolean {
		return this.data?.allowShortCode === true;
	}

	get failureMessageKey(): string {
		return this.failure ? FAILURE_MESSAGE_KEYS[this.failure] : '';
	}

	get allowPathKey(): string {
		if (this.platform.IOS) {
			return 'DIALOG.QR_SCAN.ALLOW_PATH_IOS';
		}
		if (this.platform.ANDROID) {
			return 'DIALOG.QR_SCAN.ALLOW_PATH_ANDROID';
		}
		return 'DIALOG.QR_SCAN.ALLOW_PATH_DESKTOP';
	}

	get retryLabelKey(): string {
		return this.platform.IOS ? 'DIALOG.QR_SCAN.RELOAD' : 'DIALOG.QR_SCAN.RETRY';
	}

	ngAfterViewInit(): void {
		this.scanner.isReady.subscribe(() => this.startScanner());
	}

	onEvent($event: ScannerQRCodeResult[]): void {
		if (!$event?.length) {
			return;
		}
		this.stopScanner();
		this.dialogRef.close({ value: $event[0].value });
	}

	cameraChanged(cameraId: any): void {
		this.cameraSelected = cameraId;
		this.localStorageService.setItem(this.itemCamera, cameraId);
		this.playSelectedDevice();
	}

	retry(): void {
		if (this.platform.IOS) {
			window.location.reload();
			return;
		}
		this.startScanner();
	}

	switchToShortCode(): void {
		this.stopScanner();
		this.dialogRef.close({ useShortCode: true });
	}

	closeDialog(): void {
		this.stopScanner();
		this.dialogRef.close();
	}

	async ngOnDestroy() {
		this.stopScanner();
		this.scanner?.ngOnDestroy();
	}

	private startScanner(): void {
		this.failure = undefined;
		this.scanner.start(this.playPreferredDevice).subscribe({
			error: (error: any) => (this.failure = classifyCameraFailure(error)),
		});
	}

	private playPreferredDevice = (devices: any[]): void => {
		const stillPlugged = devices.some((device) => device.deviceId === this.cameraSelected);
		if (!stillPlugged) {
			this.localStorageService.removeItem(this.itemCamera);
			const facingBack = devices.find((device) => /environment|back|rear/gi.test(device.label));
			this.cameraSelected = facingBack ? facingBack.deviceId : devices[0].deviceId;
		}
		this.playSelectedDevice();
	};

	private playSelectedDevice(): void {
		this.scanner.playDevice(this.cameraSelected).subscribe({
			error: (error: any) => (this.failure = classifyCameraFailure(error)),
		});
	}

	private stopScanner(): void {
		try {
			this.scanner?.stop();
		} catch (error) {
			console.warn('scanner stop failed', error);
		}
	}
}

function classifyCameraFailure(error: any): CameraFailure {
	switch (typeof error === 'string' ? error : error?.name) {
		case 'NotAllowedError':
		case 'PermissionDeniedError':
		case 'SecurityError':
			return 'denied';
		case 'NotFoundError':
		case 'DevicesNotFoundError':
		case 'OverconstrainedError':
		case 'ConstraintNotSatisfiedError':
		case 'No camera detected.':
			return 'notFound';
		case 'NotReadableError':
		case 'TrackStartError':
			return 'busy';
		default:
			return 'unavailable';
	}
}
