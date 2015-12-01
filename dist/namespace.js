'use strict';
//TODO JSON.stringify

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Namespace = (function () {
  function Namespace(defaultModule) {
    _classCallCheck(this, Namespace);

    this.namespace = defaultModule ? typeof defaultModule == 'string' ? defaultModule.split(':') : defaultModule : [];
  }

  _createClass(Namespace, [{
    key: 'push',
    value: function push(name) {
      this.namespace.push(name);
      return this;
    }
  }, {
    key: 'pop',
    value: function pop() {
      return this.namespace.pop();
    }
  }, {
    key: 'set',
    value: function set(name) {
      if (this.namespace.length == 0) {
        this.namespace.push(name);
      } else {
        this.namespace[this.namespace.length - 1] = name;
      }
      return this;
    }
  }, {
    key: 'get',
    value: function get() {
      return this.namespace[this.namespace.length - 1];
    }
  }, {
    key: 'parent',
    value: function parent() {
      return this.namespace[this.namespace.length - 2];
    }
  }, {
    key: 'clone',
    value: function clone() {
      return new Namespace(this.namespace);
    }
  }, {
    key: 'valueOf',
    value: function valueOf() {
      return this.namespace.join(':');
    }
  }, {
    key: 'toObject',
    value: function toObject() {
      return this.namespace.join(':');
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.namespace.join(':');
    }
  }]);

  return Namespace;
})();

module.exports = Namespace;