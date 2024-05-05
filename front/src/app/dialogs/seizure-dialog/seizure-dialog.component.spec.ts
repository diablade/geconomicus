import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeizureDialogComponent } from './seizure-dialog.component';

describe('SeizureDialogComponent', () => {
  let component: SeizureDialogComponent;
  let fixture: ComponentFixture<SeizureDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SeizureDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeizureDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
