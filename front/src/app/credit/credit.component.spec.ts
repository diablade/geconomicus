import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditComponent } from './credit.component';

describe('CreditContractComponent', () => {
  let component: CreditComponent;
  let fixture: ComponentFixture<CreditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreditComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
