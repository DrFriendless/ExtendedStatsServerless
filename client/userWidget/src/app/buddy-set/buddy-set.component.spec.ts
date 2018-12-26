import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BuddySetComponent } from './buddy-set.component';

describe('BuddySetComponent', () => {
  let component: BuddySetComponent;
  let fixture: ComponentFixture<BuddySetComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BuddySetComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BuddySetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
