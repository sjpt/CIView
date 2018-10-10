const path = require('path');
webpack=require("webpack");

module.exports = {
  entry: './src/indexes/index.js',
  output: {
    path: path.resolve(__dirname,"dist"),
    filename: 'Graphs.js'
  },
  plugins: [
  new webpack.ProvidePlugin({
	$: "jquery",
	jquery: "jquery"/*,
	d3:path.resolve(__dirname,"./src/vendor/d3.js"),
      crossfilter:path.resolve(__dirname,"./src/vendor/crossfilter.js"),
      dc:path.resolve(__dirname,"./src/vendor/dc.min.js")
*/
     

  })
],


  module:{
      
     rules:[
      {
        test : /\.js/,
	
        include : path.resolve(__dirname, 'src'),
        exclude: path.resolve(__dirname,'src/vendor'),
        loader : 'babel-loader',
 		query: {
                    presets: ['es2015']
                 }
      }
    ]
  }
};
