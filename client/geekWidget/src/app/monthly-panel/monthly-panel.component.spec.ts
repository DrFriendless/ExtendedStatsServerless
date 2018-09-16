import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlyPanelComponent } from './monthly-panel.component';

describe('MonthlyPanelComponent', () => {
  let component: MonthlyPanelComponent;
  let fixture: ComponentFixture<MonthlyPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MonthlyPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MonthlyPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
