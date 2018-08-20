import { TestBed, async } from '@angular/core/testing';
import { GeekWidget } from './app.component';
describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        GeekWidget
      ],
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(GeekWidget);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
});
