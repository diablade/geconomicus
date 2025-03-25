import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleGalileComponent } from './module-galile.component';

describe('ModuleGalileComponent', () => {
  let component: ModuleGalileComponent;
  let fixture: ComponentFixture<ModuleGalileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModuleGalileComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuleGalileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
