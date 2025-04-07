import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleGalileoComponent } from './module-galileo.component';

describe('ModuleGalileComponent', () => {
  let component: ModuleGalileoComponent;
  let fixture: ComponentFixture<ModuleGalileoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModuleGalileoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuleGalileoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
