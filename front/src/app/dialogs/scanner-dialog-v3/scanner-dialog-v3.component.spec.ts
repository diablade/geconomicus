import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScannerDialogV3Component } from './scanner-dialog-v3.component';

describe('ScannerDialogV3Component', () => {
  let component: ScannerDialogV3Component;
  let fixture: ComponentFixture<ScannerDialogV3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScannerDialogV3Component ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScannerDialogV3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
