import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByWeekGraphComponent } from './plays-by-week-graph.component';

describe('PlaysByWeekGraphComponent', () => {
  let component: PlaysByWeekGraphComponent;
  let fixture: ComponentFixture<PlaysByWeekGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByWeekGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByWeekGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
