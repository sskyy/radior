var path = require('path')

module.exports = {
  devtool: 'cheap-module-eval-source-map',
  entry: [
    './index.js'
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'index.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: [ 'babel' ]
      }
    ]
  }
}

