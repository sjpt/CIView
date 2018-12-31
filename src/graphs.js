import {d3} from "./vendor/d3.js";
import {dc} from "./vendor/dc.js";
import {crossfilter} from "./vendor/crossfilter.js";
import {WGL2DI} from "./webgl/wgl2di.js";
import "./vendor/gridstack.js";


/**
* @class
*/

class FilterPanel{
      /**
     * Creates a filter panel
     * @param {string } div_id - The id of the div element to house the panel
     * @param {object[]} data - The actual data, consisting  of an array of objects containg key/values
     * @param {FilterPanel~dataFiltered} [listener] - The callback for when data is changed
     */
    constructor(div_id,data,listener){
        let self=this;
        this.div=$("#"+div_id);
        //create the gridstack
        this.div.addClass("grid-stack");
        this.div.gridstack(
            {
                width:12,
                verticalMargin:10,
                cellHeight:40,
                minWidth:600,
                draggable: {
                    handle: '.chart-label',
                }
            }
        )
        this.div.on("resizefinished",function(event, ui) {
            let ch= ui.originalElement.data("chart");
            ch.setSize();
        });
        this.gridstack=this.div.data("gridstack");


        this.extra_divs={};
        this.ndx= crossfilter(data);
        this.filtered_ids;
        this.charts={};
        this.listener=listener;
        this.param_to_graph={};
        $(window).on("resize",function(e){
            if (!e.originalEvent){
                self.resize();
            }
            else if (e.originalEvent.srcElement === window){
                self.resize();
            }
            
        });
        this.custom_filters={};
        this.custom_filter_functions={};
    }
    

    /**
    * Reizes all graphs depending on the size of the parent div 
    * Automatically called by a  window resize event, but shhould be 
    * called explicity if the parent dic changes size
    */
    resize(){
       for (let name in this.charts){
           this.charts[name].setSize();
       } 
    }

    dataChanged(field,not_broadcast){
        let chart = this.param_to_graph[field];
        if (chart){
            chart.dataChanged(not_broadcast);
            chart.chart.redraw()
        }
    }


    addRecords(records){
        this.ndx.add(records);
    }


    /**
    * Creates (or alters) a custom filter
    * @param {string } id - The id of filter. If the filter exists, it will be replaced
    * @param {string} param - The parameter to filter on
    * @param {function} listener - The filter function
    * @param {boolean} [not_propagate] - If true the the listener will not be callled 
    */
    addCustomFilter(id,param,filter,not_propagate){
        let dim =null;
        this.custom_filter_functions[id]=filter;
        if (this.custom_filters[id]){
            dim= this.custom_filters[id]
            dim .filter(null);
        }
        else{
            dim = this.ndx.dimension(function(d){
			return d[param];
		  });
        }
		dim.filter(function(d){
			return filter(d);
		});
		this.custom_filters[id]=dim;
		dc.redrawAll();
    	this._chartFiltered(dim.top(1000000),null,not_propagate);
    }

    updateCustomFilter(id){
        let func = this.custom_filter_functions[id];
         this.custom_filters[id].filter(function(d){
             return func(d);
         });
    }


    /**
    * Removes a custom filter
    * @param {string } id - The id of filter to remove
    * @param {boolean} [not_propagate] - If true the the listener will not be callled 
    */ 
    removeCustomFilter(id,not_propagate){
        let dim = this.filters[id];
		if (!dim){
			return false;
		}
		dim.filter(null)
		dc.redrawAll();
		this._chartFiltered(dim.top(1000000),null,not_propagate);
		dim.remove();
		delete this.filters[id];
    }







 

    /**
    * Adds a chart to the panel
    * @param {string} type - The type of graph. can be:-
    * <ul>
    * <li> scatter_plot </li>
    * <li> bar_chart </li>
    * <li> ring_chart </li>
    * <li> row_chart </li>
    * <li> wgl_scatter_plot </li>
    * </ul>
    * @param {string|string[]|function} params - The field in the data (or fields e.g for scatter plot)
    * can also be a function
    * @param {string} label - The name to be displayed
    * @param {string} [id] - The id of the graph. If not supplied an id will be assigned and
    * returned
    * @param {Object} [location] - An object containing x,y,width and height (grid co-ordinates)
    * If not supplied than the chart will be added to the end of the grid with a height and width
    * of 2 
    */
    addChart(type,params,label,id,location){
        let self = this;
        //html friendly id 
        let div_id = "filter-chart-"+FilterPanel.count++;
        if (!id){
            id=div_id;
        }
        let autoplace=false;
        if (!location){
            location={
                x:0,
                y:0,
                width:6,
                height:2
            }
            autoplace=true;
        }
        
        //create divs and add to the gridstack
        let div=$("<div>").attr("class","grid-stack-item");
        let content = $("<div>").attr({"class":"grid-stack-item-content","id":div_id}).appendTo(div);
        this.gridstack.addWidget(div,location.x,location.y,location.width,location.height,autoplace);
        //create the actual chart
        let chart = new FilterPanel.chart_types[type](this.ndx,params,div_id,label);
        this.charts[id]=chart;
        div.data("chart",chart);
       
        chart.setUpdateListener(function(filtered_items,name){
            self._chartFiltered(filtered_items,id);
        });
        if (typeof(params)=="function"){

        }
        else if  (typeof(params) !=="string"){
            for (let param of params){
                this.param_to_graph[param]=chart;
            }
        }
        else{
            this.param_to_graph[params]=chart;
        }

          let remove = $("<i class='fas fa-trash'></i>").css({"margin-left":"auto","margin-right":"3px"}).appendTo(chart.ti)
          .click(()=>{
             this.removeChart(id);
          })

    }

    removeChart(id){
        let chart = this.charts[id];
        if (!chart){
            return false;
        }
        let parent_div=chart.div.parent();
        let left = chart.remove();
        this.gridstack.removeWidget(parent_div);
        if (left){
            dc.redrawAll();
            this._chartFiltered(left);
        }
        delete this.charts[id];
    }


    filterChanged(){
        //get rendom graph
        let chart=null
        for (let gn in this.charts){
            chart =this.charts[gn];
            break;
        }
        dc.redrawAll();
        if (chart){
            let items = chart.dim.top(1000000);
            this._chartFiltered(items);
        }

    }
 

    _chartFiltered(filtered_items,chart_exclude,not_propogate){
        this.filtered_ids={};
        for (let item of filtered_items){
            this.filtered_ids[item.id]=true
        }
        for (let name in this.charts){
            let chart = this.charts[name];
            if (chart._hide){
                if (name == chart_exclude){
                    chart._filter(this.filtered_ids);

                }
                else{
                    chart._hide(this.filtered_ids);
                }
            }
         }
         if (!(not_propogate) && this.listener){
            this.listener(filtered_items,this.filtered_ids);
         }
    }

    setListener(func){
        this.listener=func;
    }

    refresh(){
       
        //dc.renderAll();
        this.resize();
    }
}

/**
 * This callback is displayed as part of the Requester class.
 * @callback FilterPanel~dataFiltered
 * @param {Object[]} filtered_items - The remaining items after filtering
 * @param {Object} filtered_ids - An object containing all the filtered items ids (with a 
 * a value of true)
 */








class MLVChart{
    constructor(ndx,div_id,chart_type,title){
        let self=this;
        this.ndx=ndx;
        this.div=$("#"+div_id).css({"display":"inline-block"});
        this.ti=$("<div>").text(title).appendTo(this.div).css({"display":"flex","white-space":"nowrap"}).attr("class","chart-label");
        this.chart=chart_type("#"+div_id);
        this.chart.on("filtered",function(){
            if (self.not_broadcast){
                self.not_broadcast=false;
            }
            else{
                self.updateListener(self.dim.top(1000000));
            }
         });

        this.title=title;
        this.chart.controlsUseVisibility(true);
        let reset_but = $("<button>").text("reset").attr("class","pull-right reset btn btn-sm btn-primary").css({height:"20px","padding":"2px","margin-left":"5px","visibility":"hidden"})
            .click(function(e){
            self.chart.filterAll();
            dc.redrawAll();
            })
            .appendTo(this.ti);

          let cog = $("<i class='fas fa-cog'></i>").css({"margin-left":"auto","margin-right":"3px"}).appendTo(this.ti)
          .click(()=>{
              new MLVChartDialog(this);
          });
        


        this.updateListener=function(){};

    }

    setUpdateListener(func){
        this.updateListener=func;
    }
    

    /**
    * Sets the size of the graph. If no parameters are supplied
    * then the graph will be resized based on it container. 
    * @param {integer} x - The new width 
    * @param {integer} y The new height;
    */
    setSize(x,y){
        if (x){
            this.div.height(y);
            this.div.width(x);
        }
        else{
           y=this.div.height();
           x=this.div.width();
        }
        this.height=y-this.ti.height()+10;
        this.width=x;
        this.chart.width(this.width).height(this.height);
       
       
    }

    removeFilter(){
        this.chart.filterAll();
    }

     /**
    * Removes the chart from the dom, clearing any filters
    * The updated items are returned
    * 
    */

    remove(){   
        this.dim.filter(null);
        let left = this.dim.top(1000000);
        this.dim.dispose();
        this.chart.resetSvg();
        this.div.remove();
        return left;
    }

    dataChanged(){

    }

}





class MLVBarChart extends MLVChart{
    constructor(ndx,param,div_id,title,size){
       
          
        
        super(ndx,div_id,dc.barChart,title);
        let self =this;
        this.div.addClass("div-bar_chart");
          
        this.default_bin_number=10;
        this.param=param;
       
        //work out 
        this.dim = ndx.dimension(
            function(d){return d[self.param];}
        );
        this.max = this.dim.top(1)[0][param];
        this.min= this.dim.bottom(1)[0][param];
        if (!size){
            size=[300,200];
        }
        this.setParameters({max:this.max,min:this.min,bin_number:this.default_bin_number});
        this.setSize();
    }

    _addField(param){
       

    }

    setFilter(a,b){
        this.chart.filterAll();
        setTimeout(()=>{
            this.chart.filter(dc.filters.RangedFilter(a,b));
        },50);
        dc.redrawAll();
    }

    setSize(x,y){
        super.setSize(x,y);
         this.chart.x(d3.scaleLinear().domain([this.display_min-this.bin_width,this.display_max+this.bin_width]))
         .xAxis().ticks(Math.round(this.width/30));
         this.chart.yAxis().ticks(Math.round(this.height/25));
         this.chart.redraw();
    }

    changeFields(new_field){
        let self = this;
        this.param=new_field;
         this.dim = this.ndx.dimension(
            function(d){return d[self.param];}
        );
        this.max = this.dim.top(1)[0][this.param];
        this.min= this.dim.bottom(1)[0][this.param];
        this.param=new_field;
        this.setParameters({max:this.max,min:this.min,bin_number:this.bin_number});
    }

   

    setParameters(params,reset_range){
        let self=this;
        if (!params){
          this.display_max=this.max;
          this.display_min=this.min;
          this.bin_number=this.default_bin_number;
          this.max_y=null;

        }
        else{
            if (params.max || params.max===0){
                this.display_max=params.max;
            }
            if (params.min || params.min===0){
            this.display_min=params.min;
            }
            if (params.bin_number){
                this.bin_number=params.bin_number;
            }
          
            this.max_y=params.max_y;
            
        }
        this.dim.dispose();
        this.range = this.display_max-this.display_min

        this.bin_width=this.range/this.bin_number
        this.dim=this.ndx.dimension(
            function(d){
                if (d[self.param]>self.display_max){
                    return self.display_max
                }
                if (d[self.param]<self.display_min){
                    return self.display_min
                }

                return d[self.param];
           }
        );
      
        if (this.group){
            this.group.dispose()
        }
        this.group = this.dim.group(function(d){
             return self.bin_width * Math.floor(d/self.bin_width);
        });
        this.chart.dimension(this.dim)
                   .xUnits(dc.units.fp.precision(this.bin_width))
                   .group(this.group)
                   .x(d3.scaleLinear().domain([this.display_min-this.bin_width,this.display_max+this.bin_width]))
                   
                   .yAxisLabel("",0)
                    .xAxis().ticks(Math.round(this.width/30)).tickFormat(function(v,i){
                        if (v>=1000){
                        if ((i+1)%2==0){
                            if (v>=100000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        }
                        return "";
                        }
                        else{
                            return v
                        }
                    });
                        
        this.chart.yAxis().ticks(Math.round(this.height/25)).tickFormat(function(v,i){
                            if (v>=100000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        
         
                    });

        if (this.max_y){
            this.chart.elasticY(false);
            this.chart.y(d3.scaleLinear().domain([0,this.max_y]))
        }
        else{
            this.chart.elasticY(true);
        }    
        this.chart.margins().right = 10;
        this.chart.margins().left=40;
        ;
        this.chart.render();
                        
    }
}


class WGLScatterPlot{
    constructor(ndx,params,div_id,title,size){
        this.name=title;
        this.title=title;
        this.default_color=[31, 119, 180];
        this.ndx=ndx;
        this.y_axis_width=40;
       
        this.x= params[0];
        this.y=params[1];
        let self = this
        this.dim = ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
     
       
      
        let div = $("#"+div_id);
        this.div=div;
        this.ti=$("<div>").attr("class","chart-label").css({"display":"flex","white-space":"no-wrap"}).text(title);
        this.reset_but = $("<button>").attr("class","pull-right btn btn-sm btn-primary")
             .text("reset").css({height:"20px","padding":"2px","margin-left":"5px","visibility":"hidden"})
             .click(function(e){
                 self.app.clearBrush();
                 self._createFilter(null);
                 self.reset_but.css("visibility","hidden");
             }).appendTo(this.ti);
        this.ti.appendTo(div);
        let holder_id= "wg-graph-holder"+WGLScatterPlot.count++;
        this.holder_div=$("<div>").attr("id",holder_id).appendTo(div);
        let id = "wg-graph-"+WGLScatterPlot.count++;
        let graph_div= $("<div>").css({"position":"relative","margin-bottom":"20px","margin-left":this.y_axis_width+"px"}).attr("id",id).appendTo(this.holder_div);

        this.axis = d3.select("#"+holder_id).append("svg").attr("width", 50).attr("height", 50).styles({
           position:"absolute",
           top:"0px",
           left:"0px",
           "z-index":-10
        });
        this.y_axis_svg=this.axis.append("g");
        this.x_axis_svg=this.axis.append("g");

        this.y_axis_scale=  d3.scaleLinear();
        this.x_axis_scale= d3.scaleLinear();

        this.x_axis_call= d3.axisBottom(this.x_axis_scale);
        this.y_axis_call=d3.axisLeft(this.y_axis_scale);


        this.app = new WGL2DI(id,this.div.width(),this.div.height());

        this.app.addHandler("zoom_stopped",function(data){
            self._updateScale(data);
          
        });

        this.app.addHandler("panning_stopped",function(data){
            self._updateScale(data);
          
        });

        this._init();

        //this.centerGraph();

		
		
		this.app.initialise();
		this.app.refresh();
		this.app.addHandler("brush_stopped",function(range){
		    self.reset_but.css("visibility","visible");
		    range.y_max=-range.y_max;
		    range.y_min=-range.y_min;
		    self._createFilter(range);
		});
		this.setSize();
      
    }
    setUpdateListener(func){
        this.updateListener=func;
    }

    _updateScale(range){
        this.x_axis_scale.domain([range.x_range[0],range.x_range[1]]);
        this.x_axis_svg.transition().call(this.x_axis_call);
        this.y_axis_scale.domain([-range.y_range[0],-range.y_range[1]]);
        this.y_axis_svg.transition().call(this.y_axis_call);
    }

    _init(){
        let self=this;
        let y_dim = this.ndx.dimension(function(d){return d[self.y]});
        this.max_y=y_dim.top(1)[0][self.y];
        this.min_y=y_dim.bottom(1)[0][self.y];
        y_dim.dispose();
        let x_dim = this.ndx.dimension(function(d){return d[self.x]});
        this.max_x= x_dim.top(1)[0][self.x];
        this.min_x= x_dim.bottom(1)[0][self.x];
        x_dim.dispose();
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10);

        let x_range = this.max_x-this.min_x;
        this.x_axis_scale.domain([this.min_x,this.max_x]);
        this.x_scale=1000/x_range;
        this.x_scale = this.x_scale>1?1:this.x_scale;

        let y_range = this.max_y-this.min_y;
        this.y_axis_scale.domain([-this.min_y,-this.max_y])
        this.y_scale=1000/y_range;
        this.y_scale = this.y_scale>1?1:this.y_scale;
       let fudge = y_range<x_range?y_range:x_range;
       this.radius = fudge/50;
        let data = this.dim.top(10000000);
        for (let item of data){
			this.app.addCircle([item[this.x],-(item[this.y])],this.radius,this.default_color,item.id);
		}
		

    }

    changeFields(fields){
        this.x= fields[0];
        this.y=fields[1];
        let self = this;
        //remove all filters
        this._createFilter(null);
        this.dim.dispose();

        this.dim = this.ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
        this.app.removeAllObjects();
        this._init();
        this.centerGraph();
        this.app.refresh();
        this._updateScale(this.app.getRange());
    }



    remove(){
        this.dim.filter(null);
        let left  = this.dim.top(1000000);
        this.dim.dispose();
        this.div.remove();
        return left;
    }

    removeFilter(){
        this.dim.filter(null);
        this.app.clearBrush();
    }
    
    _createFilter(range){
        if (range==null){
            this.dim.filter(null);
        }
        else{
         
            this.dim.filter(function(d){
                if (d[0]>range.x_max || d[0]<range.x_min){
                    return false;
                }
                if (d[1]<range.y_max || d[1]>range.y_min){
                    return false;
                }
                return true;
            });
        }
        dc.redrawAll();
        let name = this.name;
        if (range==null){
            name=null;
        }
        this.updateListener(this.dim.top(1000000),name);
    }

    centerGraph(){
        let x_margin=Math.round((this.max_x-this.min_x)/20);
        let y_margin=Math.round((this.max_y-this.min_y)/20);
        let x_range = (this.max_x-this.min_x)+2*x_margin;
        let y_range= (this.max_y-this.min_y)+2*y_margin;

        let x_scale= (this.width-this.y_axis_width)/x_range;
        let y_scale= (this.height-20)/y_range

        this.app.x_scale = (this.width-this.y_axis_width)/x_range;
        this.app.y_scale = (this.height-20)/y_range;
        this.app.offset[0]=-(this.min_x-x_margin);
        this.app.offset[1]=(this.max_y+y_margin);
        let range =this.app.getRange()
         this.x_axis_scale.domain([range.x_range[0],range.x_range[1]]);
         this.y_axis_scale.domain([-range.y_range[0],-range.y_range[1]]);


    }

    drawAxis(){
        var scale = d3.scaleLinear()
        .domain([this.min_x, this.max_x])
        .range([0, this.width]);
        var axis = d3.axisBottom(scale);
    }

    setSize(x,y){
        if (x){
            this.div.height(y);
            this.div.width(x);
        }
        else{
           y=this.div.height();
           x=this.div.width();
        }
        let th = this.ti.height()
        this.height=y-th;
        this.holder_div.height(this.height);
        this.width=x;
        this.app.setSize(this.width-this.y_axis_width,this.height-20);
        this.axis.attr("width",this.width).attr("height", this.height).styles({top:th+"px"});

        this.x_axis_scale.range([0,this.width-this.y_axis_width]);
        this.y_axis_scale.range([0,this.height-20]);
        this.centerGraph();
        this.app.refresh();
        this.axis.style("top")
        let bp = this.height-20;
        this.x_axis_call.ticks(Math.round((this.width-this.y_axis_width)/40));
        this.x_axis_svg
        .attr("transform", "translate("+this.y_axis_width+","+bp+")")
         .call(this.x_axis_call);
         this.y_axis_call.ticks(Math.round((this.height-20)/25)).tickFormat(function(v,i){
                            if (v>=10000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        
         
                    });;

         this.y_axis_svg
        .attr("transform", "translate("+this.y_axis_width+",0)")
         .call(this.y_axis_call);


       
    }

    _hide(ids){ 
        this.app.hideObjects(ids);
        this.app.refresh();
    }

    _filter(ids){
        this.app.filterObjects(ids);
        this.app.refresh()
    }

    setColor(items){
        for (let id in items){
            if (!items[id]){
                items[id]=this.default_color;
            }
            this.app.setObjectColor(id,items[id]);

        }
    }

}
WGLScatterPlot.count=0;


class MLVScatterPlot extends MLVChart{
    constructor(ndx,params,div_id,title,width,size){
    
        super(ndx,div_id,dc.scatterPlot,title);
        this.x= params[0];
        this.y=params[1];
        let self = this
        this.dim = ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
        
        let y_dim = ndx.dimension(function(d){return d[self.y]});
        this.max_y=y_dim.top(1)[0][self.y];
        this.min_y=y_dim.bottom(1)[0][self.y];
        y_dim.dispose();
        let x_dim = ndx.dimension(function(d){return d[self.x]});
        this.max_x= x_dim.top(1)[0][self.x];
        this.min_x= x_dim.bottom(1)[0][self.x];
        x_dim.dispose();
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10)

        this.chart
            .x(d3.scaleLinear().domain([this.min_x-x_margin,this.max_x+x_margin]))
            .y(d3.scaleLinear().domain([this.min_y-y_margin,this.max_y+y_margin]))
            .yAxisLabel("y")    
            .xAxisLabel("x")
            .clipPadding(10)
            .dimension(this.dim)
            .excludedOpacity(0.5)
            .group(this.group).
            colorAccessor(function (d){
                return "red";
            });
        this.chart.render();
        if (!size){
            size=[300,300];
        }
        this.setSize();   
    }

    setSize(x,y){
        super.setSize(x,y);
        let x_margin=Math.round((this.max_x-this.min_x)/10);
        let y_margin=Math.round((this.max_y-this.min_y)/10)

        this.chart
            .x(d3.scaleLinear().domain([this.min_x-x_margin,this.max_x+x_margin]))
            .y(d3.scaleLinear().domain([this.min_y-y_margin,this.max_y+y_margin]));
        this.chart.redraw();
        
    }
}



class MLVRowChart extends MLVChart{
    constructor(ndx,param,div_id,title,size,cap){
     
        super(ndx,div_id,dc.rowChart,title);
        let self =this;
        this.param=param;
    
        this.dim = ndx.dimension(function(d) {
            if (!d[self.param]){
                return "none"
            }
            return d[self.param];
        });
        this.group=this.dim.group().reduceCount();
        if (!size){
           size=[this.div.width(),this.div.height()];
        }
        this.width=size[0];
        
        this.chart
            .dimension(this.dim)
            .group(this.group)
             .elasticX(true)
               .xAxis().ticks(Math.round(this.width/30)).tickFormat(function(v,i){
                        if (v>=1000){
                        if ((i+1)%2==0){
                            if (v>=100000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        }
                        return v;
                        }
                        else{
                            return v
                        }
                    });;

        if (cap){
            this.chart.cap(5);
        }
        if (this.group.size()===1){
            this.chart.fixedBarHeight(20);
        }
        
        this.chart.margins().right = 10;
        this.chart.render();
        this.setSize();
  
         

    }

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=not_broadcast;

        let filter= this.chart.filters();
          if (filter.length>0){
           this.chart.filter(null);
        }

        this.dim.dispose();
  
    
        this.dim = this.ndx.dimension(function(d) {
            if (!d[self.param]){
                return "none"
            }
            return d[self.param];
        });
        this.group=this.dim.group().reduceCount();
        this.chart
            .dimension(this.dim)
            .group(this.group)
        if (this.group.size()===1){
            this.chart.fixedBarHeight(20);
        }
        if (filter.length>0){
             this.not_broadcast=not_broadcast
           
            this.chart.filter(filter);
        }

      
    }

    setSize(x,y){
        super.setSize(x,y);
        this.chart.xAxis().ticks(Math.round(this.width/30));
        this.chart.redraw()
    }


}

class MLVRingChart extends MLVChart{
    constructor(ndx,param,div_id,title,size,func){
        super(ndx,div_id,dc.pieChart,title);
    
        let self = this;
        this.param=param;
        if (typeof param==="function"){
            this.dim  = ndx.dimension(param);
        }
        else{
            this.dim = ndx.dimension(function(d) {return d[self.param];});
        }
       
        this.group=this.dim.group().reduceCount();
       


        if (!size){
           size=[this.div.width(),this.div.height()];
        }
      
        this.chart
            .dimension(this.dim)
            .group(this.group)
            .render();
        
        this.setSize()
           


    }

    setSize(x,y){
      super.setSize(x,y);
      let d= this.height-15;
      if (this.width <this.height){
           d=this.width
      }
      this.chart.innerRadius(0.1*d);
      this.chart.width(d).height(d);
      this.chart.redraw();         
    }
}

FilterPanel.chart_types={
    "scatter_plot":MLVScatterPlot,
    "bar_chart":MLVBarChart,
    "ring_chart":MLVRingChart,
    "row_chart":MLVRowChart,
    "wgl_scatter_plot":WGLScatterPlot
}

FilterPanel.chart_names={
    "wgl_scatter_plot":"Scatter Plot",
    "bar_chart":"BarChart",
    "ring_chart":"Pie Chart",
    "row_chart":"Row Chart"
}

FilterPanel.count=0;


class AddChartDialog{
    constructor(columns,callback){
        this.columns = columns;
        this.field_to_name={};
        for (let col of columns){
            this.field_to_name[col.field]=col.name
        }
        this.callback=callback;
        this.div = $("<div>").attr("class","add-chart-dialog");
        let self=this;
    
        this.div.dialog({
            autoOpen: true, 
            title:"Add Graph",
            height:200,
            width:380,
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            buttons:[
                
                {
                    text:"Cancel",
                    click:()=>{
                        this.div.dialog("close")
                    }

                },
                {
                    text:"Create",
                    click:()=>{
                        this._createChart();
                        this.div.dialog("close")
                    },
                    id:"create-chart-button"

                }
            ]
        }).dialogFix();
        this._init();
    }

    _init(){
        let self = this;
        $("#create-chart-button").hide();
        let type_div=$("<div>").appendTo(this.div);
        type_div.append("<label>Graph Type:</label>");
        this.chart_select = $("<select>").appendTo(type_div);
        for (let type in FilterPanel.chart_names){
           this.chart_select.append($('<option>', {
	           value: type,
	           text: FilterPanel.chart_names[type]
	       }));   
        }
        let but = $("<button>").attr("class","btn btn-sm btn-secondary").text("next").appendTo(type_div)
                .click(function(e){
                    self._addFields(self.chart_select.val());
                    $(this).hide();
                    self.chart_select.attr("disabled",true);
                });   
    }

    _createChart(){
        let param=""
        if (this.chart_type.endsWith("scatter_plot")){
            param=[this.x_select.val(),this.y_select.val()];
        }
        else{
            param=this.param_select.val()
        }

        this.callback({
            type:this.chart_type,
            param:param,
            label:this.title_input.val()

        });
    }

    _addFields(type){
        let self=this;
        this.chart_type=type;
        let field_div=$("<div>").appendTo(this.div);
        if (type.endsWith("scatter_plot")){
            field_div.append("<label>X axis:</label>");
            this.x_select=$("<select>").appendTo(field_div);
            this._populateFields(this.x_select,"number");
            field_div.append("<br>");
            field_div.append("<label>Y axis:</label>");
            this.y_select=$("<select>").appendTo(field_div);
            this._populateFields(this.y_select,"number");
            
        }
        else{
           field_div.append("<label>Parameter:</label>");
           this.param_select=$("<select>").appendTo(field_div);
           if (type==="ring_chart" || type==="row_chart"){
                this._populateFields(this.param_select,"text");
           }
            else{ 
                this._populateFields(this.param_select,"number");
            }
        }

        let but = $("<button>").text("next").attr("class","btn btn-sm btn-secondary").appendTo(field_div)
            .click(function(e){
                self._addTitle();
                $(this).hide();
            });
    }

    _addTitle(){
        let title_div=$("<div>").appendTo(this.div);
        title_div.append("<label>Title:</title>");
        this.title_input= $("<input>").appendTo(title_div);
        let title="";
        if (this.chart_type.endsWith("scatter_plot")){
            title= this.field_to_name[this.x_select.val()];
            title+=" X "+  this.field_to_name[this.y_select.val()];
        }
        else{
            title= this.field_to_name[this.param_select.val()];
        }
        this.title_input.val(title);
        $("#create-chart-button").show();
    }

    _populateFields(select,datatype){    
         for (let column of this.columns){
            let dt = column.datatype;
            if (dt==="integer" || dt==="double"){
                dt="number"
            }
            if (dt!==datatype){
                continue;
            }
            select.append($('<option>', {
	           value: column.field,
	           text: column.name
	       }));   
        }   
    }
}


class MLVChartDialog{
    constructor(graph){
       this.graph =graph;
       this.div = $("<div>").attr("class","civ-chart-dialog");
    
        this.div.dialog({
            autoOpen: true, 
            title:graph.title,
            width:250,
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            buttons:[
                {
                    text:"reset",
                    click:()=>{
                        this.reset();
                    }



                }
            ]
        }).dialogFix();
        this._init();
       
        
    }

    reset(){
        this.slider.slider("option","values",[this.graph.min,this.graph.max]);
        this.slider.data("min").val(this.graph.min);
        this.slider.data("max").val(this.graph.max);
        this.max_check_box.prop("checked",false);
        this.bin_spinner.val(this.graph.default_bin_number);
        this.updateGraph();


    }

    updateGraph(){
        let params={
          min:parseFloat(this.slider.data("min").val()),
          max:parseFloat(this.slider.data("max").val())
        }
        if (this.max_check_box.prop("checked")){
            params.max_y=this.max_y_spinner.val();
        }
        else{
            params.max_y=null;
        }
        params.bin_number = this.bin_spinner.val();
        this.graph.setParameters(params);

    }

    _init(){
        let self=this;
        this.div.append("<label>X Range:</label>");
        let slider_div=$("<div>").attr("class","max-min-slider").appendTo(this.div);
       
        this.slider=  $("<div>")
            .slider({
              range: true,
               min: this.graph.min,
               max: this.graph.max,
               step:(this.graph.max-this.graph.min)/50,
               values: [this.graph.display_min,this.graph.display_max],
               slide: function( event, ui ) {
                   let min1 =$(this).data("min");
                 
                   min1.val(ui.values[0]);
                  
                   let max1= $(this).data("max");
                 
                   max1.val(ui.values[1]);
               
                },
                stop:function(event,ui){
                    self.updateGraph();
                }

        });

         let min_input=$("<input>").attr("type","text").on("blur keypress",function(e){
                let t = $(this);
                if (e.type==="keypress" && !(e.which===13)){
                    return;
                }
                let min_max = self.slider.slider("option","values");
                self.slider.slider("option","values",[t.val(),min_max[1]]);
                self.updateGraph();
              
                
          }).val(this.graph.display_min);

          let max_input=$("<input type='text'>").on("blur keypress",function(e){
                let t = $(this);
                if (e.type==="keypress" && !(e.which===13)){
                    return;
                }
                let min_max = self.slider.slider("option","values");
                self.slider.slider("option","values",[min_max[0],t.val()]);
                self.updateGraph();
                 
          }).val(this.graph.display_max);

          slider_div.append(min_input).append(this.slider).append(max_input);
         
          this.slider.data({min:min_input,max:max_input});
       
          this.div.append("<label>Y Scale:</label>");
          let y_div=$("<div>").appendTo(this.div);
          this.max_check_box=$("<input type='checkbox'>").appendTo(y_div).
        
          click(function(e){
            self.updateGraph();
          });
          y_div.append("<span>Fixed</span>&nbsp;&nbsp;<span>Max:</span>");
          if (this.graph.max_y){
              this.max_check_box.prop("checked",true);
          }
          let display_val = this.graph.max_y?this.graph.max_y:100;
          this.max_y_spinner=$("<input>").val(display_val).appendTo(y_div);
          this.max_y_spinner.spinner({
              min:0,
              step:50,
              change:function(e,ui){
                  if (self.max_check_box.prop("checked")){
                      self.updateGraph();
                  }
              },
              stop:function(e,ui){
                   if (self.max_check_box.prop("checked")){
                      self.updateGraph();
                  }

              }
             
          });
          let spinner_div =$("<div>");
          this.div.append("<label>Bin Number:</label>");
          let bin_div=$("<div>").appendTo(this.div);
          this.bin_spinner= $("<input>").val(this.graph.bin_number).appendTo(bin_div);
            
          this.bin_spinner.spinner({
              min:1,
              step:1,
              change:function(e,ui){
                      self.updateGraph();
              },
              stop:function(e,ui){
                      self.updateGraph();
              }
             
          });
        

    }

 
}


export {MLVRingChart,MLVScatterPlot,MLVBarChart,MLVChart,FilterPanel,AddChartDialog};


