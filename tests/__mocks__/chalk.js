// Mock chalk for Jest testing (CommonJS)
// Returns the string unchanged for all chalk methods

const identity = (str) => str;

const createChalk = () => {
  const chalk = (str) => str;
  
  // Colors
  chalk.red = identity;
  chalk.green = identity;
  chalk.blue = identity;
  chalk.yellow = identity;
  chalk.cyan = identity;
  chalk.magenta = identity;
  chalk.white = identity;
  chalk.black = identity;
  chalk.gray = identity;
  chalk.grey = identity;
  chalk.dim = identity;
  chalk.bold = identity;
  chalk.italic = identity;
  chalk.underline = identity;
  chalk.inverse = identity;
  chalk.strikethrough = identity;
  
  // Background colors
  chalk.bgRed = identity;
  chalk.bgGreen = identity;
  chalk.bgBlue = identity;
  chalk.bgYellow = identity;
  chalk.bgCyan = identity;
  chalk.bgMagenta = identity;
  chalk.bgWhite = identity;
  chalk.bgBlack = identity;
  
  // Chainable
  chalk.red.bold = identity;
  chalk.green.bold = identity;
  chalk.yellow.bold = identity;
  chalk.bold.red = identity;
  chalk.bold.green = identity;
  chalk.bold.yellow = identity;
  chalk.dim.red = identity;
  chalk.dim.green = identity;
  chalk.dim.yellow = identity;
  
  return chalk;
};

module.exports = createChalk();
module.exports.default = createChalk();
