import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinQrDialogComponent } from './join-qr-dialog.component';

describe('JoinQrDialogComponent', () => {
  let component: JoinQrDialogComponent;
  let fixture: ComponentFixture<JoinQrDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JoinQrDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JoinQrDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
