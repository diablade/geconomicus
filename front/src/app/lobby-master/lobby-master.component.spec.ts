import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyMasterComponent } from './lobby-master.component';

describe('LobbyMasterComponent', () => {
  let component: LobbyMasterComponent;
  let fixture: ComponentFixture<LobbyMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LobbyMasterComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LobbyMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
