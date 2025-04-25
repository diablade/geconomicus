import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PedagoDialogComponent } from './pedago-dialog.component';

describe('PedagoDialogComponent', () => {
  let component: PedagoDialogComponent;
  let fixture: ComponentFixture<PedagoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PedagoDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PedagoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
