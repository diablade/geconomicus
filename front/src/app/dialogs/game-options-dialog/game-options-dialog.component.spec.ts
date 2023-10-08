import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameOptionsDialogComponent } from './game-options-dialog.component';

describe('GameOptionsDialogComponent', () => {
  let component: GameOptionsDialogComponent;
  let fixture: ComponentFixture<GameOptionsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GameOptionsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameOptionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
