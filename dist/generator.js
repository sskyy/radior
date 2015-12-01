'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var util = require('./util.js');
var Namespace = require('./Namespace.js');
var OrderedList = require('./OrderedList.js');
var BusRuntime = require('./Runtime.js');
var BusError = require('./Error.js');
var Debug = require('./Debug.js');
var debugHandler = require('./debug-handler.js');
var co = require('co');

var debug = new Debug(null, debugHandler);

var Bus = (function () {
  function Bus(options) {
    _classCallCheck(this, Bus);

    this.options = util.extend({}, options || {});

    this._listenerToDisable = new Map();
    this._eventListenerMap = new Map();
    this._rexEventListenerMap = new Map();

    //registration info
    this._module = new Namespace();
    this._blockForWaiting = new Set();
    this._anonymousIndex = 0;

    //store change listener
    this._onChangeListeners = [];
  }

  //register listener

  _createClass(Bus, [{
    key: 'on',
    value: function on(eventName, originListener) {
      var listener = this.normalizeListener(eventName, originListener);
      this.insertListener(listener);
      //mute option can only mute descendant event
      listener.disable && this.storeDisableRecord(listener.disable, eventName, listener);
    }

    //dump listener
  }, {
    key: 'off',
    value: function off() {}

    //keep listener in this._eventListenerMap
  }, {
    key: 'insertListener',
    value: function insertListener(listener) {
      if (!util.isString(listener.event) && !util.isRegExp(listener.event)) {
        throw new Error('Only String or RegExp can be used as event name');
      }

      var map = util.isString(listener.event) ? this._eventListenerMap : this._rexEventListenerMap;
      var order = util.pick(listener, ['before', 'after', 'first', 'last']);

      //no listener registered on the same event
      if (!map.get(listener.event.toString())) {
        map.set(listener.event.toString(), new OrderedList());
      }

      var listenerList = map.get(listener.event.toString());

      //convert blockFor to target's waitFor, it is easier to control the order
      if (listener.blockFor) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {

          for (var _iterator = listener.blockFor[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var listenerToBlock = _step.value;

            if (listenerList.get(listenerToBlock)) {
              util.ensureSet(listenerList.get(listenerToBlock), 'waitFor', listener.indexName);
            } else {
              //if blockFor target is not in the listener list yet, we need to wait for its insert.
              util.ensureSet(this._blockForWaiting, listenerToBlock, listener.indexName);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator['return']) {
              _iterator['return']();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }

      //if other listener want to blockFor current listener
      if (this._blockForWaiting[listener.indexName]) {
        util.ensureSet(listener, 'waitFor', this._blockForWaiting[listener.indexName]);
        this._blockForWaiting['delete'](listener.indexName);
      }

      //save the listener to map
      map.set(listener.event.toString(), listenerList.insert(listener.indexName, listener, order));

      return this;
    }
  }, {
    key: 'fire',
    value: function fire(rawEvent) {
      var _this = this;

      //TODO notice user if current bus is still firing
      //every time root bus fire a event, generate a new runtime
      //instead or reset
      if (!this.isSnapshot()) {
        this._runtime = new BusRuntime();
      }

      //all mute and disable are stored when normalizeEvent
      var event = this.normalizeEvent(rawEvent);

      var eventArgv = util.slice(arguments, 1);
      var listeners = this.getListeners(event.name);

      this._eventRuntimeKey = this._runtime.generateEventRuntime(this._listenerRuntimeKey, event, listeners);

      //根据触发条件{mute,disable,target}，依次触发监听器,如果监听器有 waitFor 选项，则将其加入到 waitFor 对象的 promise 中

      //获取监听器返回值
      // 如果返回非 bus.signal, 则继续执行。
      // 如果返回 bus.signal包装过的结果，如果结果是 promise，并且blockFor为all，则暂停遍历。
      // 如果没有结果或者是普通结果， signal{mute,disable,blockFor}, 则动态改变后面的触发条件

      // 如果返回 error, 则立即跳出整个 触发栈
      // 如果返回的是普通的对象，则构建结果树(不是数据树！)

      // 冲突情况: 异步的 waitFor 中返回的结果无法 block 任何
      this._runtime.recordFiring(event.name);
      this.notifyOnChangeListeners(undefined, event.name);

      var eventPromise = this.fireListeners(event, listeners, eventArgv);

      eventPromise.then(function () {
        _this._runtime.removeFiringRecord(event.name);
        _this.notifyOnChangeListeners(undefined, event.name);
        //}).catch((err)=> {
        //  this._runtime.removeFiringRecord(event.name)
        //  this.notifyOnChangeListeners(err, event.name)
      });

      return eventPromise;
    }
  }, {
    key: 'notifyOnChangeListeners',
    value: function notifyOnChangeListeners(err, eventName) {
      this._onChangeListeners.forEach(function (fn) {
        fn(err, eventName);
      });
    }
  }, {
    key: 'isFiring',
    value: function isFiring(eventName) {
      return this._runtime.isFiring(eventName);
    }
  }, {
    key: 'onChange',
    value: function onChange(onChangeListener) {
      this._onChangeListeners.push(onChangeListener);
    }
  }, {
    key: 'fireListeners',
    value: function fireListeners(event, listeners, eventArgv) {
      var _this4 = this;

      //依次触发，通过 snapshot 连接 traceStack, runtime

      //debug.log('fire======',event.name,'listeners:')
      //debug.log( event.disable,[...this._listenerToDisable.get(event.name).keys()])
      //used to save listener result
      var results = {};

      //point to current listener position in listeners list
      var listenerCursor = { next: listeners.head };
      //point to the real listener instance

      var asyncErrors = [];

      var firePromise = co(regeneratorRuntime.mark(function callee$2$0() {
        var _loop, _ret;

        return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
          var _this3 = this;

          while (1) switch (context$3$0.prev = context$3$0.next) {
            case 0:
              _loop = regeneratorRuntime.mark(function callee$3$0() {
                var listener, snapshot, result, promiseToWait, disableNames;
                return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
                  var _this2 = this;

                  while (1) switch (context$4$0.prev = context$4$0.next) {
                    case 0:
                      listenerCursor = listenerCursor.next;
                      listener = listenerCursor.value;

                      if (!(event.target && !event.target.has(listener.indexName))) {
                        context$4$0.next = 4;
                        break;
                      }

                      return context$4$0.abrupt('return', 'continue');

                    case 4:
                      if (!(event.disable && event.disable.get(listener.indexName))) {
                        context$4$0.next = 6;
                        break;
                      }

                      return context$4$0.abrupt('return', 'continue');

                    case 6:
                      snapshot = this.snapshot(listener);
                      result = undefined;

                      if (!listener.waitFor) {
                        context$4$0.next = 14;
                        break;
                      }

                      debug.log('calling listener', listener.indexName, listener.waitFor);
                      //if the target or targets  we are waiting is a promise
                      promiseToWait = util.from(listener.waitFor).reduce(function (waitForPromiseList, waitForName) {
                        if (results[waitForName].data instanceof Promise) {
                          //the real promise
                          waitForPromiseList.push(results[waitForName].data);
                        } else {
                          debug.warn('listener \'' + waitForName + '\' is not async listener, please use \'after\' instead of \'waitFor\'');
                        }
                        return waitForPromiseList;
                      }, []);

                      //debug.log(listener.indexName,'must wait for', listener.waitFor, promiseToWait.length)

                      //wrap current result to a promise, so current listener can be `waitFor` too

                      result = this.parseResult(Promise.all(promiseToWait).then(function () {
                        return _this2.callListener(listener, snapshot, eventArgv);
                      }));

                      context$4$0.next = 27;
                      break;

                    case 14:
                      if (!listener.async) {
                        context$4$0.next = 20;
                        break;
                      }

                      if (!util.isGenerator(listener.fn)) {
                        context$4$0.next = 17;
                        break;
                      }

                      throw new Error('generator can not be used as async listener.');

                    case 17:
                      result = this.parseResult(this.callListener(listener, snapshot, eventArgv));
                      context$4$0.next = 25;
                      break;

                    case 20:
                      context$4$0.t0 = this;
                      context$4$0.next = 23;
                      return this.callListener(listener, snapshot, eventArgv);

                    case 23:
                      context$4$0.t1 = context$4$0.sent;
                      result = context$4$0.t0.parseResult.call(context$4$0.t0, context$4$0.t1);

                    case 25:
                      if (!(result.data instanceof BusError)) {
                        context$4$0.next = 27;
                        break;
                      }

                      return context$4$0.abrupt('return', {
                        v: Promise.reject(result.data)
                      });

                    case 27:

                      //if nothing is wrong, we should get a BusResult instance
                      //save current listener result, may be use by other listener
                      //console.log('saving result of', listener.indexName, result)
                      results[listener.indexName] = result;

                      //debug.log( `result of ${listener.indexName}`,result,result instanceof ListenerResult )

                      //we can disable other listeners on the  fly
                      if (result.signal.disable !== undefined) {
                        if (!event.disable) event.disable = new Map();
                        disableNames = [].concat(result.signal.disable);

                        disableNames.forEach(function (disableName) {
                          if (!event.disable.get(disableName)) event.disable.set(disableName, new Set());
                          event.disable.get(disableName).add({ target: disableName, source: listener.indexName, type: 'call' });
                        });
                      }

                      //destroy snapshot if listener executed
                      if (result.data && result.data instanceof Promise) {
                        result.data.then(function () {
                          snapshot.destroy();
                        })['catch'](function (e) {
                          snapshot.destroy();
                          throw e;
                        });
                      } else {
                        snapshot.destroy();
                      }

                    case 30:
                    case 'end':
                      return context$4$0.stop();
                  }
                }, callee$3$0, _this3);
              });

            case 1:
              if (!(listenerCursor.next !== undefined)) {
                context$3$0.next = 12;
                break;
              }

              return context$3$0.delegateYield(_loop(), 't0', 3);

            case 3:
              _ret = context$3$0.t0;
              context$3$0.t1 = _ret;
              context$3$0.next = context$3$0.t1 === 'continue' ? 7 : 8;
              break;

            case 7:
              return context$3$0.abrupt('continue', 1);

            case 8:
              if (!(typeof _ret === 'object')) {
                context$3$0.next = 10;
                break;
              }

              return context$3$0.abrupt('return', _ret.v);

            case 10:
              context$3$0.next = 1;
              break;

            case 12:
              return context$3$0.abrupt('return', Promise.all(util.map(results, function (result) {
                if (result.data instanceof Promise) {
                  //we wrap async error
                  return result.data['catch'](function (err) {
                    if (!(err instanceof BusError)) {
                      err = new BusError(500, err);
                    }
                    asyncErrors.push(err);
                    //NOTICE! async error will not let the promise reject here, we will reject later
                    return Promise.resolve();
                  });
                }
              })));

            case 13:
            case 'end':
              return context$3$0.stop();
          }
        }, callee$2$0, this);
      }).bind(this)).then(function () {

        //返回一个 bus result 对象，这个对象上的 data 可以用来获取当前事件的数据
        if (asyncErrors.length !== 0) {
          return Promise.reject(new BusError(-500, null, undefined, asyncErrors));
        } else {
          return new BusResult(_this4._runtime.getRuntime(_this4._eventRuntimeKey).data, asyncErrors);
        }
      })['catch'](function (err) {
        //any synchronous error will be caught here.
        if (!(err instanceof BusError)) {
          err = new BusError(500, err, undefined, asyncErrors);
        }

        //return a wrapped data
        return Promise.reject(err);
      });

      //提供默认的this指针
      this.bindThisToResolver(firePromise);

      return firePromise;
    }
  }, {
    key: 'anonymousName',
    value: function anonymousName() {
      return 'anonymous_' + this._anonymousIndex++;
    }
  }, {
    key: 'getListenersFor',
    value: function getListenersFor(event) {
      var map = util.isString(event) ? this._eventListenerMap : this._rexEventListenerMap;
      return map.get(event);
    }
  }, {
    key: 'storeDisableRecord',
    value: function storeDisableRecord(listenerNames, fireEventName, listener) {
      listenerNames = [].concat(listenerNames);
      if (!this._listenerToDisable.get(fireEventName)) {
        this._listenerToDisable.set(fireEventName, new Map());
      }

      var disableMap = this._listenerToDisable.get(fireEventName);
      listenerNames.forEach(function (listenerName) {
        if (!disableMap.get(listenerName)) {
          disableMap.set(listenerName, new Set());
        }
        disableMap.get(listenerName).add({ target: listenerName, source: listener.indexName, type: 'listener' });
      });
    }
  }, {
    key: 'normalizeEvent',
    value: function normalizeEvent(rawEvent) {

      var eventObject = util.isString(rawEvent) ? { name: rawEvent } : rawEvent;
      var propertyToInitialize = ['disable', 'target'];

      propertyToInitialize.forEach(function (key) {
        if (eventObject[key]) eventObject[key] = [].concat(eventObject[key]);
      });

      //disable listener when fire
      if (eventObject.disable) {
        eventObject.disable = new Map([].concat(eventObject.disable).map(function (targetName) {
          return [targetName, new Set([{ target: targetName, source: eventObject.name, type: 'fire' }])];
        }));
      }

      //disable listener when listener register
      if (this._listenerToDisable.get(eventObject.name)) {
        if (!eventObject.disable) eventObject.disable = new Map();
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = this._listenerToDisable.get(eventObject.name)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var item = _step2.value;

            var targetName = item[0];
            var sources = item[1];
            if (!eventObject.disable.get(targetName)) {
              eventObject.disable.set(targetName, new Set());
            }
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = sources[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var source = _step3.value;

                eventObject.disable.get(targetName).add(source);
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                  _iterator3['return']();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2['return']) {
              _iterator2['return']();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      if (eventObject.target) {
        eventObject.target = new Set([].concat(eventObject.target));
      }

      return eventObject;
    }
  }, {
    key: 'getListeners',
    value: function getListeners(eventName) {
      // 找到所有匹配的event，字符串和正则
      var listeners = this._eventListenerMap.get(eventName) ? this._eventListenerMap.get(eventName).clone() : new OrderedList();

      //获取所有匹配到的监听器，并且将正则监听器重新与字符串监听器排序
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = this._rexEventListenerMap[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var item = _step4.value;

          var rex = item[0];
          var rexEventListener = item[1];
          if (new RegExp(rex).test(eventName)) {
            var order = util.pick(rexEventListener, ['before', 'after', 'first', 'last']);
            listeners.insert(rexEventListener.indexName, util.clone(rexEventListener), order);
          }
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4['return']) {
            _iterator4['return']();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      return listeners;
    }
  }, {
    key: 'callListener',
    value: function callListener(listener, snapshot, args) {
      //执行单个监听器,一定返回一个promise
      if (util.isGenerator(listener.fn)) {
        return co(regeneratorRuntime.mark(function callee$2$0() {
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0:
                context$3$0.next = 2;
                return listener.fn.apply(snapshot, args);

              case 2:
                return context$3$0.abrupt('return', context$3$0.sent);

              case 3:
              case 'end':
                return context$3$0.stop();
            }
          }, callee$2$0, this);
        }));
      } else {
        return Promise.resolve(listener.fn.apply(snapshot, args));
      }
    }
  }, {
    key: 'bindThisToResolver',
    value: function bindThisToResolver(promise) {
      var _then = promise.then;
      var that = this;
      promise.then = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        args = args.map(function (arg) {
          return arg && arg.bind(that);
        });
        return _then.apply(promise, args);
      };
      return promise;
    }
  }, {
    key: 'parseResult',
    value: function parseResult(result) {
      if (result instanceof ListenerResult) return result;

      return this.result(result, {});
    }
  }, {
    key: 'isSnapshot',
    value: function isSnapshot() {
      return this._isSnapshot === true;
    }
  }, {
    key: 'snapshot',
    value: function snapshot(listener) {
      //同级的snapshot, data 是共享的。其他都不共享
      //所以 data 由参数传进来
      var snapshot = util.extend({
        _isSnapshot: true,
        _eventRuntimeKey: this._eventRuntimeKey.slice(0),
        _listenerRuntimeKey: this._runtime.getListenerRuntimeKey(this._eventRuntimeKey, listener.indexName)
      }, this);

      snapshot.__proto__ = this.__proto__;

      return snapshot;
    }
  }, {
    key: 'clone',
    value: function clone() {
      var cloned = { _isSnapshot: true };
      //获取当前实例上的一切属性
      util.extend(cloned, this);

      cloned.__proto__ = this.__proto__;

      return cloned;
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      for (var i in this) {
        delete this[i];
      }
      this._isDestoryed = true;
      this.__proto__ = null;
    }
  }, {
    key: 'set',
    value: function set(key, value) {
      var runtime = this._runtime.getRuntime(this._eventRuntimeKey);
      runtime.data.shared[key] = value;
    }
  }, {
    key: 'get',
    value: function get(key) {
      return this._runtime.getRuntime(this._eventRuntimeKey).data.shared[key];
    }
  }, {
    key: 'getGlobal',
    value: function getGlobal(key) {
      return this._runtime.getRuntime().data.global[key];
    }
  }, {
    key: 'setGlobal',
    value: function setGlobal(key, value) {
      var runtime = this._runtime.getRuntime();
      runtime.data.global[key] = value;
    }

    //这个得到的是每个监听器的Result
  }, {
    key: 'result',
    value: function result(data, signal) {
      signal = signal || {};
      if (arguments.length == 1) {
        signal = data;
        data = undefined;
      }
      return new ListenerResult(data, signal);
    }
  }, {
    key: 'error',
    value: function error(code, data) {
      return new BusError(code, data);
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      var events = [];
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = this._eventListenerMap.keys()[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var _name = _step5.value;

          events.push(_name);
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5['return']) {
            _iterator5['return']();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      return events;
    }
  }, {
    key: 'makeEventStack',
    value: function makeEventStack(event, listenersOrderedList, index) {
      var eventStack = {};
      eventStack.event = util.cloneDeep(event);
      eventStack.$class = 'event';

      var clonedListenerArray = util.cloneDeep(listenersOrderedList.toArray(), function (item) {
        if (item instanceof Set) {
          return util.from(item);
        } else if (item instanceof Map) {
          return util.zipObject(util.from(item.keys()), util.from(item.values()));
        } else if (item instanceof Function) {
          return '[Function ' + item.name + ']';
        }
      }).map(function (listener) {
        listener.$class = 'listener';
        return listener;
      });

      eventStack.listeners = util.zipObject(clonedListenerArray.map(function (listener) {
        return listener.indexName;
      }), clonedListenerArray);

      eventStack.index = index;
      return eventStack;
    }
  }, {
    key: 'normalizeListener',
    value: function normalizeListener(eventName, listener) {
      listener = util.isFunction(listener) ? { fn: listener } : listener;
      listener.event = eventName;

      //change plain string to Namespace object
      if (!listener.module) {
        listener.module = this._module.clone();
      } else {
        if (listener.module !== this._module.toString()) {
          listener.vendor = this._module.clone();
        } else {
          listener.module = new Namespace(listener.module);
        }
      }

      if (listener.before) {
        listener.before = new Set([].concat(listener.before));
      }

      if (listener.after) {
        listener.after = new Set([].concat(listener.after));
      }

      if (listener.blockFor) {
        listener.blockFor = new Set([].concat(listener.blockFor));

        if (!listener.before) listener.before = new Set();
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = listener.blockFor[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var blockForName = _step6.value;

            listener.before.add(blockForName);
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6['return']) {
              _iterator6['return']();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }
      }

      if (listener.waitFor) {
        listener.waitFor = new Set([].concat(listener.waitFor));

        if (!listener.after) listener.after = new Set();
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;
        var _iteratorError7 = undefined;

        try {
          for (var _iterator7 = listener.waitFor[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
            var waitForName = _step7.value;

            listener.after.add(waitForName);
          }
        } catch (err) {
          _didIteratorError7 = true;
          _iteratorError7 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion7 && _iterator7['return']) {
              _iterator7['return']();
            }
          } finally {
            if (_didIteratorError7) {
              throw _iteratorError7;
            }
          }
        }
      }

      if (!listener.name) {
        listener.name = listener.fn.name || this.anonymousName();
      }

      listener.indexName = listener.module.toString() ? listener.module.toString() + '.' + listener.name : listener.name;

      return listener;
    }
  }]);

  return Bus;
})();

var ListenerResult = function ListenerResult(data, signal) {
  _classCallCheck(this, ListenerResult);

  this.$class = data === null || data === undefined ? data : data.constructor.name;
  this.data = data;
  this.signal = signal;
};

var BusResult = (function () {
  function BusResult(data, errors) {
    _classCallCheck(this, BusResult);

    this.data = data;
    this.errors = errors;
  }

  _createClass(BusResult, [{
    key: 'get',
    value: function get(key) {
      return this.data.shared[key];
    }
  }, {
    key: 'getGlobal',
    value: function getGlobal(key) {
      return this.data.global[key];
    }
  }]);

  return BusResult;
})();

module.exports = Bus;

//begin to call listeners, note that data are shared between listeners

//event can be fired targeting certain listener

//event can disable certain listener

//create snapshot of bus for current listener

//used to save current listener result

//if we have to wait for other listeners

//if no waitFor option
//debug.log('calling none waitFor listener', listener.indexName)

//listener with async option can not be generator

//if we got a BusError, we should break the loop as build-in error

//wait for all listeners who returned a promise, no matter it is async or not