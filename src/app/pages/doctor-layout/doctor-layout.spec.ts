import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { DoctorLayout } from './doctor-layout';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector: 'app-header', standalone: true, template: '' })
class HeaderStub {}
@Component({ selector: 'app-sidebar', standalone: true, template: '' })
class SidebarStub {}

describe('DoctorLayout role navigation (P45)', () => {
  function setup(role: string) {
    const session = new Subject<null>();
    const auth = { currentDoctor: { role }, session$: session.asObservable() };
    TestBed.configureTestingModule({ imports: [DoctorLayout], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).overrideComponent(DoctorLayout, { set: { imports: [RouterOutlet, HeaderStub, SidebarStub] } });
    const fixture = TestBed.createComponent(DoctorLayout);
    fixture.detectChanges();
    return { fixture, auth, session };
  }

  it.each(['admin', 'doctor'])('shows navigation and reserves the mobile bar for %s', role => {
    const { fixture } = setup(role);
    expect(fixture.nativeElement.querySelector('app-sidebar')).not.toBeNull();
    expect(document.body.style.getPropertyValue('--app-nav-h')).toBe('64px');
    fixture.destroy();
    expect(document.body.style.getPropertyValue('--app-nav-h')).toBe('');
  });

  it('updates signals and reserved space when the session role changes to Assistant', () => {
    const { fixture, auth, session } = setup('admin');
    auth.currentDoctor = { role: 'assistant' };
    session.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sidebar')).toBeNull();
    expect(document.body.style.getPropertyValue('--app-nav-h')).toBe('0px');
  });
});
