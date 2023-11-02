import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScannerDialogV2Component } from './scanner-dialog-v2.component';

describe('ScannerDialogV2Component', () => {
  let component: ScannerDialogV2Component;
  let fixture: ComponentFixture<ScannerDialogV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScannerDialogV2Component ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScannerDialogV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
