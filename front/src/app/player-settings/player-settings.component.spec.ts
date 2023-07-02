import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerSettingsComponent } from './player-settings.component';

describe('PlayerSettingsComponent', () => {
  let component: PlayerSettingsComponent;
  let fixture: ComponentFixture<PlayerSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayerSettingsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
