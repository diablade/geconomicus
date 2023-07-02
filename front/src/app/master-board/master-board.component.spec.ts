import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterBoardComponent } from './master-board.component';

describe('MasterBoardComponent', () => {
  let component: MasterBoardComponent;
  let fixture: ComponentFixture<MasterBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MasterBoardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MasterBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
