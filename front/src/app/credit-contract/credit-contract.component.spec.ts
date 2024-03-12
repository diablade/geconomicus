import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditContractComponent } from './credit-contract.component';

describe('CreditContractComponent', () => {
  let component: CreditContractComponent;
  let fixture: ComponentFixture<CreditContractComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreditContractComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditContractComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
