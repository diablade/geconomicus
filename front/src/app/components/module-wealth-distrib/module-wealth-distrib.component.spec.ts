import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleWealthDistribComponent } from './module-wealth-distrib.component';

describe('ModuleWealthDistribComponent', () => {
  let component: ModuleWealthDistribComponent;
  let fixture: ComponentFixture<ModuleWealthDistribComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModuleWealthDistribComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuleWealthDistribComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
