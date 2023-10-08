import {AfterViewInit, Component} from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog";
import {Html5QrcodeScanner, Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats} from 'html5-qrcode';


@Component({
  selector: 'app-scanner-dialog',
  templateUrl: './scanner-dialog.component.html',
  styleUrls: ['./scanner-dialog.component.scss']
})
export class ScannerDialogComponent implements AfterViewInit {
  qrScanner: Html5QrcodeScanner | undefined;
  scannedCode = '';

  constructor(public dialogRef: MatDialogRef<ScannerDialogComponent>) {
  }
  ngAfterViewInit(): void {
    this.qrScanner = new Html5QrcodeScanner('qrreader', {
      fps: 10,
      qrbox: 250,
      videoConstraints: {
        facingMode: { ideal: "environment" }
      },
      rememberLastUsedCamera: true,
      // Only support camera scan type.
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    }, false);
    this.qrScanner.render((qrCodeMessage: string)=> {
      console.log('QR code scanned:', qrCodeMessage);
      this.scannedCode=qrCodeMessage;
      this.qrScanner?.clear();
      this.dialogRef.close(this.scannedCode);
      // Handle the scanned QR code data here
    }, this.onScanFailure);
  }

  onScanFailure(error: any) {
    // console.error('Failed to scan QR code:', error);
    // Handle the scan failure here
  }
}
