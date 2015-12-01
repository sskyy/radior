/* eslint-disable no-console */
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _defaultHandlers = {
  debug: {
    debug: function debug() {
      var args = Array.prototype.slice.call(arguments, 0);
      return console.log.apply(console, args);
    },
    log: function log() {
      var args = Array.prototype.slice.call(arguments, 0);
      return console.log.apply(console, args);
    }
  },
  info: {
    info: function info() {
      var args = Array.prototype.slice.call(arguments, 0);
      return console.info.apply(console, args);
    }
  },
  warn: {
    warn: function warn() {
      var args = Array.prototype.slice.call(arguments, 0);
      return console.warn.apply(console, args);
    }
  },
  error: {
    error: function error() {
      var args = Array.prototype.slice.call(arguments, 0);
      return console.error.apply(console, args);
    }
  }
};

var Debug = (function () {
  function Debug(level, handlers) {
    _classCallCheck(this, Debug);

    this.level = level || 'debug';
    this.levelMap = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };

    var container = [_defaultHandlers, handlers];
    var that = this;
    container.forEach(function (c) {
      if (!c) return;

      for (var handlerLevel in c) {
        for (var handlerName in c[handlerLevel]) {
          that.register(handlerLevel, handlerName, c[handlerLevel][handlerName]);
        }
      }
    });
  }

  _createClass(Debug, [{
    key: 'register',
    value: function register(level, name, handler) {
      if (this.levelMap[level] >= this.levelMap[this.level]) {
        this[name] = handler;
      }
    }
  }]);

  return Debug;
})();

module.exports = Debug;