import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BtnTimerAutoClickComponent } from './btn-timer-auto-click.component';

describe('BtnTimerAutoClickComponent', () => {
  let component: BtnTimerAutoClickComponent;
  let fixture: ComponentFixture<BtnTimerAutoClickComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BtnTimerAutoClickComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BtnTimerAutoClickComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
