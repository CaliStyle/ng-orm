import {Http, Response, Headers, Jsonp} from '@angular/http';
import {FormControl, FormGroup} from '@angular/forms';

import {Subject} from 'rxjs/Subject';
import 'rxjs/add/operator/map';
import {Observable} from 'rxjs/Observable';

import {MockingMode} from './mocking-mode';
import {Rest as RestModule} from './rest';
import {UrlNestedParams} from './nested-params';
import {Eureka} from './eureka';
import {Docs} from './docs';
import {Contracts} from './contracts';
import {MockBackend, MockResponse} from './mock-backend';
import {Http as HttpModule} from './http';

export class Rest<T, TA> implements RestModule.FnMethodsHttp<T, TA> {

  public static docServerUrl: string;
  public static docsTitle: string;
  public static headers: Headers = new Headers();
  public static headersResponse: Headers = new Headers();
  private form: Contracts.FormInputBind[];
  public static mockingMode: MockingMode;
  public __usecase_desc;
  public static eureka: Eureka.Eureka<any, any>;
  public static waitingForDocsServer: boolean = false;
  public static restartServerRequest: boolean = false;

  private _endpoint: string;
  private _endpointRest: string;

  private get endpoint() {
    let e = (Rest.eureka && Rest.eureka.instance) ? Rest.eureka.instance.instanceId : this._endpoint;
    if (this.restQueryParams !== undefined && this._endpointRest !== undefined
      && typeof this._endpointRest === 'string' && this._endpointRest.trim() !== '') e = this._endpointRest;
    return e;
  }

  private restQueryParams: Object;

  public set __rest_endpoint(endpoint) {
    this._endpointRest = endpoint;
    if (endpoint === undefined) {
      this.restQueryParams = undefined;
    } else {
      // console.log('this._endpoint', this._endpoint)
      // console.log('endpoint', endpoint)
      this.restQueryParams = UrlNestedParams.getRestParams(endpoint, this._endpoint);
      // console.log('this.restQueryParams ', this.restQueryParams)
    }

  }

  private static _headersAreSet: boolean = false;
  private static _headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  constructor(
    endpoint: string,
    private http: Http,
    private jp: Jsonp,
    private description: string,
    private name: string,
    private group: string
  ) {
    this._endpoint = endpoint;

    // Quick fix
    if (Rest.mockingMode === undefined) Rest.mockingMode = MockingMode.LIVE_BACKEND_ONLY;

    if (!Rest._headersAreSet) {
      Rest._headersAreSet = true;
      for (let h in Rest._headers) {
        Rest.headers.append(h, Rest._headers[h]);
      }
    }

    if (Rest.restartServerRequest && Rest.docServerUrl && Rest.docServerUrl.trim() !== '') {
      Rest.restartServerRequest = false;

      let tmpUrl = Rest.docServerUrl.charAt(Rest.docServerUrl.length - 1) === '/' ?
        Rest.docServerUrl.slice(0, Rest.docServerUrl.length - 1) : Rest.docServerUrl;
      tmpUrl = Rest.docsTitle ? `${tmpUrl}/api/start/${encodeURIComponent(Rest.docsTitle)}` : `${tmpUrl}/api/start`;

      Rest.waitingForDocsServer = true;
      http.get(tmpUrl).subscribe(() => {
        Rest.waitingForDocsServer = false;
        console.info('Docs server restarted');
      }, (err) => {
        Rest.waitingForDocsServer = false;
        console.error(`Problem with restart server on ${tmpUrl}`);
      });
    }

  }

  private getHeadersJSON() {
    return Rest.headers.toJSON();
  }

  private log(model: Docs.DocModel) {
    if (Rest.docServerUrl) {

      model.description = this.description;
      model.name = this.name;
      model.group = this.group;
      model.usecase = this.__usecase_desc;
      model.url = this.endpoint;
      model.form = this.form;
      model.headers = this.getHeadersJSON();
      model.restQueryParams = JSON.stringify(this.restQueryParams);

      let url = Rest.docServerUrl.charAt(Rest.docServerUrl.length - 1) === '/' ?
        Rest.docServerUrl.slice(0, Rest.docServerUrl.length - 1) : Rest.docServerUrl;
      url = `${url}/api/save`;

      this.http.post(url, JSON.stringify(model), {headers: Rest.headers}).subscribe(() => {
        console.log('request saved in docs server');
      });
    }
  }

  public static waitTimeMs: number = 1000;

  /**
   * App is waiting unit get response from server
   *
   * @returns
   *
   * @memberOf Rest
   */
  private appIsWaiting() {
    return ((Rest.eureka && Rest.eureka.isWaiting()) || Rest.waitingForDocsServer);
  }

  private prepareUrlOldWay = RestModule.prepareUrlOldWay;
  private getParams = RestModule.getParamsUrl;

  private creatUrl(params: any, doNotSerializeParams: boolean = false) {
    // console.log('params to url ', params);
    // console.log('params to url string ', JSON.stringify(params));
    return `${this.endpoint}${RestModule.getParamsUrl(params, doNotSerializeParams)}`;
    // if (params instanceof Array && params.length > 0) {
    //     return `${this.endpoint}${getParamsUrl(params)}`
    // }
    // return this.prepareUrlOldWay(params);
  }

  public contract(form: FormGroup, arrays?: Contracts.FormGroupArrays) {
    if (arrays) this.form = Contracts.prepareForm(form).concat(Contracts.prepareFormArrays(arrays));
    else this.form = Contracts.prepareForm(form);
    return this;
  }

  query(params: RestModule.UrlParams[] = undefined, _sub: Subject<TA> = undefined): Observable<TA> {
    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of query for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<TA> = _sub ? _sub : new Subject<TA>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.query(params, sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.creatUrl(params);
    return this.http.get(u, {headers: Rest.headers}).map(res => {
      Rest.headersResponse = res.headers;
      let r = undefined;
      try {
        r = res.json()
      } catch (error) {
        console.warn(error);
      }
      this.log(<Docs.DocModel>{
        urlParams: JSON.stringify(params),
        bodyReceive: JSON.stringify(r),
        method: 'GET',
        urlFull: u
      });
      return r;
    });
  }

  get(params?: RestModule.UrlParams[], doNotSerializeParams: boolean = false, _sub: Subject<T> = undefined): Observable<T> {

    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of get for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<T> = _sub ? _sub : new Subject<T>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.get(params, doNotSerializeParams, sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.creatUrl(params, doNotSerializeParams);
    return this.http.get(u, {headers: Rest.headers}).map(res => {
      Rest.headersResponse = res.headers;
      let r = undefined;
      try {
        r = res.json()
      } catch (error) {
        console.warn(error);
      }
      this.log(<Docs.DocModel>{
        urlParams: JSON.stringify(params),
        bodyReceive: JSON.stringify(r),
        method: 'GET',
        urlFull: u
      });
      return r;
    });
  }

  save(item: T, params?: RestModule.UrlParams[], _sub: Subject<T> = undefined): Observable<T> {
    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of save for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<T> = _sub ? _sub : new Subject<T>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.save(item, params, sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.creatUrl(params);
    let d = JSON.stringify(item);
    return this.http.post(u, d,
      {headers: Rest.headers}).map(res => {
      Rest.headersResponse = res.headers;
      let r = undefined;
      try {
        r = res.json()
      } catch (error) {
        console.warn(error);
      }
      this.log(<Docs.DocModel>{
        bodySend: d,
        bodyReceive: JSON.stringify(r),
        method: 'POST',
        urlFull: u
      });
      return r;
    });
  }


  update(item: T, params?: RestModule.UrlParams[], _sub: Subject<T> = undefined): Observable<T> {
    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of update for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<T> = _sub ? _sub : new Subject<T>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.update(item, params, sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.creatUrl(params);
    let d = JSON.stringify(item);
    return this.http.put(u, JSON.stringify(item),
      {headers: Rest.headers}).map(res => {
      Rest.headersResponse = res.headers;
      let r = undefined;
      try {
        r = res.json()
      } catch (error) {
        console.warn(error);
      }
      this.log(<Docs.DocModel>{
        urlParams: JSON.stringify(params),
        bodySend: d,
        bodyReceive: JSON.stringify(r),
        method: 'PUT',
        urlFull: u
      });
      return r;
    });
  }


  remove(params?: RestModule.UrlParams[], _sub: Subject<T> = undefined): Observable<T> {
    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of remove for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<T> = _sub ? _sub : new Subject<T>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.remove(params, sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.creatUrl(params);
    return this.http.delete(u,
      {headers: Rest.headers}).map(res => {
      Rest.headersResponse = res.headers;
      if (res.text() !== '') {
        let r = undefined;
        try {
          r = res.json()
        } catch (error) {
          console.warn(error);
        }
        this.log(<Docs.DocModel>{
          urlParams: JSON.stringify(params),
          bodyReceive: JSON.stringify(r),
          method: 'DELETE',
          urlFull: u
        });
        return r;
      }
      return {};
    });
  }


  jsonp(params?: RestModule.UrlParams[], _sub: Subject<T> = undefined): Observable<T> {
    if (Rest.mockingMode === MockingMode.MOCKS_ONLY) {
      throw (`In MOCKING MODE you have to define mock of jsonp for endpoint: ${this.endpoint}.`);
    }
    if (this.appIsWaiting()) {
      let sub: Subject<T> = _sub ? _sub : new Subject<T>();
      let obs = sub.asObservable();
      setTimeout(() => {
        this.jsonp(params, _sub).subscribe(e => sub.next(e));
      }, Rest.waitTimeMs)
      return sub;
    }
    let u = this.endpoint;
    return this.jp.request(u).map(res => {
      Rest.headersResponse = res.headers;
      let r = undefined;
      try {
        r = res.json()
      } catch (error) {
        console.warn(error);
      }
      this.log(<Docs.DocModel>{
        bodyReceive: JSON.stringify(r),
        method: 'JSONP',
        urlFull: u
      });
      return r;
    });
  }

  private backend: MockBackend.MockAutoBackend<T>;


  mock(data: any, timeout: number = 0, controller?: MockBackend.MockController<T>,
       nunOfMocks: number = 0): RestModule.FnMethodsHttp<T, TA> {

    if (Rest.mockingMode === MockingMode.LIVE_BACKEND_ONLY) {
      // console.log('FROM MOCK TO LIVE')
      return this;
    }
    let subject: Subject<any>;
    let currentMethod: HttpModule.HttpMethod;
    let currentBodySend: string;
    let currentUrlParams: string;
    let currentFullUrl: string;

    setTimeout(() => {

      if (controller !== undefined) {
        let tdata;
        if (typeof data === 'object') {
          tdata = JSON.parse(JSON.stringify(data));
        }
        else if (typeof data === 'string') {
          tdata = JSON.parse(data);
        }
        else {
          throw new Error(`Data for mock isn't string or object, endpoint:${this.endpoint}`);
        }
        if (this.backend === undefined && nunOfMocks > 0)
          this.backend = new MockBackend.MockAutoBackend<T>(data, nunOfMocks);

        let bodyPOSTandPUT = (currentBodySend && typeof currentBodySend === 'string') ? JSON.parse(currentBodySend) : undefined;
        // console.log('currentFullUrl', currentFullUrl);
        let decodedParams = RestModule.decodeUrl(currentFullUrl);
        // console.log('decodedParams', decodedParams);

        let d = nunOfMocks === 0 ? controller({
            data: tdata,
            params: decodedParams,
            body: bodyPOSTandPUT,
            restParams: this.restQueryParams,
            method: currentMethod
          }) :
          controller({
            data: tdata,
            params: decodedParams,
            body: bodyPOSTandPUT,
            backend: this.backend,
            restParams: this.restQueryParams,
            method: currentMethod
          });
        if (d === undefined) {
          throw new Error(`Mock controlelr can't return undefined (endpoint:${this.endpoint})`);
        }
        if (d.error !== undefined) {
          console.error(`Mock server respond with code ${d.code} - ${d.error}`);
          // TODO each code real message
        }

        // console.log('currentUrlPrams', currentUrlParams);

        if (d.code === undefined) d.code = 200;
        if (d.data === undefined) {
          this.log(<Docs.DocModel>{
            urlParams: currentUrlParams,
            bodySend: currentBodySend,
            method: currentMethod,
            urlFull: currentFullUrl,
            status: d.code,
          });
          subject.error(d);
        }
        else {
          this.log(<Docs.DocModel>{
            urlParams: currentUrlParams,
            bodyReceive: JSON.stringify(d.data),
            bodySend: currentBodySend,
            method: currentMethod,
            urlFull: currentFullUrl,
            status: d.code
          });
          if (this.appIsWaiting()) setTimeout(() => subject.next(d.data), Rest.waitTimeMs);
          else subject.next(d.data);
        }
      }
      else {
        if (typeof data === 'object' || typeof data === 'string') {
          let res: MockResponse = {
            data: (typeof data === 'string') ? JSON.parse(data) : JSON.parse(JSON.stringify(data)),
            code: 200
          };
          this.log(<Docs.DocModel>{
            urlParams: currentUrlParams,
            bodyReceive: JSON.stringify(res.data),
            bodySend: currentBodySend,
            method: currentMethod,
            urlFull: currentFullUrl,
            status: res.code
          });
          if (this.appIsWaiting()) setTimeout(() => subject.next(res.data), Rest.waitTimeMs);
          else subject.next(res.data);
        }
        else {
          throw new Error(`Data for mock isn't string or object, endpoint:${this.endpoint}`);
        }
      }
    }, timeout);

    let t: RestModule.FnMethodsHttp<T, TA> = <RestModule.FnMethodsHttp<T, TA>>{};

    t.query = (params?: RestModule.UrlParams[]): Observable<TA> => {
      currentMethod = 'GET';
      subject = new Subject<TA>();
      RestModule.prepare(params);
      currentUrlParams = JSON.stringify(params);
      currentFullUrl = this.creatUrl(params);

      return subject.asObservable();
    };

    t.get = (params?: RestModule.UrlParams[], doNotSerializeParams: boolean = false, _sub: any = undefined): Observable<T> => {
      currentMethod = 'GET';
      subject = new Subject<T>();
      RestModule.prepare(params);
      currentUrlParams = JSON.stringify(params);
      currentFullUrl = this.creatUrl(params, doNotSerializeParams);

      return subject.asObservable();
    };

    t.save = (item: T, params?: RestModule.UrlParams[]): Observable<T> => {
      currentMethod = 'POST';
      subject = new Subject<T>();
      RestModule.prepare(params);
      currentUrlParams = params ? JSON.stringify(params) : '{}';
      currentFullUrl = this.creatUrl(params);

      currentBodySend = JSON.stringify(item);

      return subject.asObservable();
    };

    t.update = (item: T, params?: RestModule.UrlParams[]): Observable<T> => {
      currentMethod = 'PUT';
      subject = new Subject<T>();
      RestModule.prepare(params);
      currentUrlParams = JSON.stringify(params);
      currentFullUrl = this.creatUrl(params);

      currentBodySend = JSON.stringify(item);

      return subject.asObservable();
    };

    t.remove = (params?: RestModule.UrlParams[]): Observable<T> => {
      currentMethod = 'DELETE';
      subject = new Subject<T>();
      RestModule.prepare(params);
      currentUrlParams = JSON.stringify(params);
      currentFullUrl = this.creatUrl(params);

      return subject.asObservable();
    };

    t.jsonp = (params?: RestModule.UrlParams[]): Observable<T> => {
      currentMethod = 'JSONP';
      subject = new Subject<any>();
      RestModule.prepare(params);
      currentFullUrl = this.endpoint;

      return subject.asObservable();
    };

    return t;
  }

}

