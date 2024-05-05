import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContractDialogComponent } from './contract-dialog.component';

describe('ContractDialogComponent', () => {
  let component: ContractDialogComponent;
  let fixture: ComponentFixture<ContractDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ContractDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContractDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
