import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScannerDialogComponent } from './scanner-dialog.component';

describe('ScannerDialogComponent', () => {
  let component: ScannerDialogComponent;
  let fixture: ComponentFixture<ScannerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScannerDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScannerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
