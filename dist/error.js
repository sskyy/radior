'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function isNumber(obj) {
  return typeof obj === 'number';
}

var BusError = (function () {
  function BusError(code, data, stack, asyncErrors) {
    _classCallCheck(this, BusError);

    if (!isNumber(code)) {
      data = code;
      code = 500;
    }

    this.code = code;
    if (data instanceof Error) {
      this.data = { message: data.message };
      if (data.stack) {
        this.stack = data.stack.split(/\n/);
      }
    } else {
      this.data = data;
      //去掉没用的两个stack
      if (stack) {
        this.stack = stack;
      } else {
        var fakeError = new Error();
        if (fakeError.stack) {
          var stackArray = new Error().stack.split(/\n/);
          this.stack = stackArray.slice(0, 1).concat(stackArray.slice(3));
        }
      }
    }

    this.$class = data === undefined || data === null ? 'Null' : data.constructor.name;
    this.origin = data;
    this.asyncErrors = asyncErrors;
  }

  _createClass(BusError, [{
    key: 'fixES6',
    value: function fixES6() {
      //Babel 的 bug
    }
  }]);

  return BusError;
})();

module.exports = BusError;