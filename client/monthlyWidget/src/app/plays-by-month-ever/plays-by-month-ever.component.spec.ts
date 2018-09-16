import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByMonthEverComponent } from './plays-by-month-ever.component';

describe('PlaysByMonthEverComponent', () => {
  let component: PlaysByMonthEverComponent;
  let fixture: ComponentFixture<PlaysByMonthEverComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByMonthEverComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByMonthEverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
