import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryGamesComponent } from './history-games.component';

describe('HistoryGamesComponent', () => {
  let component: HistoryGamesComponent;
  let fixture: ComponentFixture<HistoryGamesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HistoryGamesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryGamesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
