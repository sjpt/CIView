const path = require('path');
webpack=require("webpack");

module.exports = {

	entry: './src/indexes/filter_panel_index.js',

  	output: {
    		path: path.resolve(__dirname,"dist"),
    		filename: 'filter_panel.js'
  	},
  	plugins: [
  		new webpack.ProvidePlugin({
			$: "jquery",
			jQuery: "jquery"     
  		})
	],

  	module:{ 
     		rules:[
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
					outputPath:'./images/'
       			}
     			}
    		]
  	}
};
