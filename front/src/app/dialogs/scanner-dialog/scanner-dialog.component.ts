import {AfterViewInit, Component, OnInit} from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog";
import {Html5QrcodeScanner, Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats} from 'html5-qrcode';
import {Html5QrcodeScannerConfig} from "html5-qrcode/html5-qrcode-scanner";


@Component({
  selector: 'app-scanner-dialog',
  templateUrl: './scanner-dialog.component.html',
  styleUrls: ['./scanner-dialog.component.scss']
})
export class ScannerDialogComponent implements OnInit, AfterViewInit {
  scannedCode = '';
  config: Html5QrcodeScannerConfig =
    {
      fps: 10,
      qrbox: 250,
      videoConstraints: {
        facingMode: {ideal: "environment"}
      },
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    };
  qrScanner: Html5QrcodeScanner | undefined;

  constructor(public dialogRef: MatDialogRef<ScannerDialogComponent>) {
  }
  ngOnInit(): void {
    this.qrScanner = new Html5QrcodeScanner('qrreader', this.config, false);
  }

  ngAfterViewInit(): void {
    // @ts-ignore
    this.qrScanner.render((qrCodeMessage: string) => {
      console.log('QR code scanned:', qrCodeMessage);
      this.scannedCode = qrCodeMessage;
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
