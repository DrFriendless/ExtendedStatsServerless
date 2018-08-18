import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FavouritesPanelComponent } from './favourites-panel.component';

describe('FavouritesPanelComponent', () => {
  let component: FavouritesPanelComponent;
  let fixture: ComponentFixture<FavouritesPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FavouritesPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FavouritesPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
