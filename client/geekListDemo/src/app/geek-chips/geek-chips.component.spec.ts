import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GeekChipsComponent } from './geek-chips.component';

describe('GeekChipsComponent', () => {
  let component: GeekChipsComponent;
  let fixture: ComponentFixture<GeekChipsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GeekChipsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GeekChipsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
