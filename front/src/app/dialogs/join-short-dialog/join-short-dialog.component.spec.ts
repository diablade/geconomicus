import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinShortDialogComponent } from './join-short-dialog.component';

describe('JoinShortDialogComponent', () => {
  let component: JoinShortDialogComponent;
  let fixture: ComponentFixture<JoinShortDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JoinShortDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JoinShortDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
