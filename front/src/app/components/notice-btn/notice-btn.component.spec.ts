import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoticeBtnComponent } from './notice-btn.component';

describe('NoticeBtnComponent', () => {
  let component: NoticeBtnComponent;
  let fixture: ComponentFixture<NoticeBtnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NoticeBtnComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoticeBtnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
