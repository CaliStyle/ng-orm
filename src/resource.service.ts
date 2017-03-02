import { Injectable, Inject, Injector, ReflectiveInjector } from '@angular/core';
import {
  Http, Response, Headers, Jsonp, HttpModule, JsonpModule, XHRConnection,
  BrowserXhr, ResponseOptions, XHRBackend, BaseResponseOptions, BaseRequestOptions,
  ConnectionBackend, RequestOptions, XSRFStrategy, CookieXSRFStrategy
} from '@angular/http';

import { Observable, Subject } from 'rxjs';
import { Log, Level } from 'ng2-logger/ng2-logger';
const log = Log.create('resource-service', Level.__NOTHING)

import { Eureka } from './eureka';
import { MockingMode } from './mocking-mode';
import { UrlNestedParams } from './nested-params';
import { Rest } from './rest.class';

// export const HTTP_PROVIDERS = [
//   {
//     provide: Http, useFactory:
//     (xhrBackend: XHRBackend, requestOptions: RequestOptions): Http =>
//       new Http(xhrBackend, requestOptions),
//     deps: [XHRBackend, RequestOptions]
//   },
//   BrowserXhr,
//   { provide: RequestOptions, useClass: BaseRequestOptions },
//   { provide: ResponseOptions, useClass: BaseResponseOptions },
//   XHRBackend,
//   { provide: XSRFStrategy, useFactory: () => new CookieXSRFStrategy() }
// ];
//
// export const JSONP_PROVIDERS = [
//   {
//     provide: Jsonp, useFactory:
//     (xhrBackend: XHRBackend, requestOptions: RequestOptions): Jsonp =>
//       new Jsonp(xhrBackend, requestOptions),
//     deps: [XHRBackend, RequestOptions]
//   },
//   BrowserXhr,
//   { provide: RequestOptions, useClass: BaseRequestOptions },
//   { provide: ResponseOptions, useClass: BaseResponseOptions },
//   XHRBackend,
//   { provide: XSRFStrategy, useFactory: () => new CookieXSRFStrategy() },
// ];



@Injectable()
export class Resource<E, T, TA> {

  private static endpoints = {};
  public static reset() {
    Resource.endpoints = {};
    Resource.mockingModeIsSet = false;
  }
  private http: Http;
  private jp: Jsonp;

  constructor(
    @Inject(Http) http: Http,
    @Inject(Jsonp) jp:Jsonp
  ) {
    // const injector = ReflectiveInjector.resolveAndCreate([HTTP_PROVIDERS, JSONP_PROVIDERS])
    // const injector = Injector.bind([HTTP_PROVIDERS, JSONP_PROVIDERS])
    this.http = http // injector.get(Http)
    this.jp = jp // injector.get(Jsonp)

    // Quick fix
    if (Resource.__mockingMode === undefined) {
      Resource.__mockingMode = MockingMode.LIVE_BACKEND_ONLY;
    }
  }

  public static get Headers() {
    let res = {
      request: Rest.headers,
      response: Rest.headersResponse
    }
    return res;
  }

  public static enableWarnings: boolean = true;

  /**
   * This funcion only works one time per tab in browse.
   * It means that if e2e tests needs only one browse tab
   * which is refreshed constantly and it doesn't make sens to
   * recreate server every time. In conclusion curent function
   * state is remembered in sesssion storage.
   *
   * @static
   * @param {string} url to ng-orm
   * @param {string} Optional: Title for docs
   * @param {string} Optional: Force recreate docs every time when you are
   * using this function
   *
   * @memberOf Resource
   */
  public static setUrlToDocsServerAndRecreateIt(url: string, docsTitle: string = undefined,
                                                forceRecreate: boolean = false) {
    // console.info('setUrlToDocsServerAndRecreateIt');
    if (docsTitle) Rest.docsTitle = docsTitle;
    Rest.docServerUrl = sessionStorage.getItem('url');
    // console.info('Rest.docServerUrl', Rest.docServerUrl);

    if (forceRecreate ||
      Rest.docServerUrl === undefined ||
      Rest.docServerUrl === null ||
      Rest.docServerUrl.trim() === '') {

      Rest.docServerUrl = url;
      sessionStorage.setItem('url', url);
      Rest.restartServerRequest = true;
      console.info('Recreate docs server request');
    }

  }

  private static mockingModeIsSet = false;
  private static get __mockingMode(): MockingMode {
    return Rest.mockingMode;
  }

  private static set __mockingMode(mode) {
    Rest.mockingMode = mode;
  }
  public static setMockingModeOnce = (mode: MockingMode) => Resource.setMockingMode(mode, true)

  private static setMockingMode(mode: MockingMode, setOnce = false) {

    if (Resource.mockingModeIsSet) {
      if (Resource.enableWarnings) console.warn('MOCKING MODE already set for entire application');
      return;
    }
    Resource.mockingModeIsSet = setOnce;
    Resource.__mockingMode = mode;
    console.info('Mode is set ', mode);
  }

  public static mockingMode = {
    setMocksOnly: () => {
      Resource.setMockingMode(MockingMode.MOCKS_ONLY);
    },
    setBackendOnly: () => {
      Resource.setMockingMode(MockingMode.LIVE_BACKEND_ONLY);
    },
    isMockOnlyMode: () => Resource.__mockingMode === MockingMode.MOCKS_ONLY,
    isBackendOnlyMode: () => Resource.__mockingMode === MockingMode.LIVE_BACKEND_ONLY
  }


  /**
   * Use endpoint in your app
   *
   * @static
   * @template T
   * @param {T} endpoint_url
   * @returns {boolean}
   */
  public static use<T extends string>(endpoint_url: T): boolean {
    let regex = /((http|https):\/\/)?(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
    let e: string = endpoint_url;
    if (!regex.test(endpoint_url)) {
      console.error('Url address is not correct: ' + endpoint_url);
      return false;
    }
    if (Resource.endpoints[e] !== undefined) {
      if (Resource.enableWarnings) console.warn('Cannot use map function at the same API endpoint again ('
        + Resource.endpoints[e].url + ')');
      return false;
    }
    Resource.endpoints[e] = {
      url: endpoint_url,
      models: {}
    };
    return true;
  }
  private static subEurekaEndpointReady: Subject<Eureka.EurekaInstance>
    = new Subject<Eureka.EurekaInstance>();
  private static obs = Resource.subEurekaEndpointReady.asObservable();

  // private static eureka: Eureka<any, any>;
  public static mapEureka(config: Eureka.EurekaConfig): boolean {
    if (!config || !config.serviceUrl || !config.decoderName) {
      console.error(`Bad Eureka config: ${JSON.stringify(config)}`);
      return false;
    }
    Rest.eureka = new Eureka.Eureka(config);
    Rest.eureka.onInstance.subscribe(ins => {
      Resource.endpoints[ins.app] = {
        url: ins.instanceId,
        models: {}
      };
      Resource.subEurekaEndpointReady.next(ins);
    });
    console.log('eureka mapped');
    return true;
  }

  public static map(endpoint: string, url: string): boolean {

    log.i('url', url)

    if (Rest.eureka) {
      console.error(`Cannot use 'map()' function after 'mapEureka()'`);
      return false;
    }
    let regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
    let e = endpoint;
    if (!regex.test(url)) {
      console.error(`Url address is not correct: ${ url }`);
      return false;
    }
    if (url.charAt(url.length - 1) === '/') {
      url = url.slice(0, url.length - 1);
    }
    log.i('url after', url)
    if (Resource.endpoints[e] !== undefined) {
      if (Resource.enableWarnings) {
        console.warn(`Cannot use map function at the same API endpoint again (${ Resource.endpoints[e].url })`);
      }
      return false;
    }
    Resource.endpoints[e] = {
      url: url,
      models: {}
    };
    log.i('endpoints', Resource.endpoints)
    return true;
  }

  /**
   * And endpoint to application
   *
   * @param {E} endpoint
   * @param {string} model
   * @returns {boolean}
   */
  add(endpoint: E, model: string, group?: string, name?: string, description?: string) {
    console.log(`I am mapping ${model} on ${<any>endpoint}`);
    if (Rest.eureka && Rest.eureka.state === Eureka.EurekaState.DISABLED) {
      Rest.eureka.discovery(this.http);
    }

    if (Rest.eureka && Rest.eureka.state !== Eureka.EurekaState.ENABLE) {
      Resource.subEurekaEndpointReady.subscribe(ins => {
        console.log('SHOULD Be instance!!')
        this.add(endpoint, model, group, name, description);
      })
      return;
    }

    if (!name) {
      let exName: string = model.replace(new RegExp('/', 'g'), ' ');
      let slName = exName.split(' ');
      let newName = [];
      let rName = slName.map(fr => (fr[0]) ? (fr[0].toUpperCase() + fr.substr(1)) : '');
      name = rName.join(' ');
    }
    if (model.charAt(model.length - 1) === '/') {
      model = model.slice(0, model.length - 1);
    }
    if (model.charAt(0) === '/') {
      model = model.slice(1, model.length);
    }

    let e: string;
    if (Rest.eureka && Rest.eureka.state === Eureka.EurekaState.ENABLE && Rest.eureka.instance) {
      e = Rest.eureka.instance.app;
    } else {
      e = <string>(endpoint).toString();
    }

    if (Resource.endpoints[e] === undefined) {
      console.error(`Endpoint is not mapped! Cannot add model ${ model }`);
      return;
    }
    if (Resource.endpoints[e].models[model] !== undefined) {
      if (Resource.enableWarnings) {
        console.warn(`Model '${model}' is already defined in endpoint: ${Resource.endpoints[e].url}`);
      }
      return;
    }
    Resource.endpoints[e].models[model] =
      new Rest<T, TA>(`${ Resource.endpoints[e].url }/${ model }`, this.http, this.jp, description, name, group);
    return;
  }

  /**
   * Access api through endpoint
   *
   * @param {E} endpoint
   * @param {string} model
   * @returns {Rest<T, TA>}
   */
  api(endpoint: E, model: string, usecase?: string): Rest<T, TA> {
    // console.log('hello!')

    if (model.charAt(0) === '/') model = model.slice(1, model.length);
    let e = <string>(endpoint).toString();
    if (Resource.endpoints[e] === undefined) {
      console.error(`Endpoint is not mapped! Cannot add model ${ model }`);
      return;
    }
    let allModels: Object = Resource.endpoints[e].models;
    let orgModel = model;
    model = this.checkNestedModels(model, allModels);

    if (Resource.endpoints[e].models[model] === undefined) {
      console.log('Resource.endpoints', Resource.endpoints)
      console.error(`Model '${model}' is undefined in endpoint: ${Resource.endpoints[e].url}`);
      return;
    }

    let res: Rest<T, TA> = Resource.endpoints[<string>(endpoint).toString()].models[model];
    res.__usecase_desc = usecase;

    if (orgModel !== model) {
      let baseUrl = Resource.endpoints[<string>(endpoint).toString()].url;
      // console.log('base', Resource.endpoints[<string>(endpoint).toString()])
      // console.log('baseUrl', baseUrl)
      // console.log('orgModel', orgModel)
      res.__rest_endpoint = `${baseUrl}/${orgModel}`;
    } else res.__rest_endpoint = undefined;

    return res;
  }

  private checkNestedModels(model: string, allModels: Object) {
    if (model.indexOf('/') !== -1) {
      for (let p in allModels) {
        if (allModels.hasOwnProperty(p)) {
          // let m = allModels[p];
          if (UrlNestedParams.isValid(p)) {
            let urlModels = UrlNestedParams.getModels(p);
            if (UrlNestedParams.containsModels(model, urlModels)) {
              model = p;
              break;
            }
          }
        }
      }
    }
    return model;
  }
}
