# CIView

CiView is a way of looking a multi-variate data and quickly visualizing the effect that each parameter has on the dataset as a whole. Able to to work with upto a million data items, it allows homing in and visualizing smaller subsets. It is based on three main components
* [filter panel](https://github.com/Hughes-Genome-Group/CIView/wiki/Filter-Panel) based upon dc charts (https://dc-js.github.io/dc.js/), which in turn used d3 (https://d3js.org/) and crossfilter(https://square.github.io/crossfilter/) houses interactive graphs. Users can add and customize graphs to best visulaize and manpiulate the data. The default scatter plots have been replaced with those using webgl technology 
* A conventional excel like table (slickgrid - https://github.com/mleibman/SlickGrid) 
* A table displaying images

![Screen Shot](ciview.png)

## Quick Start

Just copy dist/ciview.js and put the  dist/images directory in the same directory as your html page. Then just import mlv_panel.js in
a <script> tag - see [example1](examples/example1.html). Older browsers may also require polyfills.


## Building from Source
The source files are bundled together, minified and converted to legacy javascript using [webpack](https://webpack.js.org/). 
For a standard build cd to the base directory and use the following command (assuming you have webpack installed)
```
webpack --config ciview_config.js
```
The [index file](src/indexes/mlv_panel_index.js) specified in the config simply imports the required css files and javascript modules 
and exposes certain modules by attaching them to the window object.

## Documentation
Documentation can be found on the [wiki](https://github.com/Hughes-Genome-Group/CIView/wiki) and examples along wih source code [here](https://martinsergeant.github.io/ciview_examples.html).
