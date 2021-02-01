const path = require('path');
webpack=require("webpack");

module.exports = {

	entry: './src/indexes/ciview.js',

  	output: {
    		path: path.resolve(__dirname,"dist"),
    		filename: 'ciview.js'
  	},
  	plugins: [
  		new webpack.ProvidePlugin({
			$: "jquery",
			jQuery: "jquery"     
  		})
	],

  	module:{ 
     		rules:[
                 //remove this, if 
     			{
        			test : /\.js/,
        			loader : 'babel-loader',
 				query:{
                    		presets: ['es2015']
                		}
      		},

			{
				test:/\.css$/,
          			use:[
					"style-loader",
					"css-loader"
				]
			},
			{
        			test: /\.(png|svg|jpg|gif|eot|ttf|woff|woff2)$/,
         			loader:'file-loader',
	    			options:{
					name:'[name].[ext]',
					outputPath:'images', //the physical location of the files
					publicPath:'images' //the url base that the code will look for the images (can be absolute or relative)
       			}
     			}
    		]
  	}
};
