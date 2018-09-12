import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BggRatingsOfOwnedGamesComponent } from './bgg-ratings-of-owned-games.component';

describe('BggRatingsOfOwnedGamesComponent', () => {
  let component: BggRatingsOfOwnedGamesComponent;
  let fixture: ComponentFixture<BggRatingsOfOwnedGamesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BggRatingsOfOwnedGamesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BggRatingsOfOwnedGamesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
