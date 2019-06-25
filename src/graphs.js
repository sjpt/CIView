import {d3} from "./vendor/d3.js";
import {dc} from "./vendor/dc.js";
import {crossfilter} from "./vendor/crossfilter/crossfilter.js";
import {WGL2DI} from "./webgl/wgl2di.js";
import "./vendor/gridstack.js";




class FilterPanel{
      /**
     * Creates a filter panel
     * @param {string } div - The id of the div element to house the panel or the jquery element
     * @param {object[]} data - The actual data, consisting  of an array of objects containg key/values
     * @param {object} config -Can have the following keys:-
     * <ul>
     * <li> menu_bar - if true a menu will be added </li>
     * <li> graphs - a list of graph configs to be added to the panel</li>
     * <ul>
     * 
     */
    constructor(div,data,config){
        let self=this;
        this.columns=[];
        let holder=null;
        if (!config){
        	config={};
        }
        if (typeof div === "string"){
        	div=$("#"+div)
        }
        if (config.menu_bar){
        	let container = div;
        	this.menu_div=$("<div>").attr("class","civ-menu-bar").appendTo(container);
        	holder = $("<div>").attr("class","civ-main-panel").appendTo(container);
        	this._setUpMenu();
        }
        else{
        	holder=div;
        }
        //create the gridstack
        holder.addClass("civ-filter-panel");
        this.div=$("<div>").appendTo(holder);
        this.div.addClass("grid-stack");
        this.div.on('mousewheel DOMMouseScroll', function (e) { return false; });
        this.div.gridstack(
            {
                width:12,
                verticalMargin:10,
                cellHeight:40,
                minWidth:600,
                draggable: {
                    handle: '.mlv-chart-label',
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
        this.listeners = {};
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
        this.filtered_items_length=0;

        if (config.graphs){
        	for (let graph of config.graphs){
        		this.addChart(graph.type,graph.state,null,graph.id,graph.location);
        	}
        }
        this.config=config;

    }

    _setUpMenu(){
    	let self =this;
    	$("<button>").html("<i class= 'fas fa-chart-bar'></i>Add Chart").attr("class","btn btn-sm btn-secondary")
    		.click(function(e){
    			new AddChartDialog(self.columns,function(data){
    				self.addChart(data.type,data.param,data.label,null,{x:0,y:0,height:3,width:3},data.config
    				);
    			},self.config)
    		}).appendTo(this.menu_div);
    	$("<button>").html("<i class= 'fas fa-sync-alt'></i>Reset All").attr("class","btn btn-sm btn-secondary")
    		.click(function(e){
    			self.resetAll();
    		}).appendTo(this.menu_div);
    }
    

    /**
    * Reizes all graphs depending on the size of the parent div 
    * Automatically called by a  window resize event, but should be 
    * called explicity if the parent div changes size
    */
    resize(){
       for (let name in this.charts){
           this.charts[name].setSize();
       } 
    }

    /**
    * Sets the columns that the filter panel will use e.g for
    * coloring graphs
    * @param {(Object|Object[])} - Either an object with keys as id and 
    * values of column objects or a list of column objects. column objects
    * consist of field,name and datatype (text,integer or double)
    */    

    setColumns(columns){
    	this.columns=[];
    	if (typeof columns === 'object'){
        	for (let col in columns){
            	this.columns.push(columns[col]);
        	}
    	}
    	else{
    		for (let col of columns){
    			this.columns.push(col);
    		}
    	}
    	this.columns.sort(function(a,b){
        	return a.name.localeCompare(b.name);
        });
    }

    getColumns(){
    	return this.columns;
    }


    setBaseImageUrl(url,loading_image){
    	this.base_image_url=url;
    	this.loading_image=loading_image;
    }

    setConfigAttribute(attr,value){
    	this.config[attr]=value;
    }

    dataChanged(field,not_broadcast){
        let chart = this.param_to_graph[field];
        if (chart){
            chart.dataChanged(not_broadcast);
            chart.chart.redraw()
        }
    }

    addMenuIcon(icon){
    	this.menu_div.append(icon);
    }


    addRecords(records){
        this.ndx.add(records);
    }


    /**
    * Creates (or alters) a custom filter
    * @param {string} id - The id of filter. If the filter exists, it will be replaced
    * @param {string} param - The parameter to filter on
    * @param {function} filter - The filter function
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
    	this._chartFiltered(dim.getIds(),null,not_propagate);
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
    addChart(type,params,label,id,location,config){
        let self = this;
        //html friendly id 
        let div_id = "filter-chart-"+this._getRandomString(6,"A")
        if (!id){
            id=div_id;
        }
        let autoplace=false;
        if (!location){
            location={
                x:0,
                y:0,
                width:6,
                height:3
            }
            autoplace=true;
        }
        
        //create divs and add to the gridstack
        let div=$("<div>").attr("class","grid-stack-item");
        let content = $("<div>").attr({"class":"grid-stack-item-content","id":div_id}).appendTo(div);
        this.gridstack.addWidget(div,location.x,location.y,location.width,location.height,autoplace);
        //create the actual chart
        let chart = new MLVChart.chart_types[type](this.ndx,params,div_id,label,null,config);
        this.charts[id]=chart;
        div.data("chart",chart);
        div.data("id",id);
       
        chart.setUpdateListener(function(filtered_items,name){
            self._chartFiltered(filtered_items,id);
        });

        if (typeof(chart.param)=="function"){

        }
        else if  (typeof(chart.param) !=="string"){
            for (let param of chart.param){
                this.param_to_graph[param]=chart;
            }
        }
        else{
            this.param_to_graph[chart.param]=chart;
        }

       if (type==="wgl_scatter_plot" || type==="wgl_image_scatter_plot"){
            let func = function(d){
                chart.colorByField(d.field,d.scale,d.field_info);
            }
           let color_by=  $("<i class='fas fa-palette'></i>").css({"margin-left":"auto","margin-right":"3px"})
               .click(()=>{
                        new ColorByDialog(this.columns,this.ndx.getOriginalData(),chart.graph_id,func,"all",
                        					chart.color_by)
                });
            chart.addMenuIcon(color_by)
        }

      if ( type==="bar_chart"){
            let func = function(d){
            	  let param={
            	  	color_by:{
						field:d.field,
        				colors:d.scale.value_to_color,
        				field_info:d.field_info,
        				scale_name:d.scale.scale_name
            	  	}
            	  }
            	  chart.setParameters(param);
        	}
                

           let color_by=  $("<i class='fas fa-palette'></i>").css({"margin-left":"auto","margin-right":"3px"})
               .click(()=>{
               			let d = chart.div.parent();
               			let id = chart.div.attr("id")+"-parent";
               			d.attr("id",id);
                        new ColorByDialog(this.columns,this.ndx.getOriginalData(),id,func,"text",chart.color_by)
                });
            chart.addMenuIcon(color_by)
        }

        let remove = $("<i class='fas fa-trash'></i>").css({"margin-left":"auto","margin-right":"3px"})
            .click(()=>{
                this.removeChart(id);
            });
        chart.addMenuIcon(remove);


        //Add exisiting filter to chart
        if (this.filtered_ids && (this.filtered_items_length !== this.ndx.getOriginalData().length)){
            if (chart._hide){
                chart._hide(this.filtered_ids);
            }
        }
        return id;
    }

    /**
    * Removes a chart from a panel. All filters will be removed from 
    * the chart and the panel updated accordingly
    * @param {integer} id - The id of the graph to remove
    * @returns{boolean} true if the chart was successfully removed, otherwise false
    */
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
        return true;
    }

	/**
    * Clears filters from all the graphs in the panel 
    */
    resetAll(){
    	this.ignore_filter=true;
    	for (let name in this.charts){
    		let chart = this.charts[name];
    		if (chart.removeFilter){
    			chart.removeFilter();
    		}	
    	}
    	dc.filterAll();
    	this.ignore_filter=false;
    	this.filterChanged();
    }

    setChartField(chart_id,field){
        this.charts[chart_id].setField(field)
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
            let items = chart.dim.getIds();
            this._chartFiltered(items);
        }
    }
 

    _chartFiltered(info,chart_exclude,not_propogate){
    	if (this.ignore_filter){
    		return;
    	}
    	
        for (let name in this.charts){
            let chart = this.charts[name];
            if (chart._hide){
                if (name == chart_exclude){
                    chart._filter(info.items);

                }
                else{
                    chart._hide(info.items);
                }
            }
         }
         if (!not_propogate){
         	for (let id in this.listeners){
         		this.listeners[id](info.items,info.count);
         	}
           
         }
    }


	/**
    * Adds a listener to the panel which will be called when data is filtered
    * @param {funcion} func - the callback will receive an object coctaining ids to the item 
    * and a count of the total number of filterd items
    * @returns{string} The id of the listener
    */
    addListener(func,id){
    	if (! id){
    		id  = this._getRandomString(id);
    	}
        this.listeners[id]=func;
        return id;
    }

    removeListener(id){
    	delete this.listeners[id];
    }

    refresh(){    
        //dc.renderAll();
        this.resize();
    }

    getState(){
    	let all_graphs=[];
    	for (let node of this.gridstack.grid.nodes){
    		let location = {
    			x:node.x,
    			y:node.y,
    			height:node.height,
    			width:node.width
    		}
    		let chart = node.el.data("chart");
    		let id= node.el.data("id");
    		let type = chart.type;
    		let state = chart.getState();
    		all_graphs.push({
    			state:state,
    			location:location,
    			type:type,
    			id:id
    		})

    	}
    	return all_graphs;
    }


    getFilters(){
    	let filters=[];
    	for (let name in this.charts){
    		let fi = this.charts[name].getFilter();
    		console.log(fi);
    		for (let f of fi){
    			filters.push(f);
    		}
    		
    	}
    	return filters;
    }

    _getRandomString(len,an){
    	an = an&&an.toLowerCase();
    	let str="", i=0, min=an=="a"?10:0, max=an=="n"?10:62;
   	 	for(;i++<len;){
      		let r = Math.random()*(max-min)+min <<0;
      		str += String.fromCharCode(r+=r>9?r<36?55:61:48);
    	}
    	return str;
    }
}

/**
 * This callback is displayed as part of the Requester class.
 * @callback FilterPanel~dataFiltered
 * @param {Object[]} filtered_items - The remaining items after filtering
 * @param {Object} filtered_ids - An object containing all the filtered items ids (with a 
 * a value of true)
 */



//*************************Individual Charts***********************************************

class MLVChart{
      /**
     * Creates a chart
     * @param {crossfilter} ndx - The crossfilter instance that the graph will use
     * @param {string} div_id - The id of the div element to house the graph
     * @param {string} title - The title that will be displayed on the graph
     * @param {Object} title - The title that will be displayed on the graph
     */
    constructor(ndx,div_id,title,config){
        if (!config){
            config={allow_settings:true};
        }
        else{
        	config.allow_settings=true;
        }
        this.config=config;
        let self=this;
        this.ndx=ndx;
        this.div=$("#"+div_id).css({"display":"inline-block"});
        this.ti=$("<div>").text(title).appendTo(this.div).css({"display":"flex","white-space":"nowrap"})
            .attr("class","mlv-chart-label")
            .on("mouseover",function(e){
                $(this).find('.mlv-chart-option-menu').show();
                if (!MLVChart.dialogs[self.type]){
                    $(this).find(".fa-cog").hide();
                }
            })
            .on("mouseout",function(e){
                $(this).find('.mlv-chart-option-menu').hide();
            });
 
        this.title=title;
 
        this.reset_but = $("<button>").text("reset")
            .attr("class","pull-right reset btn btn-sm btn-primary mlv-reset-btn")
            .css({"visibility":"hidden"})
            .appendTo(this.ti);

        let options_menu = $("<div>").attr({"class":"mlv-chart-option-menu"})
            .appendTo(this.ti);
        if (config.allow_settings){
            let cog = $("<i class='fas fa-cog'></i>").css({"margin-left":"auto","margin-right":"3px"})
                .appendTo(options_menu)
                .click(()=>{
                    this.showChartDialog();
                });
        }
        this.updateListener=function(){};
    }

    /**
    * Adds an icon to the chart
    * @param {jquery element} icon - A jquery element with the appropraite click handler
    */
    addMenuIcon(icon){
        this.ti.find(".mlv-chart-option-menu").append(icon);

    }

    setUpdateListener(func){
        this.updateListener=func;
    }
    
    showChartDialog(){
        let dialog = MLVChart.dialogs[this.type];
        if (dialog){
            new dialog(this);
        }
    }

    getFilter(){
    	return [];
    }

    dataChanged(){

    }

}

class MLVDCChart extends MLVChart{
        constructor(ndx,div_id,chart_type,title,config){
            super(ndx,div_id,title,config);
            let self=this;
            this.chart=chart_type("#"+div_id);
            this.chart.on("filtered",function(){
                if (self.not_broadcast){
                    self.not_broadcast=false;
                }
                else{
                    self.updateListener(self.dim.getIds());
                }
            });       
            this.chart.controlsUseVisibility(true);
            this.reset_but.click(function(e){
                self.chart.filterAll();
                dc.redrawAll();
            });
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


     /** Removes the chart from the dom, clearing any filters
    * The updated items are returned
    * 
    */
    remove(){   
        this.dim.filter(null);
        let left = this.dim.getIds();
        this.dim.dispose();
        this.chart.resetSvg();
        this.div.remove();
        return left;
    }




    dataChanged(){

    }
}


class MLVBarChart extends MLVDCChart{
    constructor(ndx,param,div_id,title,size,config){
    	let state=null;
    	if (typeof param === "object"){
        	state=param;
        	param=state.param;
        	title=state.title
        }
    
        super(ndx,div_id,dc.barChart,title,config);
       
        this.type="bar_chart";
        let self =this;
        this.div.addClass("div-bar_chart");
          
        this.default_bin_number=10;
        this.param=param;
       
        //work out 
        this.dim = ndx.dimension(
            function(d){return d[self.param];}
        );

        let min_max= findMinMax(this.ndx.getOriginalData(),param)
        this.max = min_max[1];
        this.min= min_max[0];
        if (!size){
            size=[300,200];
        }
        if (state){
        	if (state.params.color_by){
        		//add  legend
        		let items=[];
        		for (let item in state.params.color_by.colors){
        			items.push({text:item,color:state.params.color_by.colors[item]});
        		}
        		let d = this.div.parent();
               	let id = this.div.attr("id")+"-parent";
                d.attr("id",id);
                new MLVColorLegend(id,items,state.params.color_by.field_info.name)
        	}
        	this.setParameters(state.params)
        }
        else{
        	this.setParameters({max:this.max,min:this.min,bin_number:this.default_bin_number});
        }
        this.setSize();
    }

    _addField(param){
       

    }

    setFilter(a,b){
        this.chart.filter(null);
       setTimeout(()=>{
            this.chart.filter(dc.filters.RangedFilter(a,b));
             dc.redrawAll();
     },50);
       //dc.redrawAll();
    }

    setSize(x,y){
        super.setSize(x,y);
         this.chart.x(d3.scaleLinear().domain([this.display_min-this.bin_width,this.display_max+this.bin_width]))
         .xAxis().ticks(Math.round(this.width/30));
         this.chart.yAxis().ticks(Math.round(this.height/25));
         this.chart.redraw();
    }

    setField(new_field){
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


    getState(){
		return{
			params:{
				max:this.display_max,
				min:this.display_min,
				bin_number:this.bin_number,
				max_y:this.max_y,
				color_by:this.color_by
			}
			,
			title:this.title,
			param:this.param
		}

    }

    getFilter(){
    	let filters = this.chart.filters();
    	if (filters.length===0){
    		return [];
    	}
    	return [{field:this.param,operand:"between",value:[filters[0][0],filters[0][1]]}];
    }

   

    setParameters(params,reset_range){
        let self=this;
        if (!params){
          this.display_max=this.max;
          this.display_min=this.min;
          this.bin_number=this.default_bin_number;
          this.max_y=null;
          this.color_by=null;

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
            if (params.color_by){
            	this.color_by=params.color_by;
            }
            
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

        })
        if (this.color_by){
        	this.group.reduce(
        	function(p,v,nf){
        		let val = v[self.color_by.field];
        		if (!self.color_by.colors[val]){
        			val="Other"
        		}
				let num = p[val];
				if (!num){
					p[val]=1
				}
				else{
					p[val]++
				}
				return p;
        	},
        	function(p,v,nf){
        		let val = v[self.color_by.field];
        		if (!self.color_by.colors[val]){
        			val="Other"
        		}
				let num = p[val];
				if (num){
					p[val]--;
				}
				
				return p;
        	},
        	function(){
        		return {};
        	});
        	
        }
        this.chart.dimension(this.dim)
                   .xUnits(dc.units.fp.precision(this.bin_width))
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

        if (this.color_by){
        	this.categories=[];
        	let cols=[]
        	for (let cat in this.color_by.colors){
        		this.categories.push(cat);
        		cols.push(this.color_by.colors[cat])

        	}
        	this.categories.push("Other")
        	cols.push("rgb(160, 160, 160)")
        	this.chart.ordinalColors(cols);
        	this.chart.group(this.group,this.categories[0],function(d){
            	return d.value[self.categories[0]];
            });
      
        }
        else{
        	this.chart.group(this.group);
        }             
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
        if (this.color_by){
        	for (let i=1;i<this.categories.length;i++){
        		this.chart.stack(this.group,this.categories[i],this._getColorFunction(i));
        	}
        }
        this.chart.render();
       
         
    }

    _getColorFunction(i){
    	let self=this;
    	return function(d){
    		return d.value[self.categories[i]];
    	}
    }
}


class WGLScatterPlot extends MLVChart{
    constructor(ndx,params,div_id,title,size,config){
    	let state=null;
    	if (!Array.isArray(params)){
    		title=params.title;
    		state=params;
    		params=[state.x,state.y]
    		config=state.config;

    	}

        super(ndx,div_id,title,config);
        this.param=params;

        let self = this;
        this.reset_but.click(function(e){
                 self.app.clearBrush();
                 self._createFilter(null);
                 self.reset_but.css("visibility","hidden");
             }).appendTo(this.ti);
        
        this.default_color=[31, 119, 180];      
        this.y_axis_width=40;  
        this.x= params[0];
        this.y=params[1];
        this.dim = ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        });
        this.group=this.dim.group();
        let holder_id= "wg-graph-holder"+WGLScatterPlot.count++;
        this.holder_div=$("<div>").attr("id",holder_id).appendTo(this.div);
        let id = "wg-graph-"+WGLScatterPlot.count;
        this.graph_id=id;
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
        this.app = new WGL2DI(id,this.div.width(),this.div.height(),{default_brush:true});

        this.app.addHandler("zoom_stopped",function(data){
            self._updateScale(data);
          
        });

        this.app.addHandler("panning_stopped",function(data){
            self._updateScale(data);
          
        });

        this.app.addHandler("brush_stopped",function(range){
		    self.reset_but.css("visibility","visible");
		    range.y_max=-range.y_max;
		    range.y_min=-range.y_min;
		    self._createFilter(range);
		});

        this.init(state);
		   
    }

    getFilter(){
    	let filters=[];
    	if (!this.range){
    		return filters;
    	}
    	filters.push({field:param[0],operand:"between",value:[range.x_min,range.x_max]});
    	filters.push({field:param[1],operand:"between",value:[range.y_min,tange.y_max]});
    	return filters;
    }

  

    getState(){
    	return {
    		radius:this.radius,
    		x:this.x,
    		y:this.y,
    		color_by:this.color_by,
    		title:this.title,
    		config:this.config
    	}
    }


    _setColorFromState(state){
    	if (state.color_by){
    		let c= state.color_by
    		let sname = c.scale_name;
    		let scales = c.field_info.datatype==="text"?FilterPanel.cat_color_schemes:FilterPanel.color_schemes;
    		let sc = FilterPanel.getColorScale({field:c.field,name:c.field_info.name,
    								datatype:c.field_info.datatype},
    								this.ndx.getOriginalData(),
    								this.graph_id,
    								scales[sname],sname);
    		this.colorByField(c.field,sc,c.field_info);

    	} 
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

    init(state){
        let self=this;
        let data = this.ndx.getOriginalData();
        let min_max = findMinMax(data,this.y)
        this.max_y=min_max[1]
        this.min_y=min_max[0];
       
        min_max = findMinMax(data,this.x)
        this.max_x= min_max[1];
        this.min_x= min_max[0];
       
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
        this.radius = (fudge/50)*2;
        this.default_radius=this.radius;
        if (state){
        	this.radius=state.radius;
        }
        this.addItems(state);
        

       
       
    }

    afterInit(state){

        this.setSize();
	
		this.centerGraph();

		
		if (state && state.color_by){
			this._setColorFromState(state);
		}

    }

    addItems(state){
    	this.type="wgl_scatter_plot";
    	let data = this.ndx.getOriginalData();
    	for (let item of data){
			this.app.addCircle([item[this.x],-(item[this.y])],this.radius,this.default_color,item.id);
		}
		this.app.setUniversalCircleRadius(this.radius);
		this.afterInit(state);

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
        let left  = this.dim.getIds();
        this.dim.dispose();
        this.div.remove();
        return left;
    }

    removeFilter(){
        this.dim.filter(null);
        this.app.clearBrush();
        this.reset_but.css("visibility","hidden");
    }
    
    _createFilter(range){
    	this.range_range;
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
        this.updateListener(this.dim.getIds(),name);
    }

    centerGraph(){
        let x_margin=Math.round((this.max_x-this.min_x)/20);
        let y_margin=Math.round((this.max_y-this.min_y)/20);
        let x_range = (this.max_x-this.min_x)+2*x_margin;
        let y_range= (this.max_y-this.min_y)+2*y_margin;

        let x_scale= (this.width-this.y_axis_width)/x_range;
        let y_scale= (this.height-20)/y_range

        this.app.x_scale = this.default_x_scale=(this.width-this.y_axis_width)/x_range;
        this.app.y_scale = this.default_y_scale=(this.height-20)/y_range;
        this.app.offset[0]=-(this.min_x-x_margin);
        this.app.offset[1]=(this.max_y+y_margin);
        this.app.maintainImageDimensions();
        let range =this.app.getRange()
        this.x_axis_scale.domain([range.x_range[0],range.x_range[1]]);
        this.y_axis_scale.domain([-range.y_range[0],-range.y_range[1]]);
        this.app.refresh();
        this._updateScale(this.app.getRange());
        this.app._getObjectsInView();


    }

    drawAxis(){
        var scale = d3.scaleLinear()
        .domain([this.min_x, this.max_x])
        .range([0, this.width]);
        var axis = d3.axisBottom(scale);
    }


    setScale(x,y){
    	if (x){
    		this.app.x_scale=x;
    	}
    	if (y){
    		this.app.y_scale=y;
    	}
    	this.app.maintainImageDimensions();
    	this.app.refresh();
    	this._updateScale(this.app.getRange());     
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
        if (!x || !y || this.is_loading){
            return;
        }
        let th = this.ti.height()
        this.height=y-th;
        this.holder_div.height(this.height);
        this.width=x;
        this.app.setSize(this.width-this.y_axis_width,this.height-20);
        this.axis.attr("width",this.width).attr("height", this.height).styles({top:th+"px"});

        this.x_axis_scale.range([0,this.width-this.y_axis_width]);
        this.y_axis_scale.range([0,this.height-20]);
        let x_margin=Math.round((this.max_x-this.min_x)/20);
        let y_margin=Math.round((this.max_y-this.min_y)/20);
      
   
        //this.centerGraph();
     
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
            //this.app.refresh();  
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

    colorByField(field,color_scale,field_info){
    	this.color_by={
    		field:field,
    		scale_name:color_scale.scale_name,
    		field_info:field_info
    	}
        let data =this.ndx.getOriginalData();
        for (let item of data){
            let color = this.convertToRGB(color_scale(item[field]));
            this.app.setObjectColor(item.id,color)
        }
        this.app.refresh();
    }

    linspace(start, end, n) {
        var out = [];
        var delta = (end - start) / (n - 1);

        var i = 0;
        while(i < (n - 1)) {
            out.push(start + (i * delta));
            i++;
        }

        out.push(end);
        return out;
    }

    convertToRGB(rgb){
		rgb=rgb.substring(4,rgb.length-1);
		return rgb.split(", ");
	}

    setPointRadius(val){
        this.radius=val;
        this.app.setUniversalCircleRadius(val);
        this.app.refresh(true);
    }

}


WGLScatterPlot.count=0;


class WGLImageScatterPlot extends WGLScatterPlot{
	constructor(ndx,params,div_id,title,size,config){
		super(ndx,params,div_id,title,size,config);
	}

	
	addItems(state){
    	this.type="wgl_image_scatter_plot";
    	let data = this.ndx.getOriginalData();
    	
    	let nodes=[];
    	let node_dict={}
    	for (let item of data){
    		nodes.push({x:item[this.x],y:-item[this.y],id:item.id,rad:Math.sqrt((item[this.x]*item[this.x])+(item[this.y]*item[this.y]))})
    		node_dict[item.id]=item;
    	}

   

    
		let loading_div= $("<i>")
			.css({position:"absolute",top:"50%",left:"50%","font-size":"24px"})
			.attr("class","fa fa-spinner fa-spin")
			.appendTo(this.div);
		this.is_loading=true;
		let self=this;
		//this._loadStuff(nodes,loading_div,state);

		let simulation = d3.forceSimulation(nodes)
			.force("collide", d3.forceCollide(this.radius/2).iterations(5).strength(0.9))
			.force("x",d3.forceX(function(d){
				return node_dict[d.id][self.x];
			}).strength(0.2))
			.force("y",d3.forceY(function(d){
				return -node_dict[d.id][self.y];
			}).strength(0.2));
			//.force("repel",d3.forceManyBody().strength(-2).distanceMax(this.radius))
			//.force("r",d3.forceRadial(function(d){return d.rad}));



			;
		let tick=0;
	
		simulation.on("tick",function(){
			tick++;
		console.log(tick);
		if (tick>50){
				simulation.stop();
				self._loadStuff(nodes,loading_div,state);
				
			}
		});

    }

    _loadStuff(data,loading_div,state){
    	let self =this;
    	let total= this.config.rows*this.config.cols;
    	let positions = [];
    	for (let item of data){
    	
    		let sheet= Math.floor((item.id-1)/total)
    		let abs_num = (item.id%total)-1;
    		let row = Math.floor(abs_num/this.config.cols);
    		let col = abs_num%this.config.cols;
    		positions.push({x:item.x,y:item.y,key:item.id,col:col,row:row,sheet:sheet})	

		}
		this.app.addImageTile(this.config.sheets,{
			sprite_dim:[this.config.cols,this.config.rows],
			image_height:this.radius,
			image_width:this.radius
		},positions,function(){
			loading_div.remove();
			self.is_loading=false
			self.afterInit(state);
		});
		this.radius=1;
		this.default_radius=1


    }
    _hide(ids){ 
        this.app.hideObjects(ids,5);
        this.app.refresh();
    }

    _filter(ids){
        this.app.filterObjects(ids,5);
        this.app.refresh()
    }

    setPointRadius(val){
        this.radius=val;
        this.app.resizeImage(val);
        this.app.refresh(true);
    }
}


class MLVScatterPlot extends MLVDCChart{
    constructor(ndx,params,div_id,title,width,size){
        super(ndx,div_id,dc.scatterPlot,title);
        this.type="scatter_plot";
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



class MLVRowChart extends MLVDCChart{
    constructor(ndx,param,div_id,title,size,config){
    	let state=null;
    	if (!config){
    		config={};
    	}
    	
    	if (typeof param === "object"){
			state=param;
			title=state.title;
			param=state.param;
			config.cap=state.cap;
    	}   
        super(ndx,div_id,dc.rowChart,title);
        this.config=config
        this.type="row_chart";
        let self =this;
        this.param=param;
        if (typeof param==="function"){
            this.dim  = this.ndx.dimension(param);
        }
        else{   
        	this.dim = ndx.dimension(function(d) {
            	if (!d[self.param]){
                	return ["none"];
            	}
            	return d[self.param].split(",");
        	},true);
        }
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
                        return "";
                        }
                        else{
                            return v
                        }
                    });;

        if (config.cap){
            this.chart.cap(config.cap);
        }
        else{
        	config.cap=8
        	this.chart.cap(8);
        }
        if (this.group.size()===1){
            this.chart.fixedBarHeight(20);
        }
        
        this.chart.margins().right = 10;
        this.chart.render();
        this.setSize();
  
         

    }

    getState(){
    	return {
    		param:this.param,
    		title:this.title,
    		cap:this.config.cap
    	}
    }

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=not_broadcast;

        let filter= this.chart.filters();
          if (filter.length>0){
           this.chart.filter(null);
        }

        this.dim.dispose();

        if (typeof param==="function"){
            this.dim  = this.ndx.dimension(param);
        }
        else{
            this.dim = this.ndx.dimension(function(d) {
                if (!d[self.param]){
                    return "none"
                }
                return d[self.param];
            });
        }
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
        this.chart.xAxis().ticks(Math.round(this.width/30)).tickFormat(function(v,i){
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
        this.chart.redraw()
    }

    getFilter(){
    	let fs = this.chart.filters();
    	let filters=[];
    	if (fs.length===0){
    		return filters;
    	}
    	filters.push({field:this.param,value:fs,operand:"="})
    }


}

class MLVRingChart extends MLVDCChart{
    constructor(ndx,param,div_id,title,size,func){
    	let state=null
    	if (typeof param === "object"){
			state=param;
			title=state.title;
			param=state.param;
    	}
        super(ndx,div_id,dc.pieChart,title);
        this.type="ring_chart";
        let self = this;
        this.setField(param)
       
        if (!size){
           size=[this.div.width(),this.div.height()];
        }
      
       /* this.chart
            .dimension(this.dim)
            .group(this.group)
            .render();
        */
        this.setSize()
           


    }

    getState(){
    	return {
    		param:this.param,
    		title:this.title
    	}
    }

    setField(param){
        let self=this;    
        if (this.dim){
            //get rid of any filters
            this.chart.filterAll();
            this.dim.dispose();
        }
        this.param=param;
        if (typeof param==="function"){
            this.dim  = this.ndx.dimension(param,true);
        }
        else{
            this.dim = this.ndx.dimension(function(d){
            	let v= d[self.param];
            	if (!v){
            		return "None"
            	}
            	return v;
            });
        }
       
        this.group=this.dim.group()//.reduceCount();
         this.chart
            .dimension(this.dim)
            .group(this.group)
            .cap(8)
            .render();
    }

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=not_broadcast;

        let filter= this.chart.filters();
          if (filter.length>0){
           this.chart.filter(null);
        }

        this.dim.dispose();

        if (typeof this.param==="function"){
            this.dim  = this.ndx.dimension(this.param);
        }
        else{
            this.dim = this.ndx.dimension(function(d) {
                if (!d[self.param]){
                    return "none"
                }
                return d[self.param];
            });
        }
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
      let d= this.height-15;
      if (this.width <this.height){
           d=this.width
      }
      this.chart.innerRadius(0.1*d);
      this.chart.width(d).height(d);
      this.chart.redraw();         
    }

    getFilter(){
    	let fs = this.chart.filters();
    	let filters=[];
    	if (fs.length===0){
    		return filters;
    	}
    	filters.push({field:this.param,value:fs,operand:"="});
    	return filters;
    }
}

MLVChart.chart_types={
    "scatter_plot":MLVScatterPlot,
    "bar_chart":MLVBarChart,
    "ring_chart":MLVRingChart,
    "row_chart":MLVRowChart,
    "wgl_scatter_plot":WGLScatterPlot,
    "wgl_image_scatter_plot":WGLImageScatterPlot
}

FilterPanel.chart_names={
    "wgl_scatter_plot":"Scatter Plot",
    "bar_chart":"BarChart",
    "ring_chart":"Pie Chart",
    "row_chart":"Row Chart",
    "wgl_image_scatter_plot":"Image Scatter Plot"
}



class BaseFieldDialog{
     constructor(columns,callback,title,size,action_button_text,config){
        this.columns = columns;
        this.config=config;
        this.field_to_column={};
        for (let col of columns){
            this.field_to_column[col.field]=col;
        }
        this.callback=callback;
        this.div = $("<div>").attr("class","civ-field-dialog");
        let buttons=[{
            text:"Cancel",
            click:()=>{
                this.div.dialog("close")
            }
            },
            {
                text:action_button_text,
                click:()=>{
                    this.doAction();
                    //this.div.dialog("close")
                },
                id:"do-action-button"
           }];
    
        this.div.dialog({
            autoOpen: true, 
            title:title,
            height:size[1],
            width:size[0],
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            buttons:buttons
        }).dialogFix();
        this._init();
    }
    _populateFields(select,datatype){    
         for (let column of this.columns){
            let dt = column.datatype;
            if (dt==="integer" || dt==="double"){
                dt="number"
            }
            if (dt!==datatype && datatype!="all"){
                continue;
            }
            select.append($('<option>', {
	           value: column.field,
	           text: column.name
	       }));   
        }   
    }
   
}


class AddChartDialog extends BaseFieldDialog{
   
    constructor(columns,callback,config){
     
        super(columns,callback,"Add Chart",[250,300],"Add Chart",config);
       
             
    }

    _init(){
        let self = this;


        $("#do-action-button").hide();
        let type_div=$("<div>").appendTo(this.div);
        type_div.append("<label>Graph Type:</label>");
        this.chart_select = $("<select>").appendTo(type_div);
        for (let type in FilterPanel.chart_names){
        	if (type.includes("image") && !(this.config.images)){
        		continue;
        	}
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

    doAction(){
        let param="";
        let config=this.config
    
        if (this.chart_type.endsWith("scatter_plot")){
            param=[this.x_select.val(),this.y_select.val()];
        }
        else{
            param=this.param_select.val()
        }
        let self = this;
        if (this.chart_type.includes("image")){
        	config=this.config.images;
        }

        setTimeout(function(){

        	self.callback({
            		type:self.chart_type,
            		param:param,
            		label:self.title_input.val(),
            		config:config

        	});
        },20);
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
            title= this.field_to_column[this.x_select.val()].name;
            title+=" X "+  this.field_to_column[this.y_select.val()].name;
        }
        else{
            title= this.field_to_column[this.param_select.val()].name;
        }
        this.title_input.val(title);
        $("#do-action-button").show();
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

}


class MLVBarChartDialog extends MLVChartDialog{
    constructor(graph){
        super(graph);     
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
class WGLScatterPlotDialog extends MLVChartDialog{
    constructor(graph){
        super(graph);
        graph.app._getObjectsInView();  
    }
    _init(){
        let self = this;
        let n= this.graph.default_radius;
        let min=n/100;
        let max=n*10;
        let step = (max-min)/100;
        this.div.append("<label>Point Size:</label>");
        this.slider=  $("<div>")
            .slider({
               min: min,
               max: max,
               step:step,
               value: this.graph.radius,
               slide: function( event, ui ) {
                   let val= ui.value;
                   self.graph.setPointRadius(val);           
                }

        }).appendTo(this.div);
		this.div.append("<label>X axis scale:</label>");
		min = this.graph.default_x_scale/4;
		max=this.graph.default_x_scale*10;
		step = (max-min)/100;
		this.x_slider=  $("<div>")
            .slider({
               min: min,
               max: max,
               step:step,
               value: this.graph.app.x_scale,
               slide: function( event, ui ) {
                   let val= ui.value;
                   self.graph.setScale(val,null);
                      
                }

        }).appendTo(this.div);
        this.div.append("<label>Y axis scale:</label>");
		min = this.graph.default_y_scale/4;
		max=this.graph.default_y_scale*10;
		step = (max-min)/100;
		this.x_slider=  $("<div>")
            .slider({
               min: min,
               max: max,
               step:step,
               value: this.graph.app.y_scale,
               slide: function( event, ui ) {
                   let val= ui.value;
                   self.graph.setScale(null,val);
                      
                }

        }).appendTo(this.div);

        let but = $("<button>").attr({"class":"btn btn-sm btn-secondary"})
            .text("Centre Plot").appendTo(this.div)
            .click(function(e){
                self.graph.centerGraph()
                self.graph.app.refresh();
            });
    }

    reset(){  
        this.graph.centerGraph();
        this.slider.slider("option","value",this.graph.default_radius);
         this.graph.setPointRadius(this.graph.default_radius);
       
       
       
        

         
        
    }
}

MLVChart.dialogs={
    "bar_chart":MLVBarChartDialog,
    "wgl_scatter_plot":WGLScatterPlotDialog,
    "wgl_image_scatter_plot":WGLScatterPlotDialog
}

function findMinMax(data,field){
    let max = Number.MIN_SAFE_INTEGER;
    let min = Number.MAX_SAFE_INTEGER;
    for (let item of data){
        if (item[field]>max){
            max=item[field];
        }
        if (item[field]<min){
            min=item[field]
        }
    }
    return [min,max];
}

function hexToRgb(hex) {
	hex=hex.replace("#","")
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return "rgb(" +r + ", " + g + ", " + b+")";
}

function groupAndOrder(data,field){
	let t_dict={}
	for (let item of data){
		let q= t_dict[item[field]];
		if (!q){
			t_dict[item[field]]=1;
		}
		else{
			t_dict[item[field]]++;
		}
	}
	let arr=[];
	for (let v in t_dict){
		arr.push({"value":v,"count":t_dict[v]})
	}
	arr.sort(function(a,b){
		return b.count-a.count;
	})
	return arr;
}

FilterPanel.color_schemes = {
	'spectral8': ['#3288bd','#66c2a5','#abdda4','#e6f598','#fee08b','#fdae61','#f46d43','#d53e4f'],
    'puOr11': ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'],
    'redBlackGreen': ['#ff0000', '#AA0000', '#550000', '#005500', '#00AA00', '#00ff00']
};


FilterPanel.cat_color_schemes={
	"Scheme 1":d3.schemeSet1.slice(1,9)
}

function linspace(start, end, n) {
    let out = [];
    let delta = (end - start) / (n - 1);
    let i = 0;
    while(i < (n - 1)) {
        out.push(start + (i * delta));
        i++;
    }
    out.push(end);
    return out;
}

/**
* Gets a color scale function and appends a legend to the div specified by the supplied id
* @param {Object} column - The column to color by - should have the following keys field,label and datatype.
* @param {Object []} data - The actual data (as a list of objects) - required to work out categories or min/max values.
* If you want to set your own max/min values , simply pass and array containing just the min and max . e.g if column.field
* was weight pass [{weight:<min_value>},{weight:<max_value}]. Similarly for categorical data just pass a list of the categories.
* e.g if column field was 'color' pass [{color:"blue"},{color:"red"},....]
* @param {string} div_id - The id of the div to attach the color legend to. The color legend will have the id <div-id>-bar
* @param {string []) scale - A list of hex value colors - used to create continous scale for numerical data 
* and a discrete data for text. Default values will be used if none are given
* @returns (function) The color scale function which will return the color as rgb(x , y ,z) for a given value.The function also
* has the following properties -  'scale' (the column name) and in the case of the categorical (text) data 'value_to_color', and
* object of values to their colors. If there were more categories than colors - excess categories will be assigned to other
*/

FilterPanel.getColorScale=function(column,data,div_id,scale){
	if (column.datatype === "text"){
		let other_color = "rgb(220, 220, 220)";
		let values = groupAndOrder(data,column.field);
		let value_to_color={};
		let items=[];
		let n_scale=[];
		for (let c of scale){
			n_scale.push(hexToRgb(c))
		}
		scale=n_scale;
		for (let i=0;i<scale.length;i++){
			if (i===values.length){
				break;
			}
			value_to_color[values[i].value]=scale[i];
			items.push({text:values[i].value,color:scale[i]})
		}
		if (values.length>items.length){
			items.push({text:"Other",color:other_color})
		}

		let color_function=function(v){
			let c= value_to_color[v];
			return c?c:other_color
		}
		color_function.value_to_color=value_to_color;
		color_function.scale_name=column.name;
		$("#"+div_id+"-bar").remove();
		new MLVColorLegend(div_id,items,column.name);
		return color_function;
	}
	else{
		let min_max = findMinMax(data,column.field);
        let color_scale=d3.scaleLinear()
                .domain(linspace(min_max[0],min_max[1],scale.length))
                .range(scale);
      
          let config={
                height:10,
                width:100,
                min:min_max[0],
                max:min_max[1],
                label:column.name
            
            }
        $("#"+div_id+"-bar").remove();
        new MLVScaleBar(div_id,color_scale,config);
        color_scale.scale_name=column.name;
        return color_scale;

	}
        
  

}


class ColorByDialog extends BaseFieldDialog{
	 /**
     * Creates a dialog that enables users to select a field and color scheme
     * @param {object[]} columns - A list of column objects which should have field, name and datatype
     * @param {object[]} data - The actual data, consisting  of an array of objects containg key/values
     * @param {string } div_id - The id of the element to which the color legend will be appended
     * @param {function} callback - The function called after the user selects a field/color scheme. 
     * It should accept an object which contains field, color_function and in the case of text
     * (categorical data) value_to_color
     */
     constructor(columns,data,div_id,callback,limit_datatype,existing_param){
     	let config={
     		limit_datatype:limit_datatype?limit_datatype:"all",
     		existing_param:existing_param
     	}
        super(columns,callback,"Color By",[200,300],"OK",config);
        this.data=data;
        this.div_id=div_id;
     }

     _init(){
        let field_div=$("<div>").appendTo(this.div);
        field_div.append("<label>Field:</label>");
        let self = this;
        this.field_select = $("<select>").appendTo(field_div)
        	.on("change",function(){
        		let col = self.field_to_column[$(this).val()];
        		self._populateSchemeSelect(col.datatype);
        	});
        this._populateFields(this.field_select,this.config.limit_datatype);
        let scheme_div=$("<div>").appendTo(this.div);
        scheme_div.append("<label>Scheme:</label>");
        this.scheme_select = $("<select>").appendTo(scheme_div);
        let field = this.field_select.val();      
        let datatype  = this.field_to_column[field].datatype;
        this._populateSchemeSelect(datatype);
        if (this.config.existing_param){
        	this.field_select.val(this.config.existing_param.field).trigger("change");
        	this.scheme_select.val(this.config.existing_param.scale_name);
        }
        
     }

     _populateSchemeSelect(datatype){
     	this.scheme_select.empty();
     	let schemes=(datatype==="text")?FilterPanel.cat_color_schemes:FilterPanel.color_schemes
    	for (let scheme in schemes){
           this.scheme_select.append($('<option>', {
	           value: scheme,
	           text: scheme
	       }));   
        }
     }

     doAction(){
         let field = this.field_select.val();
         let label= this.field_to_column[field].name;
         let datatype  = this.field_to_column[field].datatype;
         let schemes=(datatype==="text")?FilterPanel.cat_color_schemes:FilterPanel.color_schemes;
         let scale_name = this.scheme_select.val()
         let scale = schemes[scale_name];
         let color_scale= FilterPanel.getColorScale(this.field_to_column[field],this.data,this.div_id,scale,scale_name);
         this.callback({field:field,scale:color_scale,field_info:{name:label,datatype:datatype}});

     }
}

class MLVColorLegend{
	constructor(div_id,items,name){
		this.id=div_id+"-bar";
		
        this.holder=d3.select('#'+div_id).append("svg").attr("id",this.id).style("position","relative");
       
		this.holder.attrs({
			height:((items.length)*13)+16,
			width:120
		}).append("text").text(name)
			.attrs({
				x:"0px",
				y:"0px",
				"alignment-baseline":"hanging"
			})
			.style("font-size","14px");
		let rect= this.holder.selectAll("rect").data(items)
		rect.enter().append("rect")
        .attrs({
        	y:function(d,i) { return (16+(i*12))+"px"},
        	x:"0px",
        	height:"10px",
        	width:"10px"
        })
        .styles({fill:function(d){return d.color}})
        .text(function(d) {return d.text})
    
		let text= this.holder.selectAll(".legend-text").data(items)
		text.enter().append("text")
        .attrs({
        	y:function(d,i) { return (16+(i*12))+"px"},
        	x:"1em",
        	"alignment-baseline":"hanging"
        })
        .styles({
        	"font-size":"12px"
        })
        .text(function(d) {return d.text})

         $("#"+this.id).draggable({
            containment:"parent"
        }).css("float","right");
        this.holder.on("mousedown",function( event ) {
             d3.event.stopPropagation();
        }).style("cursor","move");
     



	}
}

class MLVScaleBar{
    constructor(div_id,color_scale,config){
        this.config=$.extend(config,{},true);
       /* $("#"+div_id).draggable({
            containment:"parent"
        });*/
        this.color_scale=color_scale;
       
        this.id=div_id+"-bar";
        this.holder=d3.select('#'+div_id).append("svg").attr("id",this.id); 
      
        this.svg =this.holder.append('g');

        this.title=this.holder.append("text")
        .text(config.label).attrs({x:10,"alignment-baseline":"hanging"}).style("font-size","12px");
       
        this.svg.attr("transform", "translate(10, 15)");
        this.gradient = this.svg.append('defs')
            .append('linearGradient')
            .attr('id', div_id+'-gradient')
            .attr('x1', '0%') // bottom
            .attr('y1', '0%')
            .attr('x2', '100%') // to top
            .attr('y2', '0%')
            .attr('spreadMethod', 'pad');
           
      

        this.bar =this.svg.append('rect')
                .attr('x1', 0)
                .attr('y1', 0)
                .style('fill', 'url(#'+div_id+'-gradient)');
       
        this.legend_scale = d3.scaleLinear();
             

        this.legend_axis = d3.axisBottom(this.legend_scale)
             .tickFormat(function(v,i){
                if (v>=10000){
                    return Number.parseFloat(v).toPrecision(2);
               }
                return v;
             });
        this.legend=this.svg.append("g")
                .attr("class", "legend axis");
        this.draw();      
        $("#"+this.id).draggable({
            containment:"parent"
        })
        this.holder.on("mousedown",function( event ) {
             d3.event.stopPropagation();
        }).style("cursor","move");

     }

     draw(){
        let scale = this.color_scale.range();

        this.holder.attr('width', this.config.width+20)
            .attr('height', this.config.height+35);

        let pct = this.linspace(0, 100, scale.length).map(function(d) {
            return Math.round(d) + '%';
        });

        let colourPct = d3.zip(pct, scale);
        let self = this

        colourPct.forEach(function(d) {
            self.gradient.append('stop')
            .attr('offset', d[0])
            .attr('stop-color', d[1])
            .attr('stop-opacity', 1);
        });
        this.bar.attr('width', this.config.width)
            .attr('height', this.config.height)
        this.legend_scale.domain([this.config.max, this.config.min])
            .range([this.config.width, 0]);

        this.legend_axis.ticks(Math.round(this.config.width-20)/25)
        
        this.legend.attr("transform", "translate(0, "+this.config.height+")")
            .call(this.legend_axis);

     }

     setSize(width,height){
            this.legend_scale.range([height, 0]);
            this.legend.call(this.legend_axis);
            this.svg.attr('width', width-20)
                .attr('height', height+"px");
            this.holder.attr('width', width)
                .attr('height', height)
            this.bar.attr('width', width-20)
                .attr('height', height);
           
      }

      linspace(start, end, n) {
            let out = [];
            let delta = (end - start) / (n - 1);
            let i = 0;
            while(i < (n - 1)) {
                out.push(start + (i * delta));
                i++;
            }
            out.push(end);
            return out;
        }
}









export {MLVRingChart,MLVScatterPlot,MLVBarChart,MLVChart,FilterPanel,AddChartDialog,ColorByDialog};


