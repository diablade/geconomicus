import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BankBoardComponent } from './bank-board.component';

describe('BankBoardComponent', () => {
  let component: BankBoardComponent;
  let fixture: ComponentFixture<BankBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BankBoardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BankBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
