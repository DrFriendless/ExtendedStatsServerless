import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GeekListEditorComponent } from './geek-list-editor.component';

describe('GeekListEditorComponent', () => {
  let component: GeekListEditorComponent;
  let fixture: ComponentFixture<GeekListEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GeekListEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GeekListEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
