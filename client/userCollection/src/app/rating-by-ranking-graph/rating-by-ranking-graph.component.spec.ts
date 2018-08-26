import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingByRankingGraphComponent } from './rating-by-ranking-graph.component';

describe('RatingByRankingGraphComponent', () => {
  let component: RatingByRankingGraphComponent;
  let fixture: ComponentFixture<RatingByRankingGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RatingByRankingGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RatingByRankingGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
