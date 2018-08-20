import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { YearlyPanelComponent } from './yearly-panel.component';

describe('YearlyPanelComponent', () => {
  let component: YearlyPanelComponent;
  let fixture: ComponentFixture<YearlyPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ YearlyPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(YearlyPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
