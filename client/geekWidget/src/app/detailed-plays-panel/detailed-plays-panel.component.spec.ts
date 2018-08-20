import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailedPlaysPanelComponent } from './detailed-plays-panel.component';

describe('DetailedPlaysPanelComponent', () => {
  let component: DetailedPlaysPanelComponent;
  let fixture: ComponentFixture<DetailedPlaysPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DetailedPlaysPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailedPlaysPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
