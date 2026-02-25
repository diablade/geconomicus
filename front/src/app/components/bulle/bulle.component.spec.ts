import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulleComponent } from './bulle.component';

describe('BulleComponent', () => {
  let component: BulleComponent;
  let fixture: ComponentFixture<BulleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BulleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
