import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiplaysPanelComponent } from './multiplays-panel.component';

describe('MultiplaysPanelComponent', () => {
  let component: MultiplaysPanelComponent;
  let fixture: ComponentFixture<MultiplaysPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MultiplaysPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiplaysPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
