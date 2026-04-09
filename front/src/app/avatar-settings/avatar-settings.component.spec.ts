import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarSettingsComponent } from './avatar-settings.component';

describe('PlayerSettingsComponent', () => {
  let component: AvatarSettingsComponent;
  let fixture: ComponentFixture<AvatarSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AvatarSettingsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvatarSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
