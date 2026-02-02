import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionEditDialogComponent } from './session-edit-dialog.component';

describe('GameOptionsDialogComponent', () => {
  let component: SessionEditDialogComponent;
  let fixture: ComponentFixture<SessionEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionEditDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
