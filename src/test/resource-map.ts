import {
  TestBed,
  inject
} from '@angular/core/testing';
import { ApplicationRef, ViewContainerRef } from '@angular/core';
import {
  Http, HttpModule,
  JsonpModule, XHRBackend, JSONPBackend,
  Response, ResponseOptions,
  Jsonp, ConnectionBackend,
} from '@angular/http';
import { MockBackend, MockConnection } from '@angular/http/testing';

import { Resource } from '../resource.service';
import { APIS, User } from './mock';

export class TestMap {

  constructor() {
    describe('mapping', () => {

      beforeEach(() => {
        return TestBed.configureTestingModule({
          imports: [HttpModule, JsonpModule],
          declarations: [],
          providers: [
            MockBackend,
            Resource,
            ViewContainerRef,
            { provide: XHRBackend, useClass: MockBackend },
            { provide: JSONPBackend, useExisting: MockBackend },
          ]
        })
      });

      it('should map model just one time', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          let url = 'https://somewhere.com';
          expect(Resource.map(APIS.FIRST.toString(), url)).toBeTruthy();
          expect(Resource.map(APIS.FIRST.toString(), url)).toBeFalsy();
        }));
      it('should map correct url with just "/api" ', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          expect(Resource.map(APIS.FIRST.toString(), '/api')).toBeTruthy();
        }));
      it('should map correct url "/" ', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          expect(Resource.map(APIS.FIRST.toString(), 'http://localhost:8080/')).toBeTruthy();
        }));

      it('should map correct url without "/" ', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          expect(Resource.map(APIS.FIRST.toString(), 'http://localhost:8080')).toBeTruthy();
        }));


      it('should reject incorrect url from random chars', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          expect(Resource.map(APIS.FIRST.toString(), 'asdas')).toBeFalsy();
        }));


      it('should reject incorrect url withour addres body', inject([Resource, Http, Jsonp],
        (rest: Resource<APIS, User, User[]>, http: Http, jp) => {
          rest = new Resource<APIS, User, User[]>(http, jp);
          Resource.reset();
          expect(Resource.map(APIS.FIRST.toString(), 'http://')).toBeFalsy();
        }));

    });
  }
}



