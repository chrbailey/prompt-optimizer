// Mock ora for Jest testing (CommonJS)

const createSpinner = (options) => {
  const spinner = {
    text: typeof options === 'string' ? options : options?.text || '',
    start: function() { return this; },
    stop: function() { return this; },
    succeed: function(text) { this.text = text || this.text; return this; },
    fail: function(text) { this.text = text || this.text; return this; },
    warn: function(text) { this.text = text || this.text; return this; },
    info: function(text) { this.text = text || this.text; return this; },
    stopAndPersist: function() { return this; },
    clear: function() { return this; },
    render: function() { return this; },
    frame: function() { return ''; },
    isSpinning: false,
    color: 'cyan',
    spinner: { interval: 80, frames: ['-'] },
  };
  return spinner;
};

module.exports = createSpinner;
module.exports.default = createSpinner;
module.exports.Ora = class Ora {};
