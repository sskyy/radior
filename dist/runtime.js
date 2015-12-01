'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var util = require('./util.js');

var BusRuntime = (function () {
  function BusRuntime() {
    _classCallCheck(this, BusRuntime);

    this.data = {};
    this.firing = {};
  }

  _createClass(BusRuntime, [{
    key: 'generateEventRuntime',
    value: function generateEventRuntime(listenerRuntimeKey, event, listeners) {
      var runtimeData = {
        event: util.cloneDeep(event),
        data: {
          global: {},
          shared: {}
        },
        listeners: util.indexBy(listeners.toArray().map(function (listener) {
          return util.extend(util.pick(listener, ['name', 'indexName', 'module']), {
            childEvents: []
          });
        }), 'indexName')
      };

      var newEventRuntimeKey = undefined;
      if (listenerRuntimeKey !== undefined) {
        var childEvents = util.getRef(this.data, listenerRuntimeKey).childEvents;

        //save runtime data to the tree
        childEvents.push(runtimeData);
        newEventRuntimeKey = listenerRuntimeKey.concat('childEvents', childEvents.length - 1);
      } else {
        this.data = runtimeData;
        newEventRuntimeKey = [];
      }

      return newEventRuntimeKey;
    }
  }, {
    key: 'getListenerRuntimeKey',
    value: function getListenerRuntimeKey(eventRuntimeKey, listenerIndexName) {
      return eventRuntimeKey.concat('listeners', listenerIndexName);
    }
  }, {
    key: 'recordFiring',
    value: function recordFiring(eventName) {
      this.firing[eventName] = true;
    }
  }, {
    key: 'removeFiringRecord',
    value: function removeFiringRecord(eventName) {
      this.firing[eventName] = false;
    }
  }, {
    key: 'isFiring',
    value: function isFiring(eventName) {
      return !!this.firing[eventName];
    }
  }, {
    key: 'getRuntime',
    value: function getRuntime(runtimeKey) {
      return util.getRef(this.data, runtimeKey || []);
    }
  }]);

  return BusRuntime;
})();

module.exports = BusRuntime;