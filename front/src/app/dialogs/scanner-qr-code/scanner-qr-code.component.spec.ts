import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScannerQrCode } from './scanner-qr-code.component';

describe('ScannerDialogV3Component', () => {
  let component: ScannerQrCode;
  let fixture: ComponentFixture<ScannerQrCode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScannerQrCode ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScannerQrCode);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
