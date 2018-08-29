import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingsOfOwnedGamesComponent } from './ratings-of-owned-games.component';

describe('RatingsOfOwnedGamesComponent', () => {
  let component: RatingsOfOwnedGamesComponent;
  let fixture: ComponentFixture<RatingsOfOwnedGamesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RatingsOfOwnedGamesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RatingsOfOwnedGamesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
