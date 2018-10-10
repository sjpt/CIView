const path = require('path');
webpack=require("webpack");

module.exports = {
  entry: './src/indexes/index_ciview.js',
  output: {
    path: path.resolve(__dirname,"dist"),
    filename: 'ciview.js'
  },

  module:{
      
     rules:[
      {
        test : /\.js/,
	
        include : path.resolve(__dirname, 'src'),
        loader : 'babel-loader',
 		query: {
                    presets: ['es2015']
                 }
      }
    ]
  }
};
