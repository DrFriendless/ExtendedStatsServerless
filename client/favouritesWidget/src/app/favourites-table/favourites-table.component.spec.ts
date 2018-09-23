import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FavouritesTableComponent } from './favourites-table.component';

describe('FavouritesTableComponent', () => {
  let component: FavouritesTableComponent;
  let fixture: ComponentFixture<FavouritesTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FavouritesTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FavouritesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
