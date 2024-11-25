import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageBtnComponent } from './language-btn.component';

describe('LanguageBtnComponent', () => {
  let component: LanguageBtnComponent;
  let fixture: ComponentFixture<LanguageBtnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LanguageBtnComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LanguageBtnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
