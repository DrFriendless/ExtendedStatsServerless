import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartPaneComponent } from './chart-pane.component';

describe('ChartPaneComponent', () => {
  let component: ChartPaneComponent;
  let fixture: ComponentFixture<ChartPaneComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ChartPaneComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
