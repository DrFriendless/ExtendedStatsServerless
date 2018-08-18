import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysPanelComponent } from './plays-panel.component';

describe('PlaysPanelComponent', () => {
  let component: PlaysPanelComponent;
  let fixture: ComponentFixture<PlaysPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
