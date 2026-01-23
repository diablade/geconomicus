import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReJoinQrDialogComponent } from './re-join-qr-dialog.component';

describe('JoinQrDialogComponent', () => {
  let component: ReJoinQrDialogComponent;
  let fixture: ComponentFixture<ReJoinQrDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ReJoinQrDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReJoinQrDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
