import { ComponentFixture, TestBed } from '@angular/core/testing';

import {PedagoBtnComponent } from './pedago-btn.component';

describe('PedagoBtnComponent', () => {
  let component: PedagoBtnComponent;
  let fixture: ComponentFixture<PedagoBtnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PedagoBtnComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PedagoBtnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
