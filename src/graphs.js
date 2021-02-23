import {d3} from "./vendor/d3.js";
import {dc} from "./vendor/dc.js";
import {crossfilter} from "./vendor/crossfilter/crossfilter.js";
import {WGL2DI} from "./webgl/wgl2di.js";
import "./vendor/gridstack.js";



class FilterPanel{
      /**
     * Creates a filter panel
     * @param {string|Object} div - The id of the div element or the jquery element itself that will house the panel or  a list of ids 
     * to elemments
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
        this.id = this._getRandomString(6,"A");
        this.columns=[];
        this.divs={};
        this.gridstacks={};
        this.menu_divs={};
        this.column_index={};
        if (!config){
        	config={};
        }
        let divs={};
        if (Array.isArray(div)){
        	for (let d of div){
                divs[d]=$("#"+d);
        	}
        }
        else if (typeof div === "string"){
        	divs["_default"]=$("#"+div)
        }
        else{
        	divs["_default"]=div;
        }

        for (let d_name in divs){
        	let div = divs[d_name];
        	let holder=null;
        	if (config.menu_bar){
        	    let container = div;
        	    this.menu_divs[d_name]=$("<div>").attr("class","civ-menu-bar").appendTo(container);
        	    holder = $("<div>").attr("class","civ-main-panel").appendTo(container);
        	    if (d_name==="_default"){
        	        this._setUpMenu(d_name);
        	    }
            }
            else{
        	    holder=div;
            }
            holder.addClass("civ-filter-panel");
            this.divs[d_name]=$("<div>").appendTo(holder);
            this.divs[d_name].addClass("grid-stack");
            this.divs[d_name].on('mousewheel DOMMouseScroll', function (e) { return false; });
            this.divs[d_name].gridstack({
                    width:12,
                    verticalMargin:10,
                    cellHeight:40,
                    minWidth:600,
                    draggable: {
                    handle: '.mlv-chart-label',
               }
            })
            this.divs[d_name].on("resizefinished",function(event, ui) {
                let ch= ui.originalElement.data("chart");
                ch.setSize();
            });
            
            this.gridstacks[d_name]=this.divs[d_name].data("gridstack");




        }
       
        
      
       

   
        let count=1;
        for (let item of data){
        	if (item.id === undefined){
        		item.id=count++;
        	}
        }
        this.ndx= crossfilter(data);
        this.filtered_ids;
        this.charts={};
        this.listeners = {};
        this.remove_listeners={};
        this.add_listeners={};
        this.param_to_graph={};
        $(window).on("resize."+this.id,function(e){
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

        if (config.columns){
        	this.setColumns(config.columns)
        }

        if (config.graphs){
        	for (let graph of config.graphs){
        		this.addChart(graph,true);
        	}
        }
        this.config={};
        this.config.exclude_graph_types=config.exclude_graph_types;

    }


	/**
    * Removes all graphs and the window reize handler (which
    * holds a reference to the panel)
    */
    dispose(){
    	$(window).off("rezise."+this.id);
    	for (let d in this.divs){
    		this.divs[d].empty();
    	}
    	
    }

    _setUpMenu(name){
    	let m_div=this.menu_divs[name];
    	let self =this;
    	$("<button>").html("<i class= 'fas fa-chart-bar'></i>Add Chart").attr("class","btn btn-sm btn-secondary")
    		.click(function(e){
    			new AddChartDialog(self.columns,function(config){
    					config.location={x:0,y:0,height:3,width:3};
    					self.addChart(config);
    			},self.config);
    		}).appendTo(m_div);
    	$("<button>").html("<i class= 'fas fa-sync-alt'></i>Reset All").attr("class","btn btn-sm btn-secondary")
    		.click(function(e){
    			self.resetAll();
    		}).appendTo(m_div);
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
    	this.column_index={};
    	if (typeof columns === 'object'){
        	for (let col in columns){
            	this.columns.push(columns[col]);
            	this.column_index[columns[col].field]=columns[col];
        	}
    	}
    	else{
    		for (let col of columns){
    			let c = {field:col.field,name:col.name,datatype:col.datatype};
    			if (c.columnGroup){
    				col.columnGroup=c.columnGroup;
    			}
    			this.columns.push(c);
    			this.column_index[c.field]=c;
    		}
    	}
    	if (columns.length<1){
    		this.columns.sort(function(a,b){
        		return a.name.localeCompare(b.name);
        	});
    	}
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


    removeField(field,not_propagate){
    	for (let ch in this.charts){
    		let chart = this.charts[ch];
    		let p  = chart.config.param;
    		if (typeof p === "string"){
    			if (p===field){
    				this.removeChart(ch,not_propagate)
    				continue;
    			}
    		}
    		else{
    			if (p.indexOf(field) !==-1){
    				this.removeChart(ch,not_propagate);
    				continue;
    			}
    		}
    		if (chart.config.color_by){
    			if (chart.config.color_by.column.field === field){
    				delete chart.config.color_by
    				chart.setColorFromConfig();
    			}
    		}
    	}
    	let index=-1
    	for (let i in this.columns){
			if (this.columns[i].field===field){
				index=i;
				break;
			}
    	}
    	if (index !==-1){
    		this.columns.splice(index,1);
    	}
    }

    dataChanged(field,not_broadcast){
    	let redraw_charts=[];
    	for (let ch in this.charts){
    		let chart = this.charts[ch];
    		let p  = chart.config.param;
    		if (typeof p === "string"){
    			if (p===field){
    				chart.dataChanged(not_broadcast);
    				redraw_charts.push(chart)
    				continue;
    			}
    		}
    		else{
    			if (p.indexOf(field) !==-1){
    				chart.dataChanged(not_broadcast);
    				redraw_charts.push(chart);
    				continue;
    			}
    		}
    		if (chart.config.color_by){
    			if (chart.config.color_by.column.field === field){
    				chart.dataChanged(not_broadcast);
    				redraw_charts.push();
    				continue;
    			}
    		}
    	}
    	for (let chart of redraw_charts){
    		if (chart,chart){
    			chart.chart.redraw();
    		}
    	}
    
    }

    addMenuIcon(icon,div){
    	if (!div){
    		div="_default";
    	}
    	this.menu_divs[div].append(icon);
    }

    highlightDataItem(key){
    	for (let id in this.charts){
    		this.charts[id].highlightDataItem(key);
    	}
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
        let dim = this.custom_filters[id];
		if (!dim){
			return false;
		}
		dim.filter(null)
		dc.redrawAll();
		this._chartFiltered(dim.getIds(),null,not_propagate);
		dim.remove();
		delete this.custom_filters[id];
    }



    /**
    * Adds a chart to the panel
    * @param {Object} config - An object decribing the graph
    * <ul>
    * <li> type - the type of chart bar_chart,row_chart,ring_chart or wgl_scatter_plot </li>
    * <li> param - the field in the data (or fields e.g for scatter plot) to use in the graph</li>
    * <li> title - The name to be displayed on the chart </li>
    * <li> id - The id of the graph. If not supplied a random id will be assigned
    * <li> location - an object containing x,y,width and height (grid co-ordinates). If not supplied
    *      than the chart will be added to the end of the grid with a height and width of 2</li>
    * </ul>
    * Other parameters specific to the chart type are also given in the config
    */
    addChart(config,not_propagate){
    	config=$.extend(true,{},config)
        let self = this;
        //html friendly id 
        let div_id = "filter-chart-"+this._getRandomString(6,"A");
        let id = config.id;
        if (!id){
            id=config.id=div_id;
        }
        let autoplace=false;
        let loc= config.location;
        if (!loc){
            loc={
                x:0,
                y:0,
                width:4,
                height:4
            }
            autoplace=true;
        }
        else{
			delete config.location;       	
        }


        
        //create divs and add to the gridstack
        let div=$("<div>").attr("class","grid-stack-item");
        let content = $("<div>").attr({"class":"grid-stack-item-content","id":div_id}).appendTo(div);
        let d_name =  config.div_name?config.div_name:"_default";
        this.gridstacks[d_name].addWidget(div,loc.x,loc.y,loc.width,loc.height,autoplace);
        
 
		//create the actual chart
        let ch = MLVChart.chart_types[config.type];
        if (!ch){
        	throw (`chart type ${config.type} not recognised`);
        }
        let type = config.type;
        //delete config.type;

       

       
        let chart = new ch["class"](this.ndx,div_id,config,this.columns);
        this.charts[id]=chart;
        div.data("chart",chart);
        div.data("id",id);
       
        chart.setUpdateListener(function(filtered_items,name){
            self._chartFiltered(filtered_items,id);
        });
		

		//neeed to know in order to update charts
        if (typeof(chart.param)=="function"){

        }
        else if  (typeof(chart.param) !=="string"){
        	if (Array.isArray(chart.config.param)){
                for (let param of chart.config.param){
                    this.param_to_graph[param]=chart;
                }		
        	}
          
        }
        else{
            this.param_to_graph[chart.config.param]=chart;
		}

		let col_options = chart.getColorOptions();

		if (col_options){
			let color_by=  $("<i class='fas fa-palette'></i>")
			 	.css({"margin-left":"auto","margin-right":"3px"})
               	.click(()=>{
                	new ColorByDialog(this.columns,this.ndx.getOriginalData(),col_options.div,
                	function(d){
                		chart.colorByField(d);
                	},col_options.datatype,chart.config.color_by)
                });
            chart.addMenuIcon(color_by);	
		}

		let download_image = $("<i class='fas fa-image'></i>").css({"margin-left":"auto","margin-right":"3px"})
            .click(()=>{
                chart.downloadImage();
              
            });
        chart.addMenuIcon(download_image);
        let pin_icon = $("<i class='fas fa-thumbtack'></i>").css({"margin-left":"auto","margin-right":"3px"})
            .click(()=>{
                self.pinChart(chart);
              
            });
        chart.addMenuIcon(pin_icon);

      

        let remove = $("<i class='fas fa-trash'></i>").css({"margin-left":"auto","margin-right":"3px"})
            .click(()=>{
                this.removeChart(id);
            });
        chart.addMenuIcon(remove);


        //Add exisiting filter to chart
        if (this.filtered_ids && (this.filtered_items_length !== this.ndx.getOriginalData().length)){
            if (chart._hide){
                chart._hide(this.filtered_ids,this.filtered_items_length);
            }
        }
        if (config.static){
        	this.pinChart(chart);
        }
        if (!not_propagate){
			let g_info= this._getChartInfo(type,config.param);
			for (let id in this.add_listeners){
				this.add_listeners[id](config,g_info)
		    }
        }
        return id;
      
       
       
    }


    _getChartInfo(type,param){
    	let g_info={
				type:MLVChart.chart_types[type].name,
				fields:[]
			}
			let p1 =param;
			if (!Array.isArray(param)){
				p1=[param];
			}
			if (param){
				for (let p of p1){
					if (this.column_index[p]){
					    g_info.fields.push(this.column_index[p].name);
					}
					else{
						 g_info.fields.push(p);
					}
				}
			}
		return g_info;

    }

    /**
    * Removes a chart from a panel. All filters will be removed from 
    * the chart and the panel updated accordingly
    * @param {integer} id - The id of the graph to remove
    * @returns{boolean} true if the chart was successfully removed, otherwise false
    */
    removeChart(id,not_propagate){
        let chart = this.charts[id];
        if (!chart){
            return false;
        }
        let parent_div=chart.div.parent();
        let left = chart.remove();
        let d_name = chart.config.div_name?chart.config.div_name:"_default";
        this.gridstacks[d_name].removeWidget(parent_div);
        let g_info= this._getChartInfo(chart.type,chart.config.param);
	   delete this.charts[id];
        if (!not_propagate){
			for (let id in this.remove_listeners){
			   this.remove_listeners[id](chart.config,g_info);
			}
        }	

        
        if (left){
            dc.redrawAll();
            this._chartFiltered(left);
        }
        
        return true;
    }


    addStaticCharts(charts){
    	this.static_charts=charts
    	this.addStaticChart(0);
    }

    addStaticChart(index){
    	let self =this;
    	if (index ===this.static_charts.length){
    		return;
    	}
    	let ch = this.static_charts[index];
    	let id = this.addChart(ch);
    	setTimeout(()=>{
    		self.pinChart(self.charts[id],index);
    	},150)
    	
    }

    unpinChart(chart){
    	let self = this;
    	let loc= null
    	let dn = chart.config.div_name?chart.config.div_name:"_default";
    	for (let node of this.gridstacks[dn].grid.nodes){
    		if  (node.el.data("chart")===chart){
    		    loc = {
					x:node.x,
					y:node.y,
					height:node.height,
					width:node.width
    		    }
    		    break;

    		}

    	}
    	let o_config = chart.config._original_config;
    	delete o_config.size;
    	o_config.location= loc
    	this.removeChart(chart.config.id,true);

    	this.addChart(o_config);

    }


    pinChart(chart,index){
    	if (chart.type==="single_image_chart"){
    		this.unpinChart(chart);
    		return;
    	}
    	let self = this;
    	let loc= null;
    	let dn = chart.config.div_name?chart.config.div_name:"_default";
    	for (let node of this.gridstacks[dn].grid.nodes){
    		if  (node.el.data("chart")===chart){
    		    loc = {
					x:node.x,
					y:node.y,
					height:node.height,
					width:node.width
    		    }
    		    break;

    		}
    	

    	}
    	chart.getCanvas(function(canvas){
    		let id  = chart.config.id;
    		let title = chart.config.title;
    	    let orig_config= chart.config;
    	    orig_config.type=chart.type;
            self.removeChart(id,true);
    		self.addChart({
    			type:"single_image_chart",
    			param:canvas.toDataURL('image/png'),
    			location:loc,
    			id:id,
    			title:title,
    			_original_config:orig_config

    		});
    		self.charts[id].ti.css("background-color","lightgray");
    		if (index !== undefined){
    			self.addStaticChart(index+1);
    		}
    		
    	})
    }

	/**
    * Clears filters from all the graphs in the panel 
    */
    resetAll(){
    	this._chart_is_filtering=true;
    	for (let name in this.charts){
    		let chart = this.charts[name];
    		if (chart.removeFilter){
    			chart.removeFilter();
    		}
    		if (chart.centerGraph){
    			chart.centerGraph();
    		}	
    	}
    	dc.filterAll();
        dc.redrawAll();
        this._chart_is_filtering=false;
        let dim=null
        for (let gn in this.charts){
            dim = this.charts[gn].dim;
            if (dim){
            	break;
            }         
       
        }
        dc.redrawAll();
        if (dim){
            let items =dim.getIds();
            this._chartFiltered(items);
        }

    	
    
    	for (let id in this.listeners){
         		this.listeners[id](this.filtered_ids,this.filtered_items_length);
         	}
    }



    setChartField(chart_id,field){
        this.charts[chart_id].setField(field)
    }

     filterChanged(){
        //get rendom graph
        let dim=null
        for (let gn in this.charts){
            dim = this.charts[gn].dim;
            if (dim){
            	break;
            }         
       
        }
        dc.redrawAll();
        if (dim){
            let items =dim.getIds();
            this._chartFiltered(items);
        }
    }

    updateDCCharts(){
    	dc.redrawAll();
    }



 

    _chartFiltered(info,chart_exclude,not_propogate){
    	let self =this;
    	if (this._chart_is_filtering){
    		return;
    	}
    	console.log(chart_exclude);
    	this._chart_is_filtering=true;
    	setTimeout(function(e){
    		self._chart_is_filtering=false;
    	},100) ;  
    	this.filtered_ids=info.items;
    	this.filtered_items_length=info.count;
    	
        for (let name in this.charts){
            let chart = this.charts[name];
            if (chart._hide){
                if (name === chart_exclude){
                    //chart._filter(info.items);

                }
                else{
                    chart._hide(info.items,info.count);
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
    * @param {funcion} func - the callback will receive an object containing ids to the item 
    * and a count of the total number of filterd items
    * @returns{string} The id of the listener
    */
    addListener(func,id){
    	if (! id){
    		id  = this._getRandomString(6);
    	}
        this.listeners[id]=func;
        return id;
    }

    addRemoveListener(func,id){
    	if (!id){
    		id=this._getRandomString(6)
    	}
    	this.remove_listeners[id]=func;
    	return id;
    }

    addAddListener(func,id){
    	if (!id){
    		id=this._getRandomString(6)
    	}
    	this.add_listeners[id]=func;
    	return id;
    }

    removeListener(id){
    	delete this.listeners[id];
    }

    refresh(){    
        //dc.renderAll();
        this.resize();
    }

    getGraphs(){
    	let all_graphs=[];
    	for (let d_name in this.gridstacks){
			for (let node of this.gridstacks[d_name].grid.nodes){
				let location = {
					x:node.x,
					y:node.y,
					height:node.height,
					width:node.width
				}
				let chart = node.el.data("chart");
				let config= chart.getConfig();
				config["type"]=chart.type;
				config["location"]=location;
				delete config["size"];
				delete config["view"];
				all_graphs.push(config);

			}
    	}
    	return all_graphs;
    }

    getChartLocation(id){
    	let l = this.charts[id].div.parent()[0].dataset;
    	return{
    		x:l.gsX,
    		y:l.gsY,
    		width:l.gsWidth,
    		height:l.gsHeight
    	}
    }


    getFilters(){
    	let filters=[];
    	for (let name in this.charts){
    		let fi = this.charts[name].getFilter();
    		for (let f of fi){
    			if (f.length===0){
    				continue;
    			}
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
    constructor(ndx,div,config){
        if (config.allow_settings === undefined){
            config.allow_settings=true;
        }
        this.config=$.extend(true,{},config);
        if (!this.config.id){
        	this.config.id=getRandomString();
        }
        let self=this;
        this.ndx=ndx;
        if (typeof div === "string"){
        	div=$("#"+div);
        }
        let title = config.title
        if (!title){
        	if (config.param){
				if ( typeof config.param === "string"){
					title=config.param;
				}
				else{
					title = config.param[0]+" X "+config.param[1];
				}
				this.config.title=title;
        	}
        	else{
        		this.config.title=title= "Chart";
        	}
        }
        this.div=div.css({"display":"inline-block"});
      
        this.ti=$("<div>").appendTo(this.div).css({"display":"flex","white-space":"nowrap"})
            .attr("class","mlv-chart-label")
            .on("mouseover",function(e){
                $(this).find('.mlv-chart-option-menu').show();
                if (!MLVChart.chart_types[self.type].dialog){
                    $(this).find(".fa-cog").hide();
                }
            })
            .on("mouseout",function(e){
                $(this).find('.mlv-chart-option-menu').hide();
            });

       
        this.title_span =$("<span>").text(title).css({"text-overflow":"ellipsis","overflow":"hidden"}).appendTo(this.ti);
        if (config.title_color){
        	this.ti.css("background-color",config.title_color);
        }
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

    setColorFromConfig(){
		let cb = this.config.color_by;
		let params =null;
		if (cb){
			let opt = this.getColorOptions();
			params = FilterPanel.getColorScale(cb.column,this.ndx.all(),cb.scheme,opt.div);
			
		}
		this.colorByField(params);
	}


	colorByField(params){
		if (!params){
			delete this.config.color_by;
			let div = this.getColorOptions().div;
			$("#"+div+"-bar").remove();
		}
		else{
			this.config.color_by={
    			column:params.column,
    			scheme:params.scheme,
    		}
		}
	}

    

    addTitleControl(control){
    	this.ti.append(control);
    }

    highlightDataItem(){}

    
    remove(){}

    setUpdateListener(func){
        this.updateListener=func;
    }
    
    showChartDialog(){
        let dialog = MLVChart.chart_types[this.type].dialog;
        if (dialog){
            new dialog(this);
        }
    }

    getFilter(){
    	return [];
    }

    dataChanged(){

    }
   	_setParam(params,param){
   		if (params[param] !== undefined){
   			this.config[param]=params[param];
   		}
   	}

   	getRandomString(len,an){
		if (!len){
			len=6;
		}
    	an = an&&an.toLowerCase();
    	let str="", i=0, min=an=="a"?10:0, max=an=="n"?10:62;
   	 	for(;i++<len;){
      		let r = Math.random()*(max-min)+min <<0;
      		str += String.fromCharCode(r+=r>9?r<36?55:61:48);
    	}
    	return str;
    }

    getConfig(){
    	return $.extend(true,{},this.config);
    }

    getColorOptions(){
    	return null;
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
        this.config.size=[x,y];
        this.height=y-this.ti.height()+10;
        this.width=x;
       
    }

    downloadImage(){
    	let self = this;
    	this.getCanvas(function(canvas){
    		let link =document.createElement("a");
    	    let url =canvas.toDataURL('image/png');
    	    url = url.replace(/^data:image\/png/,'data:application/octet-stream');
			link.href=url
			link.download=self.config.title+".png"
			link.click();
			$(link).remove();

    	})
    	   


    }

    setTitle(title){
    	 this.title_span.text(title);
    	 this.config.title=title;

    }


}





class MLVDCChart extends MLVChart{
	constructor(ndx,chart_type,div,config){
    	super(ndx,div,config);
        let self=this;
        this.chart=chart_type("#"+div);
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
    


    setSize(x,y){
        super.setSize(x,y);
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

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=true;

        let filter= this.chart.filters();
          if (filter.length>0){
           this.chart.filter(null);
        }
        
		this.setParameters();
		this.not_broadcast=false;
      
        if (filter.length>0){
             this.not_broadcast=not_broadcast
           
            this.chart.filter([filter]);
        }
    }


    getCanvas(callback){
    	let svg = this.chart.svg().node();
    	let self = this;
    	getImageFromSVG(svg,function(canvas,ctx){
    	   callback(canvas); 
    	})

    }
    
	colorByField(params){
		if (!params){
			delete this.config.color_by;
			let div = this.getColorOptions().div;
			$("#"+div+"-bar").remove();
		}
		else{
			this.config.color_by={
    			column:params.column,
    			scheme:params.scheme,
    			value_to_color:params.value_to_color
    		}
		}

    	this.setParameters();
	}
}





class MLVColorStackChart extends MLVDCChart{
	constructor(ndx,chart_type,div,config,){
		super(ndx,chart_type,div,config);
		this.init();

		this.setColorFromConfig(); 
        if (this.config.size){
        	this.setSize(this.config.size[0],this.config.size[1]);
        }
        else{
        	this.setSize();
        }
	}
	 setFilter(a,b){
        this.chart.filter(null);
       setTimeout(()=>{
            this.chart.filter(dc.filters.RangedFilter(a,b));
             dc.redrawAll();
     },50);
       //dc.redrawAll();
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




    getFilter(){
    	let filters = this.chart.filters();
    	if (filters.length===0){
    		return [];
    	}
    	return [{field:this.config.param,operand:"between",value:[filters[0][0],filters[0][1]]}];
    }

   	/**
   	* params
   	* max
   	* min
   	* bin_number
   	* max_y
   	* color_by
   	*/



	getColorOptions(){
		let d = this.div.parent();
        let id = this.div.attr("id")+"-parent";
        d.attr("id",id);
		return {
			datatype:"text",
			div:id
		}
	}

	setColorFromConfig(){
		let cb = this.config.color_by;
		let params =null;
		if (cb){
			let opt = this.getColorOptions();
			params = FilterPanel.getColorScale(cb.column,this.ndx.getOriginalData(),cb.scheme,opt.div);
			
		}
		this.colorByField(params);
	}
	setColorStack(param){
    	let self =this;
    	if (this.config.color_by){
        	this.categories=[];
        	let cols=[]
        	for (let cat in this.config.color_by.value_to_color){
        		this.categories.push(cat);
        		cols.push(this.config.color_by.value_to_color[cat])

        	}
        	this.categories.push("Other")
        	cols.push("rgb(220, 220, 220)")
        	this.chart.ordinalColors(cols);
        	this.chart.group(this.group,this.categories[0],function(d){
            	let val= d.value[self.categories[0]];
            	if (val===undefined){
            		return 0;
            	}
            	return val;
            });
        	let field =self.config.color_by.column.field;
        	let value_to_color= self.config.color_by.value_to_color;
        	this.group.reduce(
				function(p,v,nf){
					let val = v[field];
					if (!value_to_color[val]){
						val="Other"
					}
					let num = p[val];
					let inc = param?v[param]:1
					inc = inc?inc:0
					if (!num){
						p[val]=inc;
					}
					else{
						p[val]+=inc;
					}
					return p;
				},
				function(p,v,nf){
					let val = v[field];
					if (!value_to_color[val]){
						val="Other"
					}

					let num = p[val];
					if (num){
						let inc = param?v[param]:1
						inc = inc?inc:0
						p[val]-=inc;
					}

					return p;
				},
				function(){
					return {};
				});
			for (let i=1;i<this.categories.length;i++){
        		this.chart.stack(this.group,this.categories[i],this._getColorFunction(i));
        	}
              
        }
        else{
        	this.chart.valueAccessor(function(d){return d.value});
        	this.chart.group(this.group);
        }
        if (this.config.max_y){
            this.chart.elasticY(false);
            this.chart.y(d3.scaleLinear().domain([0,this.config.max_y]))
        }
        else{
            this.chart.elasticY(true);
        }              
    }

	 _getColorFunction(i){
    	let self=this;
    	return function(d){
    		let val =d.value[self.categories[i]];
    		return val?val:0
    	}
    }

}

class MLVBarChart extends MLVColorStackChart{
    constructor(ndx,div,config){    	 
        super(ndx,dc.barChart,div,config);     
    }

    init(){
    	this.type="bar_chart";
        let self =this;
        
        if (this.config.bin_number === undefined){
        	this.config.bin_number=10;
        }
        

		let min_max= findMinMax(this.ndx.getOriginalData(),this.config.param);
		this.min = min_max[0];
		if (this.config.display_min === undefined){
			this.config.display_min=min_max[0];
		}
		this.max = min_max[1];
		if (this.config.display_max === undefined){
			this.config.display_max = min_max[1];
		}

    }

    setParameters(params){
        let self=this;
        if (params){
        	this._setParam(params,"display_max");
         	this._setParam(params,"display_min");       	
			this._setParam(params,"bin_number");
			this._setParam(params,"max_y");
			//this._setParam(params,"color_by");
     

        }
        if (this.dim){
        	this.dim.dispose();
        }
         
        this.range = this.config.display_max-this.config.display_min

        this.bin_width=(this.range/(this.config.bin_number));
        let fudge = this.bin_width/10;
        this.dim=this.ndx.dimension(
            function(d){
            	let val = d[self.config.param];
            	//any missing data will not crash crossfilter but be hidden in the graph
            	if (isNaN(val)){
            		return self.config.display_min-self.bin_width-1;
            	}
                if (val>=self.config.display_max){
                    return self.config.display_max-fudge;
                }
                if (val<self.config.display_min){
                    return self.config.display_min
                }

                return val;
           }
        );
      
        if (this.group){
            this.group.dispose()
        }
        this.group = this.dim.group(function(d){
            let v = (self.bin_width * Math.floor(d/self.bin_width));
            return v;

        });
        
        this.chart.dimension(this.dim)
                   .xUnits(dc.units.fp.precision(this.bin_width))
                   .x(d3.scaleLinear().domain([this.config.display_min-this.bin_width,this.config.display_max+this.bin_width]))
                   
                   .yAxisLabel("",0)
                    .xAxis().ticks(Math.round(this.width/30)).tickFormat(function(v,i){
                        if (Math.abs(v)>=1000){
                        if ((i+1)%2==0){
                            if (Math.abs(v)>=100000){
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

      
        this.chart.margins().right = 10;
        this.chart.margins().left=40;
        this.setColorStack();
        this.chart.render();
       
         
    }
    setSize(x,y){
        super.setSize(x,y);
         this.chart.x(d3.scaleLinear().domain([this.config.display_min-this.bin_width,this.config.display_max+this.bin_width]))
         .xAxis().ticks(Math.round(this.width/30));
         this.chart.yAxis().ticks(Math.round(this.height/25));
         this.chart.redraw();
    }

    


}

class MLVTimeLineChart extends MLVColorStackChart{
    constructor(ndx,div,config/*param,div_id,title,size,config*/){
    	 
        super(ndx,dc.lineChart,div,config);

    }

    init(){
    	this.type="time_line_chart";
        let self =this;
      
        if (typeof this.config.param  === "string"){
        	this.config.param = [this.config.param]
        }
        if (this.config.interval=== undefined){
        	this.config.interval="month"
        }
        

		let min_max= findMinMaxDate(this.ndx.getOriginalData(),this.config.param);
		
		if (this.config.display_min === undefined){
			this.date_min= min_max[0];
		}
		else{
			this.date_min=new Date(this.config.display_min);
		}

		if (this.config.display_max === undefined){
			this.date_max=min_max[1];
		}
		else{
			this.date_max=new Date(this.config.display_max);
		}
    }

  

    setSize(x,y){
        super.setSize(x,y);
         this.chart.x(d3.scaleTime().domain([this.date_min,this.date_max]))
         .xAxis().ticks(Math.round(this.width/80));
         this.chart.yAxis().ticks(Math.round(this.height/25));
         this.chart.redraw();
    }


    setParameters(params){
        let self=this;
       if (params){
        	this._setParam(params,"display_max");
         	this._setParam(params,"display_min");       	
			this._setParam(params,"intervals");
			this._setParam(params,"max_y");
			//this._setParam(params,"color_by");
			if (params["display_max"]){
				this.date_max= new Date(params["display_max"])
			}
			if (params["display_min"]){
				this.date_min= new Date(params["display_min"])
			}
        }


        if (this.dim){
        	this.dim.dispose();
        }
		
		let formatter=d3.timeMonth;
		let interval = this.config.interval;


		if (interval=== "year"){
			formatter= d3.timeYear;
        	this.date_formatter = d3.timeFormat("%Y")
		}
        else if (interval==="month"){
        	formatter= d3.timeMonth;
        	this.date_formatter = d3.timeFormat("%b %Y")

        }
        else if (interval==="week"){
			formatter= d3.timeWeek;
			this.date_formatter = d3.timeFormat("%d %b %y");
        }
       	else if (interval==="day"){
			formatter= d3.timeDay;
			this.date_formatter = d3.timeFormat("%d %b %y");
        }
     
		
        this.dim=this.ndx.dimension(
            function(d){
            	let date = formatter(new Date(d[self.config.param[0]]));
                /*if (d[self.param]>self.config.display_max){
                    return self.config.display_max
                }
                if (d[self.param]<self.config.display_min){
                    return self.config.display_min
                }
				*/
                return date;
           }
        );
      
        if (this.group){
            this.group.dispose()
        }
        this.group = this.dim.group();
       	if (this.config.param.length===2 && !(this.config.color_by)){
       			let r = this.config.param[1];
       			this.group.reduceSum(function(d){
				let val =  d[r];
				return val?val:0;
			}); 
       	}
	
		

      
        this.chart.dimension(this.dim)
                   .xUnits(dc.units.fp.precision(this.bin_width))
                   .x(d3.scaleTime().domain([this.date_min,this.date_max]))
                   .renderArea(true)
                 .brushOn(true)
                   .yAxisLabel("",0)
                    .xAxis().ticks(Math.round(this.width/60)).tickFormat(function(v,i){
                      return self.date_formatter(v);
                    });
	
     
        this.chart.yAxis().ticks(Math.round(this.height/25)).tickFormat(function(v,i){
                            if (v>=100000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        
         
                    });

        if (this.config.max_y){
            this.chart.elasticY(false);
            this.chart.y(d3.scaleLinear().domain([0,this.config.max_y]))
        }
        else{
            this.chart.elasticY(true);
        }    
        this.chart.margins().right = 10;
        this.chart.margins().left=40;
      	let param = this.config.param.length===2?this.config.param[1]:null;
      	this.setColorStack(param);
        this.chart.render();
       
         
    }


}


class SingleImageChart extends MLVChart{
	constructor(ndx,div,config){
		super(ndx,div,config);
		this.type="single_image_chart";
		this.image =$("<img>")
		.attr("src",this.config.param)
		.appendTo(this.div);
	}

	setSize(x,y){
		super.setSize(x,y);
		this.image.css({height:this.height-30,width:this.width});
	}
}

class TextBoxChart extends MLVChart{
	constructor(ndx,div,config){
		super(ndx,div,config);
		this.type="text_box_chart";
		this.text=$("<div>").html(this.config.text).appendTo(this.div);
	}

	
}


class AverageBarChart extends MLVChart{
	constructor(ndx,div,config){
		super(ndx,div,config);
        
		this.averages=[];
		this.len= config.param.length
		for (let i=0;i<this.len;i++){
			let av = {field:config.param[i],name:config.param[i]};
			if (config.labels){
				av.name=config.labels[i]
			}
			this.averages.push(av);
		}
		this.calculateAverages(this.ndx.getOriginalData());
		this.calculateRanges(this.ndx.getOriginalData());
		
        this.type= "average_bar_chart";
		var margin = {top: 0, right: 20, bottom: 30, left: 40};
        var width = this.div.width() - margin.left - margin.right;
        var height = this.div.height() - margin.top - margin.bottom-20;

  
        this.x = d3.scaleBand().padding(0.1);

        this.y = d3.scaleLinear()
     
       
          

        this.svg = d3.select(this.div[0]).append("svg")
        .attr("width", this.div.width())
        .attr("height", this.div.height());
        this.graph_area=this.svg
      .append("g")
        .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");
         this.graph_area.selectAll(".bar")
      .data(this.averages)
        .enter().append("rect").attr("class", "bar");

        
  
      this.x.domain(this.averages.map(function(d) { return d.name; }));
      this.y.domain([0, 1]);
      

 
     
      // add the x Axis
      this.x_axis=this.graph_area.append("g")
    

      // add the y Axis
      this.y_axis=this.graph_area.append("g")
  
     this.setSize();
	}


	_hide(items,length){
        this.calculateAverages(items,length);
        this.drawBars(this.div.height()-50);
	}

	remove(){
     
        this.div.remove();
        
    }


	drawBars(height){
	    let self =this;

	    let trans = d3.transition()
        .duration(400).ease(d3.easeLinear);
	   this.graph_area.selectAll(".bar").transition(trans)
      .attr("x", function(d) 
      {
      	 return self.x(d.name);
       })
      .attr("width", this.x.bandwidth())
      .attr("fill","rgb(55, 126, 184)")
      .attr("y", function(d) {
      	 return self.scales[d.field](d.average);
      	  })
      .attr("height", function(d) { return height - self.scales[d.field](d.average); });


	}

	median(l,r){
	   let med =l+Math.round((r-l)/2);
	   return med;
    }
    calculateRanges(data,height,outlier_factor=4){
    	this.scales={}
    	for (let field of this.config.param){
    		let arr=[];
    		for (let item of data){
    			if (item[field]!=null){
    				arr.push(item[field]);
    			}
    			
    		}
    		arr = arr.sort((a,b)=>a-b);
    		let n = arr.length;
	
	        let mid_index= this.median(0,n);
	        let Q1= arr[this.median(0,mid_index)];
	        let Q3=arr[this.median(mid_index+1,n)];
	        let IQR= Q3-Q1;
	        let min = Q1-(outlier_factor*IQR);
	        for (let i=0;i<arr.length;i++){
	        	if (arr[i]>min){
	        		min=arr[i];
	        		break
	        	}

	        }
	        let max =Q3+(outlier_factor*IQR);
	        for (let i=arr.length-1;i>=0;i--){
	        	if (arr[i]<=max){
	        		max=arr[i];
	        		break;
	        	}
	        }
	        this.scales[field] = d3.scaleLinear().range([height, 0]).domain([min,max]).clamp(true);
	        
    	}
}

    	
	
	
	setSize(){
		let height=this.div.height();
		let width = this.div.width();
		this.svg 
        .attr("width", width)
        .attr("height", height)
		
		this.x.range([0, width-60])
		for (let field of this.config.param){
			this.scales[field].range([height-50, 0]);[]
		}
        this.y.range([height-50,0]);
        this.drawBars(height-50);
        this.y_axis.call(d3.axisLeft(this.y));
        this.x_axis
      .attr("transform", "translate(0," + (height-50) + ")")
      .call(d3.axisBottom(this.x));
	}




	calculateAverages(data,length){
		let avs ={};
		for (let field of this.config.param){
			avs[field]=[0,0];
		}
		for (let index in data){
			let item = data[index];
			for (let field of this.config.param){
				let v= item[field];
				if (v!=null){
					avs[field][0]=avs[field][0]+v;
					avs[field][1]++;
				}
				
			}
		}
		let av_list=[];
		length=length?length:data.length;
		for (let item of this.averages){
		    if (!length || avs[item.field][1]===0){
		    	item.average=0;
		    	continue;
		    }
			item.average=avs[item.field][0]/avs[item.field][1];;
		}
	}
}


class WGLChart extends MLVChart{
	addAxis(config){
		if (!config){
			config={};
		}
        this.scale_config=config;
		this.y_axis_width=config.y_axis_width?config.y_axis_width:40;
        this.x_axis_height=config.x_axis_height?config.x_axis_height:25;
        let rs = getRandomString();
        let holder_id= "wg-graph-holder"+rs;
        this.holder_div=$("<div>").attr("id",holder_id)
        
                                .appendTo(this.div);
        let id = "wg-graph-"+rs;
        this.graph_id=id;
        let graph_div= $("<div>").css({"position":"relative","margin-bottom":this.x_axis_height+"px","margin-left":this.y_axis_width+"px"})
                                .attr("id",id)
                                .css("z-index",20)
                                .appendTo(this.holder_div)
                               
        if (config.right_y_axis){
        	graph_div.css("margin-right","50px");
        }
        this.axis = d3.select("#"+holder_id).append("svg").attr("width", 50).attr("height", 50).styles({
           position:"absolute",
           top:"0px",
           "z-index":10,
           left:"0px",
        });
        this.y_axis_svg=this.axis.append("g");
        this.x_axis_svg=this.axis.append("g");
       
        if (config.right_y_axis){
            this.right_y_axis_svg=this.axis.append("g");
        }
        if (config.y_scale==="band"){
            this.y_axis_scale = d3.scaleBand().padding(0.1);
             if (config.right_y_axis){
                this.right_y_axis_scale=d3.scaleBand().padding(0.1);
            }
        }
        else{
            this.y_axis_scale=  d3.scaleLinear();
        }
        if (config.x_scale==="band"){
            this.x_axis_scale = d3.scaleBand().padding(0.1);
          
        }

        
        else{
            this.x_axis_scale=  d3.scaleLinear();
        }
      
      
        if (config.right_y_axis){
                this.right_y_axis_call=d3.axisRight(this.right_y_axis_scale);
        }
        this.x_axis_call= d3.axisBottom(this.x_axis_scale);   
        this.y_axis_call=d3.axisLeft(this.y_axis_scale);
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
         $("#"+this.graph_id).css("margin-left",this.y_axis_width+"px");
        this.holder_div.height(this.height);
        this.width=x;
        let app_width= this.width-this.y_axis_width;
        if (this.scale_config.right_y_axis){
        	app_width-=50;
        }
        this.app.setSize(app_width,this.height-this.x_axis_height);
        this.axis.attr("width",this.width).attr("height", this.height).styles({top:th+"px"});
        let y_width=this.width-this.y_axis_width;
        if (this.scale_config.right_y_axis){
          
             this.right_y_axis_scale.range([0,this.height-this.x_axis_height]);
        }
        this.x_axis_scale.range([0,app_width]);
        this.y_axis_scale.range([0,this.height-this.x_axis_height]);


        if (this.x_axis_label){
            this.x_axis_label.attr("transform",
                "translate(" + (this.width/2) + " ," + 
                               (this.height) + ")");
        }
        if (this.y_axis_label){
     	    this.y_axis_label.attr("transform", "translate(10,"+((this.height-this.x_axis_height)/2)+") rotate(-90)") ;
        }
        let bp = this.height-this.x_axis_height;
        if (this.scale_config.x_scale==="band"){
            let hpt= (this.width-this.y_axis_width)/	this.x_axis_scale.domain().length;
         	let mod=1;
         	if (hpt<12){
         		let t_no=(this.width-this.y_axis_width)/12;
         		mod=Math.round(this.x_axis_scale.domain().length/t_no);
         	}
            this.x_axis_call.tickValues(this.x_axis_scale.domain().filter(function(d,i){
            	return !(i%mod) }));

        }
        else{
        	this.x_axis_call.ticks(Math.round((this.width-this.y_axis_width)/40));
        } 
       
        this.x_axis_svg
        .attr("transform", "translate("+this.y_axis_width+","+bp+")")
         .call(this.x_axis_call);
         if  (this.scale_config.y_scale==="band"){
         
         	let hpt= (this.height-this.x_axis_height)/	this.y_axis_scale.domain().length;
         	let mod=1;
         	if (hpt<10){
         		let t_no=(this.height-this.x_axis_height)/10;
         		mod=Math.round(this.y_axis_scale.domain().length/t_no);
         	}
            this.y_axis_call.tickValues(this.y_axis_scale.domain().filter(function(d,i){
            	return !(i%mod) }));
            if  (this.scale_config.right_y_axis){
            	let hpt= (this.height-this.x_axis_height)/	this.right_y_axis_scale.domain().length;
         	    let mod=1;
         	    if (hpt<10){
         		    let t_no=(this.height-this.x_axis_height)/10;
         		    mod=Math.round(this.right_y_axis_scale.domain().length/t_no);
         	    }
                    this.right_y_axis_call.tickValues(this.right_y_axis_scale.domain().filter(function(d,i){
            	return !(i%mod) }));
            }


         }



         else{

             this.y_axis_call.ticks(Math.round((this.height-this.x_axis_height)/25));
         }

         this.y_axis_svg
        .attr("transform", "translate("+this.y_axis_width+",0)")
         .call(this.y_axis_call); 

         if  (this.scale_config.right_y_axis){

             this.right_y_axis_svg
        .attr("transform", "translate("+(this.width-50)+",0)")
         .call(this.right_y_axis_call); 
         }
       


    }

    getCanvas(callback){
    	let svg = this.axis.node();
    	let self = this;
    	getImageFromSVG(svg,function(canvas,ctx){
    		var image = new Image();
    		self.app.refresh();
    	    ctx.drawImage(self.app.canvas[0],self.y_axis_width,0);
    	    callback(canvas);
    	   
    	})
    }
}


class WGLScatterPlot extends WGLChart{
    constructor(ndx,div,config){
    	super(ndx,div,config);

        let self = this;
        this.reset_but.click(function(e){
                 self.app.clearBrush();
                 self._createFilter(null);
                 self.reset_but.css("visibility","hidden");
             }).appendTo(this.ti);
        
        this.default_color=[31, 119, 180];      
       
        this.x= this.config.param[0];
        this.y= this.config.param[1];
        this.dim = ndx.dimension(function (d) {
            return d.id;
        });
        this.group=this.dim.group();
        this.addAxis();
        if (!this.config.axis){
        	this.config.axis={};
        }
        let ax = this.config.axis;
        if (!this.config.point_type){
        	this.config.point_type="circle";
        }

        if (!this.config.brush){
        	this.config.brush="default";
        }
        else{
        	if (this.config.brush!=="poly"){
        		this.config.brush="default";
        	}
        }
         if (!this.config.on_filter){
        	this.config.on_filter="hide";
        }
        else{
        	if (this.config.on_filter!=="opaque"){
        		this.config.on_filter="hide";
        	}
        }


		ax.x_label = ax.x_label?ax.x_label:this.config.param[0];
		ax.y_label = ax.y_label?ax.y_label:this.config.param[1];
        this.x_axis_label=this.axis.append("text")             
      		.style("text-anchor", "middle")
      		.attr("font-size","13px")
      		.text(ax.x_label);

      	this.y_axis_label=this.axis.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
   			.attr("font-size","13px")
            .text(ax.y_label);
       

     

        this.x_axis_call.tickFormat(function(v,i){
			if (self.config.axis.x_log_scale){
				v= self._getInverseLogValue(v);
				if (!Number.isInteger(v)){
					return "";
				}
			}
			if (v>=10000 || v<=-10000){
				return Number.parseFloat(v).toPrecision(2);
			}
			return v;
        });

        this.y_axis_call.tickFormat(function(v,i){
			if (self.config.axis.y_log_scale){
				v=self._getInverseLogValue(v);
				if (!Number.isInteger(v)){
					return "";
				}
			}
			if (v>=10000){
				return Number.parseFloat(v).toPrecision(2);
			}
			return v;
        });
        this.createApp()
               
      

        this.app.addHandler("zoom_stopped",function(data){
            self._updateScale(data);
          
        });

        this.app.addHandler("panning_stopped",function(data){
            self._updateScale(data);
          
        });

        this.app.addHandler("brush_stopped",function(range,is_poly){
		    self.reset_but.css("visibility","visible");
		    if (!is_poly){
		        range.y_max=-range.y_max;
		        range.y_min=-range.y_min;
		        self._createFilter(range);
		    }
		    else{
		    	self._createPolyFilter(range);
		    }
		});
        this.init();
		   
    }


    highlightDataItem(key){
    	this.app.highlightPoint(key);
    }

    getFilter(){
    	let filters=[];
    	if (!this.range){
    		return filters;
    	}
    	filters.push({field:this.config.param[0],operand:"between",value:[this.range.x_min,this.range.x_max]});
    	filters.push({field:this.config.param[1],operand:"between",value:[this.range.y_min,this.range.y_max]});
    	return filters;
    }

    createApp(){

         this.app = new WGL2DI(this.graph_id,this.div.width(),this.div.height(),{brush:this.config.brush});
    }

  



    setColorFromConfig(){
    	let sc= null;
    	if (this.config.color_by){
    		let c= this.config.color_by;
    		let gc=null;
    		if (this.config.group_colors){
    			if(this.config.group_colors[c.column.field]){
    				gc=this.config.group_colors[c.column.field]
    			}
    		} 	
    		sc = FilterPanel.getColorScale(c.column,
    								this.ndx.getOriginalData(),
    								c.scheme,
    								this.graph_id,
    								gc
    								);
    		sc.display_legend=this.config.color_by.display_legend;
    		
    	}
    	this.colorByField(sc);
    }

    getColorOptions(){		
		return {
			datatype:"all",
			div:this.graph_id
		}
	}

	dataChanged(){
		this.setColorFromConfig();
	}



	colorByField(param){
		if (param){
    		this.config.color_by={
    			column:param.column,
    			scheme:param.scheme,
    			display_legend:param.display_legend
    		}

		}
		
		
		else{
			delete this.config.color_by;
		}
        let data =this.ndx.getOriginalData();
        if (this.config.color_by){
        	if (this.config.color_by.display_legend===false){
			    $("#"+this.graph_id+"-bar").hide();
		    }
		    else{
			    $("#"+this.graph_id+"-bar").show();
		    }
        }
       
        if (param){
        	let field=param.column.field;
        	for (let item of data){
        		let v= item[field];
        		if (v===undefined || v===null){
        			v="none";
        		}
        		let color  = param.func(v);
        		if (color){
            	    color = this.convertToRGB(color);
        		}
            	else{
            		color=[255,255,255];
            	}
            	this.app.setObjectColor(item.id,color);
        	}
        }
        else{
        	for (let item of data){
            	this.app.setObjectColor(item.id,this.default_color);
        	}
        }
        this.app.maintainImageDimensions();
        this.app.refresh();
    }



    setUpdateListener(func){
        this.updateListener=func;
    }

    toggleLogScale(axis){
    	if (axis!=="y" && axis !=="x"){
    		axis="y";
    	}
    	let param = axis+"_log_scale"
    	if (!this.config.axis[param]){
    		this.config.axis[param]=true;
    		this.app.setLogPosition(axis,true);
    	}
    	else{
    		this.config.axis[param]=false;
    		this.app.setLogPosition(axis,false);
    	}
    	this.centerGraph();
    	if (axis==="x"){
    		let val = this._calculateRadius();
    		this.setPointRadius(val);
    	}
    }

    _updateScale(range){	
        this.x_axis_scale.domain([range.x_range[0],range.x_range[1]]);    
        this.x_axis_svg.transition().call(this.x_axis_call);
        this.y_axis_scale.domain([-range.y_range[0],-range.y_range[1]]);
        this.y_axis_svg.transition().call(this.y_axis_call);
    }

    init(){
        let self=this;
        let data = this.ndx.getOriginalData();
        let min_max = findMinMax(data,this.y)
        this.max_y=min_max[1]
        this.min_y=min_max[0];
       
        min_max = findMinMax(data,this.x)
        this.max_x= min_max[1];
        this.min_x= min_max[0];     
        this.default_radius=this._calculateRadius();
        if (!this.config.radius){
        	this.config.radius=this.default_radius;
        }
        this.addItems();        
    }

    _calculateRadius(){
    	let width = this.div.width();
		let max_x=this.config.max_x || this.config.max_x==0?this.config.max_x:this.max_x; 	
    	let min_x=this.config.min_x || this.config.min_x==0?this.config.min_x:this.min_x;
    	if (this.config.axis.x_log_scale){
    		max_x= this._getLogValue(max_x);
    		min_x= this._getLogValue(min_x);
    	}
		let pt_px= width/(max_x-min_x);
		return (width/50)/pt_px;
    }


    afterInit(){
    	if (this.config.axis.y_log_scale){
    		this.app.setLogPosition("y",true);
    	}
    	if (this.config.axis.x_log_scale){
    		this.app.setLogPosition("x",true);
    	} 
        this.setSize();
        this.centerGraph();
        this.setParameters();     
    }


    addItems(){
    	this.type="wgl_scatter_plot";
    	let data = this.ndx.getOriginalData();   
    	for (let item of data){
    		let x=item[this.x];
    		let y=item[this.y];
    		if (x==null || isNaN(x)|| y==null || isNaN(y)){
    			continue;
    		}
    		if (this.config.point_type==="square"){
                this.app.addSquare([x,-y],this.config.radius,this.default_color,item.id);
    		}
    		else{
    			this.app.addCircle([x,-y],this.config.radius,this.default_color,item.id);
    		}
			
		}
		this.app.setUniversalCircleRadius(this.config.radius);
		this.afterInit();
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
        this.app.remove();
        this.div.remove();
        return left;
    }

    removeFilter(){
    	if (this.range==null){
    		return;
    	}
    	else{
    		 this.app.clearBrush();
             this.reset_but.css("visibility","hidden");
             this._createFilter(null,true)

    	}
      
       
    }
    
    _createFilter(range,no_propagate){
		this.range=range;
		let self =this;
		
        if (range==null){
            this.dim.filter(null);
        }
        else{
        	let y_max=range.y_max;
        	let y_min=range.y_min;
        	let x_max=range.x_max;
        	let x_min=range.x_min;


         	if (this.config.axis.y_log_scale){
         		y_max=this._getInverseLogValue(y_max);
         		y_min=this._getInverseLogValue(y_min);
         	}
         	if (this.config.axis.x_log_scale){
         		x_max=this._getInverseLogValue(x_max);
         		x_min=this._getInverseLogValue(x_min);
         	}
         	
         	let x= this.x;
         	let y =this.y;
         	let items =this.ndx.getOriginalData();
          /*  for (let d of items){
                if (d[x]> x_max|| d[x]<x_min){
                   continue;
                }
                if (d[y]<y_max || d[y]>y_min){
                    continue;
                }
                if (isNaN(d[x])|| isNaN(d[y])){
                	continue;
                }
                ids[d.id]=true;
            }*/
            this.dim.filter(function(i){
        	  let d =self.ndx.getItemById(i);
                if (d[x]> x_max|| d[x]<x_min){
                   return false;
                }
                if (d[y]<y_max || d[y]>y_min){
                    return false
                }
                if (isNaN(d[x])|| isNaN(d[y])){
                	return false
                }
                return true;
            })

        }

      
        
       
        
       let  ids= this.dim.getIds();
        if(range ==null){
        	this._hide(ids.items)
        }
        this._filter(ids.items);
        if (!no_propagate){
        	dc.redrawAll();
            this.updateListener(ids,this.config.id);
        }
    }

    _createPolyFilter(vs){
    	this.range=true;
    	for (let pt of vs){
    		pt[1]=-pt[1];
    		if (this.config.axis.x_log_scale){
    			pt[0]=this._getInverseLogValue(pt[0]);
    		}
    		if (this.config.axis.y_log_scale){
    			pt[1]=this._getInverseLogValue(pt[1]);
    		}
    	}
    	let tx= this.x;
        let ty =this.y;
        let items =this.ndx.getOriginalData();
        let ids={};
        for (let d of items){

    	
   
			var x = d[tx], y = d[ty];

			var inside = false;
			for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
				var xi = vs[i][0], yi = vs[i][1];
				var xj = vs[j][0], yj = vs[j][1];

				var intersect = ((yi > y) != (yj > y))
					&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
				if (intersect) inside = !inside;
			}

			if(inside){
				ids[d.id]=true;
			}
		}
		this.dim.filter(function(d){
        	 return ids[d];
        })

        ids= this.dim.getIds();
        dc.redrawAll();
        this._filter(ids.items);
		this.updateListener(ids,this.config.id);

    }

    _getLogValue(val){
    	if (+val===0){
    		return 0;
    	}
    	let m=val>0?1:-1;
    	let abs = Math.abs(val);
    	if (abs<1){
    		return 0;
    	}
    	val = Math.log10(abs);
    	return val*m;
    }

    _getInverseLogValue(val){
    	if (+val===0){
    		return 0;
    	}
    	let m=val>0?1:-1;
    	val=Math.pow(10,Math.abs(val));
        return val*m;
    }

    centerGraph(){
    	let max_x=this.config.max_x || this.config.max_x==0?this.config.max_x:this.max_x;
    	let max_y=this.config.max_y || this.config.max_y==0?this.config.max_y:this.max_y;
    	let min_x=this.config.min_x || this.config.min_x==0?this.config.min_x:this.min_x;
    	let min_y=this.config.min_y || this.config.min_y==0?this.config.min_y:this.min_y;
    	if (this.config.axis.y_log_scale){
    		max_y=this._getLogValue(max_y);   			   		
    		min_y=this._getLogValue(min_y);    		
    	}
    	if (this.config.axis.x_log_scale){
    		max_x=this._getLogValue(max_x);   		
    		min_x=this._getLogValue(min_x);
    	}

        let x_margin=((max_x-min_x)/20);
        let y_margin=((max_y-min_y)/20);
        let x_range = (max_x-min_x)+2*x_margin;
        let y_range= (max_y-min_y)+2*y_margin;

        let x_scale= (this.width-this.y_axis_width)/x_range;
        let y_scale= (this.height-this.x_axis_height)/y_range

        this.app.x_scale = this.default_x_scale=(this.width-this.y_axis_width)/x_range;
        this.app.y_scale = this.default_y_scale=(this.height-this.x_axis_height)/y_range;
        this.app.offset[0]=-(min_x-x_margin);
        this.app.offset[1]=(max_y+y_margin);
        this._updateScale(this.app.getRange());
    }


    setParameters(params){
        let self=this;
        if (params){
        	this._setParam(params,"view");
         	this._setParam(params,"axis");       	
			this._setParam(params,"radius");
        }
        let v = this.config.view
		this.app.setUniversalCircleRadius(this.config.radius);
        if (v){
        	this.app.x_scale=v.x_scale;
        	this.app.y_scale=v.y_scale;
        	this.app.offset=[v.offset[0],v.offset[1]];
        
        }
        this.y_axis_label.text(this.config.axis.x_label);
        this.y_axis_label.text(this.config.axis.y_label);
        this._updateScale(this.app.getRange());
        this.setColorFromConfig();
        
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



    _hide(ids){
    	let ob_type=this.config.point_type==="square"?3:0;
        if (this.config.on_filter==="opaque"){
        	this._filter(ids,ob_type);
        	return;
        }
     
        this.app.hideObjects(ids,ob_type,this.def_op);
        this.app.refresh();
    }

    _filter(ids){
    	let ob_type=this.config.point_type==="square"?3:0;
        this.app.filterObjects(ids,ob_type);
        //this._hide(ids);
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
    refreshPositions(){
    	let data = this.ndx.getOriginalData();
    	for (let item of data){
    		this.app.setObjectPosition(item.id,item[this.x],-item[this.y]);

    	}
    	
        let min_max = findMinMax(data,this.y)
        this.max_y=min_max[1]
        this.min_y=min_max[0];
 
        min_max = findMinMax(data,this.x)
        this.max_x= min_max[1];
        this.min_x= min_max[0];
        this.dim.dispose();
        let self =this;
        this.dim = this.ndx.dimension(function (d) {
            return [d[self.x], d[self.y]];
        }),
        this.group=this.dim.group();
        let val = this._calculateRadius();
        this.config.radius=val;
        this.app.setUniversalCircleRadius(val);   
    	this.centerGraph();
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
        this.config.radius=val;
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
    constructor(ndx,div,config){   
        super(ndx,dc.rowChart,div,config);
        this.type="row_chart";
        let self =this;
       	if (!this.config.cap){
			this.config.cap=8;
		}
		this.chart.margins().right = 10;
		let f =typeof this.config.param === "string"?this.config.param:this.config.param[0];
		this.cs = FilterPanel.cat_color_schemes["Scheme 1"].slice(0);
		this.cs.splice(this.config.cap,0,"black");
		let vals = null;
		if (this.config.delimiter){
			vals =groupAndOrderArrayData(this.ndx.getOriginalData(),f,this.config.delimiter);
		}
		else{
			vals =groupAndOrder(this.ndx.getOriginalData(),f);
		}
		 
		let i=0;
		this.val_to_order={};;
		for (let  v of vals){
			this.val_to_order[v.value]=i;
			if (i===this.cs.length){
				break;
			}
			i++;

		}

      
        this.setParameters();
        if (this.config.size){
        	this.setSize(this.config.size[0],this.config.size[1]);
        }
        else{
        	this.setSize()
        }
    }

    setParameters(params){
    	let self =this;

    	if (params){
        	this._setParam(params,"cap");
        	this._setParam(params,"delimiter");
        }
        if (this.dim){
        	this.dim.dispose();
        }
        let field= this.config.param;
        let param2= null;
        if (typeof this.config.param !== "string"){
			field= this.config.param[0];
			param2= this.config.param[1];
        }
        if (this.config.delimiter){
        	  this.dim = this.ndx.dimension(function(d) {
            	if (!d[field]){
                	return ["none"];
            	}
            	return (d[field]+"").split(self.config.delimiter);
        	},true);
        }
        else{
        	this.dim = this.ndx.dimension(function(d) {
            	if (!d[field]){
                	return "none";
            	}
            	return d[field];
        	});
        }
		if (!param2){
			this.group=this.dim.group().reduceCount(); 
		}
		else{
			this.group=this.dim.group().reduceSum(function(d){
				if (!d[param2]){
					return 0;
				}
				return d[param2];
			}); 
		}

    
     
       
       
       this.chart.dimension(this.dim)
            .ordering(function(d,b){
            	return self.val_to_order[d.key]
            })
            .group(this.group)
             .elasticX(true);
       
             
        if (this.group.size()===1){
            this.chart.fixedBarHeight(20);
        } 
        if (this.config.group_colors && this.config.group_colors[field]){
       	    let val_to_order={};
       	    let cs=[];
       	    let index=0;
       	    if (this.config.delimiter){
       	    	this.config.group_colors[field].sort(function(a,b){
       	    		return a[0].localeCompare(b[0])
       	    	});
       	    
       	    }
       	    for (let item of this.config.group_colors[field]){
                val_to_order[item[0]]=index;
                cs.push(item[1]);
                index++;
       	    }
       	    this.chart.ordering(function(d){
       	    	return val_to_order[d.key];
       	    });
       	    this.chart.ordinalColors(cs);

       }
       else{
        this.chart.ordinalColors(this.cs);
        this.chart.cap(this.config.cap); 
       }
      
        
      
        this.chart.render();
      

    }


   setCap(cap){
   	let self=this;
    	this.config.cap=cap;
    	this.chart.cap(cap);
    	  
    	this.chart.redraw();
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
        this.chart.redraw();
         
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


class BoxPlot extends MLVDCChart{
	constructor(ndx,div,config,columns){   
        super(ndx,dc.boxPlot,div,config);
        this.type="box_plot";
        let self = this;
        if (!this.config.cap){
        	this.config.cap=8
        }
        let vals = groupAndOrder(this.ndx.getOriginalData(),config.param[0]);
        this.categories=[];
        for (let n=0;n<vals.length;n++){
        	if (n===20){
        		break;
        	}
        	this.categories.push(vals[n].value)
        }
        for (let c of columns){
        	if (c.field===config.param[0]){
                if (c.colors){
                	let order=[];
                	this.config.cat_order=[];
                	this.config.colors=[];
                	for (let x of c.colors){
                		this.config.cat_order.push(x[0]);
                		order.push(x);
                	}
                	order.sort(function(a,b){
                		return a[0].localeCompare(b[0])
                	});
                	for (let x of order){
                		this.config.colors.push(x[1]);
                	}
                }
        	}
        	break;
        }

       
      
        this.setParameters();
        if (!this.config.size){
        	this.setSize()
        }
        else{
        	this.setSize(this.config.size[0],this.config.size[1]);
        }

       /*this.chart.on('pretransition', chart => {
            chart.selectAll('circle.data').attr('fill', function(d,e,f) {
                  const boxDatum = d3.select(this.parentNode).datum();
                return "blue";
        })
        });*/
             


    }

     setSize(x,y){
        super.setSize(x,y);
       
        this.chart.yAxis().ticks(Math.round(this.height/20)).tickFormat(function(v,i){
                            if (v>=100000 || v<=-100000){
                                return Number.parseFloat(v).toPrecision(2);
                            }
                            return v;
                        
         
                    });
     	 this.chart.margins().left=35;
            	this.chart.margins().right=20;
		if (this.config.max_y){
			this.chart.y(d3.scaleLinear().domain([0,this.config.max_y]))
		}
          	
        this.chart.redraw();

    }

	showDataPoints(points){
		this.chart.renderDataPoints(true,points);
		this.chart.redraw();
	}

	setColors(colors){
		this.config.colors=colors;
		this.chart.ordinalColors(this.config.colors);
		this.chart.redraw();
	}

	setCap(cap){
    	this.setParameters({"cap":cap})
    }

    setParameters(params){
    	if (params){
        	this._setParam(params,"cap");
        	this._setParam(params,"delimiter");
        	this._setParam(params,"max_y");
        	this._setParam(params,"show_points");
        	this._setParam(params,"show_outliers");
        }
        let self=this;

        if (this.config.param.length>2){
        	this.config.use_columns=true;
        }
       	
        if (this.dim){
            this.dim.dispose();
        }
		let cap_map={}
		for (let n=0;n<this.categories.length;n++){
			if (n>=this.config.cap){
				break;
			}
			cap_map[this.categories[n]]=true;
		}
      
      
      
      	
		this.dim = this.ndx.dimension(function(d){
			let v= d[self.config.param[0]];
			if (!v){
				return "None"
			}
			if (!cap_map[v]){
				return "Other"
			}
			return v;
		});

      	

    	if (this.group){
    		this.group.dispose();
    	}

    	if (this.config.use_columns){
    		 this.group = this.getFakeGroup(this.config.param)
    	}
    	else{

			let pa = this.config.param[1];
			this.group    = this.dim.group().reduce(
				function(p,v) {
				  // keep array sorted for efficiency
				  if (v[pa]== null){
				  	return p;
				  }
				
				  p.splice(d3.bisectLeft(p, v[pa]), 0, v[pa]);
				  return p;
				},
				function(p,v) {
				   if (v[pa]== null){
				  	return p;
				  }
				  p.splice(d3.bisectLeft(p, v[pa]), 1);
				  return p;
				},
				function() {
				  return [];
				}
		  	);
    	}
    	let labels= this.config.labels;
    	if (labels){
        	this.chart.xAxis().tickFormat(function(v,i){
        		return labels[i];
        	});           
        } 
  
    	this.chart.dimension(this.dim)
            	.group(this.group)
            	.showOutliers(this.config.show_outliers)
            	.renderDataPoints(this.config.show_points)
            	.elasticX(true);
    	if (this.config.use_columns){     	
			this.chart.filter= function(e){};
     
       		this.chart.ordering(function(d){
            	return self.config.param.indexOf(d.key);
        	});
       	}
       	if (this.config.colors){
       		this.chart.ordinalColors(this.config.colors);
       	
       	
       	}
       	if (this.config.cat_order){
       		this.chart.ordering(function(d){
       			return self.config.cat_order.indexOf(d.key);
       		});
       	}
       	
       	if (!this.config.max_y){
       		this.chart.elasticY(true)
       	}
       	else{
       		this.chart.elasticY(false);
       		this.chart.y(d3.scaleLinear().domain([0,this.config.max_y]));

       	}
            	
       	this.chart.render();
            	   
    }

   getFakeGroup(cols) {
	  var _groupAll = this.ndx.groupAll().reduce(
		function(p, v) { // add
		  cols.forEach(function(c) {
			p[c].splice(d3.bisectLeft(p[c], v[c]), 0, v[c]);
		  });
		  return p;
		},
		function(p, v) { // remove
		  cols.forEach(function(c) {
			p[c].splice(d3.bisectLeft(p[c], v[c]), 1);
		  });
		  return p;
		},
		function() { // init
		  var p = {};
		  cols.forEach(function(c) {
			p[c] = [];
		  });
		  return p;
		});
	  return {
		all: function() {
		  // or _.pairs, anything to turn the object into an array
		  let a = d3.map(_groupAll.value()).entries();
		  return a;
		},
		dispose:function(){}
	  };
	}


}



class MLVRingChart extends MLVDCChart{
    constructor(ndx,div,config){   
        super(ndx,dc.pieChart,div,config);
        this.type="ring_chart";
        let self = this;
        if (!this.config.cap){
        	this.config.cap=8;
        }
        this.setParameters();
        if (!this.config.size){
        	this.setSize()
        }
        else{
        	this.setSize(this.config.size[0],this.config.size[1]);
        }   

    }

    setCap(cap){
    	this.config.cap=cap;
    	this.chart.cap(cap);
    	this.chart.redraw();
    }

   

    setParameters(params){
        let self=this;
        if (params){
        	this._setParam(params,"cap");
        }    
        if (this.dim){
            //get rid of any filters
            //this.chart.filterAll();
            this.dim.dispose();
        }
      
      
    	this.dim = this.ndx.dimension(function(d){
    		let v= d[self.config.param];
        	if (!v){
        		return "None"
        	}
        	return v;
    	});
        
       
    	this.group=this.dim.group()//.reduceCount();
    	this.chart.dimension(this.dim)
            	.group(this.group)
            	.cap(this.config.cap)
            	.render();
    }

    dataChanged(not_broadcast){
        let self = this;
        this.not_broadcast=true;

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
    	filters.push({field:this.config.param,value:fs,operand:"="});
    	return filters;
    }
}

MLVChart.chart_types={
    "scatter_plot":MLVScatterPlot,
    "bar_chart":MLVBarChart,
    "ring_chart":MLVRingChart,
    "row_chart":MLVRowChart,
    "wgl_scatter_plot":WGLScatterPlot,
    "wgl_image_scatter_plot":WGLImageScatterPlot,
    "time_line_chart":MLVTimeLineChart,
    "box_plot":BoxPlot
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
            	this.cancelAction();
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

    cancelAction(){}

    _populateFields(select,datatype,none_option){    
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
        if (none_option){
        	$("<option>").val("none").text("None(Total counts)").attr("selected","selected").appendTo(select);
        
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
        for (let type in MLVChart.chart_types){
        	if (type.includes("image") && !(this.config.images)){
        		continue;
        	}
           if (this.config.exclude_graph_types){
           	    if (this.config.exclude_graph_types.indexOf(type)!==-1){
           	    	continue;
           	    }
           }
           this.chart_select.append($('<option>', {
	           value: type,
	           text:MLVChart.chart_types[type].name
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
       
    	let config ={};
    	config.param=[];
    	let self =this;
    	if (this.column_list){
    		config.labels=[];
            this.column_list.children().each(function(i,e){
            	let f= $(e).data("field");
            	config.param.push(f);
            	config.labels.push(self.field_to_column[f].name);
            })
    	}
    	else{
    		for (let select of this.param_inputs){
    		    let val = select.val();
    		    if (val !== "none"){
    			    config.param.push(select.val())
    		    }
    		
    	    }

    	}

    	if (config.param.length===1){
    		config.param = config.param[0];
    	}
    
        
        /*if (this.chart_type.includes("image")){
        	config=this.config.images;
        }*/
        config.title=this.title_input.val();
        config.type=this.chart_type;
        let addToConfig = MLVChart.chart_types[this.chart_type].addToConfig;
        if (addToConfig){
        	addToConfig(config,this.config,this.field_to_column);
        }

        setTimeout(function(){
        	self.callback(config);
        },20);
    }

    _addFields(type){
        let self=this;
        this.chart_type=type;
        let field_div=$("<div>").appendTo(this.div);
        this.param_inputs=[];
        let params = MLVChart.chart_types[type].params;
        if (typeof params === "string"){
        	if (params === "number"){
        		this._addMultiColumnSelect(field_div);
        	}
        }
        else{

			for (let param of params){
				 field_div.append("<label>"+param.name+"</label>");
				 let param_select =$("<select>").appendTo(field_div);
				 this._populateFields(param_select,param.type,param.optional);
				 field_div.append("<br>");
				 this.param_inputs.push(param_select)
			}
        }

        let but = $("<button>").text("next").attr("class","btn btn-sm btn-secondary").appendTo(field_div)
            .click(function(e){
                self._addTitle();
                $(this).hide();
            });
    }

    _addMultiColumnSelect(field_div){
    	let self = this;
    	let param_select =$("<select>").appendTo(field_div);
        this._populateFields(param_select,"number");
        field_div.append("<label>Select Columns</label>");
        field_div.append(param_select);
        let already={};
        this.column_list = $("<div>").attr({id:"column-list"}).css({margins:"4px",height:"50px"});
         let but = $("<button>").text("Add").attr("class","btn btn-sm btn-secondary")
         .click(function(e){
                let field = param_select.val();
                if (already[field]){
                	return;
                }
                already[field]=true;
                let d = $("<div>").append("<span>"+self.field_to_column[field].name)
                .data("field",field)
                .appendTo(self.column_list);
                let tr = $("<i class = 'fas fa-trash'></i>").css({cursor:"pointer"})
                .click(function(e){
                	delete already[$(this).parent().data("field")];
                	$(this).parent().remove();

                })
                .appendTo(d);
         })
         field_div.append(but).append(this.column_list);


    }

    _addTitle(){
        let title_div=$("<div>").appendTo(this.div);
        title_div.append("<label>Title:</title>");
        this.title_input= $("<input>").appendTo(title_div);
        let title="";
        if (this.param_inputs.length==1){
        	title= this.field_to_column[this.param_inputs[0].val()].name;
        }
        else if (this.column_list){
        	title = "Column Average";
        }
        else{
            title= this.field_to_column[this.param_inputs[0].val()].name;
            let val = this.param_inputs[1].val();
            if (val!="none"){
            	title+=" X "+  this.field_to_column[val].name;
            }
            
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
            title:graph.config.title,
            width:250,
            close: ()=>{
                this.div.dialog("destroy").remove();
            },
            buttons:[
                {
                    text:"Defaults",
                    click:()=>{
                        this.reset();
                    }
                },
                {
                	text:"Close",
                	click:()=>{
                		this.div.dialog("close");
                	}
                }
            ]
        }).dialogFix();
        let tb = this.div.parent().find(".ui-dialog-titlebar");
		let icon =$("<i class='fas fa-cog'></i>")
			.css({"float":"left","margin-top":"4px","font-size":"18px"});
		tb.prepend(icon);
        this._init();       
    }

    addCapControl(){
    	let cap_div=$("<div>").appendTo(this.div);
    	cap_div.append("<label>Max Categories:</label>");
        let graph = this.graph;
        let display_val = this.graph.config.cap?this.graph.config.cap:100;
        this.cap_spinner=$("<input>").val(this.graph.config.cap).appendTo(cap_div);
        this.cap_spinner.spinner({
              min:2,
              step:1,
              max:20,
              stop:function(e,ui){
                 let val = parseInt($(this).val());
              	 graph.setCap(val);
              }
             
          });
    }



}


class MLVRingChartDialog extends MLVChartDialog{
	_init(){
		this.addCapControl();
	}
}

class MLVRowChartDialog extends MLVChartDialog{
	_init(){
		this.addCapControl();
	}
}

class MLVBoxPlotDialog extends MLVChartDialog{
	_init(){
		this.addCapControl();
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
        this.bin_spinner.val(10);
        this.updateGraph();
    }

    updateGraph(){
        let params={
          display_min:parseFloat(this.slider.data("min").val()),
          display_max:parseFloat(this.slider.data("max").val())
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
               values: [this.graph.config.display_min,this.graph.config.display_max],
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
              
                
          }).val(this.graph.config.display_min);

          let max_input=$("<input type='text'>").on("blur keypress",function(e){
                let t = $(this);
                if (e.type==="keypress" && !(e.which===13)){
                    return;
                }
                let min_max = self.slider.slider("option","values");
                self.slider.slider("option","values",[min_max[0],t.val()]);
                self.updateGraph();
                 
          }).val(this.graph.config.display_max);

          slider_div.append(min_input).append(this.slider).append(max_input);
         
          this.slider.data({min:min_input,max:max_input});
       	 this.div.append("<hr>");
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
          let display_val = this.graph.config.max_y?this.graph.config.max_y:100;
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
          this.div.append("<hr>");
          this.div.append("<label>Bin Number:</label>");
          let bin_div=$("<div>").appendTo(this.div);
          this.bin_spinner= $("<input>").val(this.graph.config.bin_number).appendTo(bin_div);
            
          this.bin_spinner.spinner({
              min:1,
              step:1,
              /*change:function(e,ui){
                      self.updateGraph();
              },*/
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
        let n= this.graph.config.radius;
        let min=n/500;
        let max=n*5;
        let step = (max-min)/100;
        this.div.append("<label>Point Size:</label>");
        this.slider=  $("<div>")
            .slider({
               min: min,
               max: max,
               step:step,
               value: this.graph.config.radius,
               slide: function( event, ui ) {
                   let val= ui.value;
                   self.graph.setPointRadius(val);           
                }

        }).appendTo(this.div);

        this.range_vals={};
        this.div.append("<hr>");
        this.div.append("<label>Main Region</label>");
        let d = $("<div>").appendTo(this.div);
        d.append("X range");
        this._addRegionInput("min_x",d);
        d.append("to")
        this._addRegionInput("max_x",d);
        d = $("<div>").appendTo(this.div);
        d.append("Y range");
        this._addRegionInput("min_y",d);
        d.append("to")
        this._addRegionInput("max_y",d);
        $("<button>").text("Show")
        	.attr("class","btn btn-sm btn-secondary")
        	.click(function(e){
        		self._updateRegion();
        	})
        	.appendTo(this.div);

		this.div.append("<hr>");
		this.div.append("<label>Log Scale</label>");
		let div=$("<div>").appendTo(this.div);
		this.x_log_check=$("<input type='checkbox'>").appendTo(div)
        	.prop("checked",this.graph.config.axis.x_log_scale)
          .click(function(e){
            self.graph.toggleLogScale("x");
            self.graph.app.refresh();
            self._resetSlider();
          });
        div.append("<span>X axis</span>");
        this.y_log_check=$("<input type='checkbox'>").appendTo(div)
        	.prop("checked",this.graph.config.axis.y_log_scale)
          .click(function(e){
            self.graph.toggleLogScale("y");
            self.graph.app.refresh();
            self._resetSlider();
           
          });
        div.append("<span>Y axis</span>");

        this.div.append("<hr>");
        this.div.append("<label>Selection Type</label>");
        let r_name = getRandomString();
        div=$("<div>");

        div.append("<span>Default</span>").append( $("<input>").attr({type:"radio","name":r_name,value:"default"}).css("margin-right","4px").prop("checked",this.graph.config.brush==="default"));
        div.append("<span>Free Draw</span>").append( $("<input>").attr({type:"radio","name":r_name,value:"poly"}).css("margin-right","4px").prop("checked",this.graph.config.brush==="poly"));
         this.div.append(div);
        $('input[name="'+r_name+'"]').click(function(e){
        	self.graph.config.brush=$(this).val();
        	self.graph.app.config.brush=$(this).val();
        });
        this.div.append("<label>Filtered Points</label>");
        r_name = getRandomString();
        div=$("<div>");

        div.append("<span>Hide</span>").append( $("<input>").attr({type:"radio","name":r_name,value:"hide"}).css("margin-right","4px").prop("checked",this.graph.config.on_filter==="hide"));
        div.append("<span>Make opaque</span>").append( $("<input>").attr({type:"radio","name":r_name,value:"opaque"}).css("margin-right","4px").prop("checked",this.graph.config.on_filter==="opaque"));
         this.div.append(div);
        $('input[name="'+r_name+'"]').click(function(e){
        	self.graph.config.on_filter=$(this).val();
        });
       

        let but = $("<button>").attr({"class":"btn btn-sm btn-secondary"})
            .text("Centre Plot").appendTo(this.div)
            .click(function(e){
                self.graph.centerGraph();
				 self.graph.app.refresh();
				      
             
            });
    }

    _addRegionInput(type,div){
    	let val = this.graph.config[type]?this.graph.config[type]:this.graph[type];
    	let i = $("<input>").val(val).css({width:"70px",height:"20px","margin-left":"2px","margin-right":"2px"});
    	this.range_vals[type]=i;
    	i.appendTo(div);
    }

    _updateRegion(){
    	for (let type of ["max_x","min_x","max_y","min_y"]){
    		let val = this.range_vals[type].val();
    		if (val!=this.graph[type]){
    			this.graph.config[type]=parseFloat(val)
    		}
    	}

    	this.graph.centerGraph();
    	let val = this.graph._calculateRadius();
    	this.graph.setPointRadius(val);  	
    	this.graph.app.refresh();
    	this._resetSlider();
    }

    _resetSlider(){
    	let val = this.graph.config.radius
    	let min =val/500;
    	let max= val*5;
    	this.slider.slider("option","min",min);
    	this.slider.slider("option","max",max);
    	this.slider.slider("option","value",val);
    	let step = (max-min)/100;
    	this.slider.slider("option","step",step);

    }

    reset(){
    	if (this.graph.config.axis.x_log_scale){
    		this.graph.toggleLogScale("x");
    		this.x_log_check.prop("checked",false);
    	}
    	if (this.graph.config.axis.y_log_scale){
    		this.graph.toggleLogScale("y");
    		this.y_log_check.prop("checked",false)
    	}
    	for (let type of ["max_x","min_x","max_y","min_y"]){
    		delete this.graph.config[type];
    		this.range_vals[type].val(this.graph[type]);
    	}

        this.graph.centerGraph();
        
        this.graph.setPointRadius(this.graph.default_radius);
        this._resetSlider();     
    }
}

MLVChart.chart_types={
	 wgl_scatter_plot:{
		"class":WGLScatterPlot,
		name:"Scatter Plot",
		params:[{name:"x axis",type:"number"},{name:"y_axis",type:"number"}],
		addToConfig:function(config,info,field_to_column){
			  config.axis={
            	x_label:field_to_column[config.param[0]].name,
            	y_label:field_to_column[config.param[1]].name
            }
		},
		dialog:WGLScatterPlotDialog
	 },

	 single_image_chart:{
	 	"class":SingleImageChart,
	 	name:"Image"
	 },

	 text_box_chart:{
	 	"class":TextBoxChart,
	 	name:"Text Box"
	 },

	 average_bar_chart:{
	 	"class":AverageBarChart,
	 	name:"Bar Chart (Column Average)",
	 	params:"number"
	 },
	 bar_chart:{
		"class":MLVBarChart,
		name:"Histogram",
		params:[{name:"Paramater",type:"number"}],
		dialog:MLVBarChartDialog
	 },
	 ring_chart:{
		"class":MLVRingChart,
		name:"Pie Chart",
		params:[{name:"Catergory",type:"text"}],
		dialog:MLVRingChartDialog
	 },
	 box_plot:{
	 	"class":BoxPlot,
	 	name:"Box Plot",
	 	params:[{name:"X Axis(Category)",type:"text"},{name:"Y Axis(Values)",type:"number"}],
	 	dialog:MLVBoxPlotDialog
	 },
	 row_chart:{
	 	"class":MLVRowChart,
	 	name:"Row Chart",
	 	params:[{name:"Y Axis (Category)",type:"text"},{name:"X Axis(Values)",type:"number",optional:"true"}],
	 	dialog:MLVRowChartDialog
	 },
	 time_line_chart:{
	 	"class":MLVTimeLineChart,
	 	name:"Time Line Chart",
	 	params:[{name:"X Axis (Date)",type:"date"},{name:"Y Axis(Values)",type:"number",optional:"true"}]
	 }
}




function findMinMax(data,field){
    // change sjpt to make TData aware
    // **1** illustrates use of precomputed data min/max values.
    // **2** illustrates use of specific TData aware code for field access
    // comment out **1** to test **2**
    const tdata = (data[0]._tdata);
    // if (tdata) return [tdata.ranges[field].min, tdata.ranges[field].max]; // **1**

    let max = Number.MIN_SAFE_INTEGER;
    let min = Number.MAX_SAFE_INTEGER;

    // **2** exmple of using tdata direct access (rather than via proxy) sjpt
    // Usually switch would be at the assignment to f level for minimal change to the app.
    if (tdata) {
        const col = tdata.fvals[field];
        for (let i = 0; i < tdata.n; i++) {
            const f = col[i];
            if (isNaN(f)) continue;
            if (f>max) max=f;
            if (f<min) min=f
        }
    } else {  
        for (let item of data){
            const f = item[field];  // change by sjpt to remove multiple item[field] lookups
            if (isNaN(f)){
                continue;
            }
    
            if (f>max){
                max=f;
            }
            if (f<min){
                min=f
            }
        }
    }
    return [min,max];
}

function findMinMaxDate(data,field){
	let max = new Date(-8640000000000000);
	let min = new Date(8640000000000000);
   
    for (let item of data){
    	let d = new Date(item[field]);
        if (d>max){
            max=d
        }
        if (d<min){
            min=d;
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
		let v = item[field];
		if (v===undefined || v== null){
			v="none";
		}
		let q= t_dict[v];
		if (!q){
			t_dict[v]=1;
		}
		else{
			t_dict[v]++;
		}
	}
	let arr=[];
	for (let v in t_dict){
		arr.push({"value":v,"count":t_dict[v]})
	}
	arr.sort(function(a,b){
		if (a.count===b.count){
			return a.value.localeCompare(b.value);
		}
		return b.count-a.count;
	})
	return arr;

}


function groupAndOrderArrayData(data,field,delimiter){
	let t_dict={}
	for (let item of data){

		let i = item[field];
		if (i===undefined || i === null){
			continue;
		}
		let values = i.split(",");
		for (let v of values){
			if (v===undefined || v== null){
				v="none";
			}
			let q= t_dict[v];
			if (!q){
				t_dict[v]=1;
			}
			else{
				t_dict[v]++;
			}
		}
	}
	let arr=[];
	for (let v in t_dict){
		arr.push({"value":v,"count":t_dict[v]})
	}
	arr.sort(function(a,b){
		if (a.count===b.count){
			return a.value.localeCompare(b.value);
		}
		return b.count-a.count;
	})
	console.log(arr);
	return arr;

}



FilterPanel.color_schemes = {
	'spectral8': ['#3288bd','#66c2a5','#abdda4','#e6f598','#fee08b','#fdae61','#f46d43','#d53e4f'],
    'puOr11': ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'],
    'redBlackGreen': ['#ff0000', '#AA0000', '#550000', '#005500', '#00AA00', '#00ff00']
};


FilterPanel.cat_color_schemes={
	"Scheme 1":[
	"#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999", "#1CE6FF", "#FF34FF",
	"#FF4A46", "#008941", "#676FA6", "#A30059", "#FFDBE5", "#7A4900", "#0000A6", "#63FFAC", "#B79762",
	"#004D43", "#8FB0FF", "#997D87", "#5A0007", "#809693", "#FEFFE6", "#1B4400", "#4FC601", "#3B5DFF", "#4A3B53", "#FF2F80",
"#61615A", "#BA0900", "#6B7900", "#00C2A0", "#FFAA92", "#FF90C9", "#B903AA", "#D16100",
"#DDEFFF", "#000035", "#7B4F4B", "#A1C299", "#300018", "#0AA6D8", "#013349", "#00846F",
"#372101", "#FFB500", "#C2FFED", "#A079BF", "#CC0744", "#C0B9B2", "#C2FF99", "#001E09",
"#00489C", "#6F0062", "#0CBD66", "#EEC3FF", "#456D75", "#B77B68", "#7A87A1", "#788D66",
"#885578", "#FAD09F", "#FF8A9A", "#D157A0", "#BEC459", "#456648", "#0086ED", "#886F4C",
"#34362D", "#B4A8BD", "#00A6AA", "#452C2C", "#636375", "#A3C8C9", "#FF913F", "#938A81",
"#575329", "#00FECF", "#B05B6F", "#8CD0FF", "#3B9700", "#04F757", "#C8A1A1", "#1E6E00",
"#7900D7", "#A77500", "#6367A9", "#A05837", "#6B002C", "#772600", "#D790FF", "#9B9700",
"#549E79", "#FFF69F", "#201625", "#72418F", "#BC23FF", "#99ADC0", "#3A2465", "#922329",
"#5B4534", "#FDE8DC"],
	"Scheme 2":d3.schemeSet1.slice(1,9)
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
* @param {Object} column - The column to color by - should have the following keys field,name and datatype.
* @param {Object []} data - The actual data (as a list of objects) - required to work out categories or min/max values.
* If you want to set your own max/min values , simply pass and array containing just the min and max . e.g if column.field
* was weight pass [{weight:<min_value>},{weight:<max_value}]. Similarly for categorical data just pass a list of the categories.
* e.g if column field was 'color' pass [{color:"blue"},{color:"red"},....]
* @param {string []) scale - A list of hex value colors - used to create continous scale for numerical data
* and a discrete data for text. Default values will be used if none are given
* @param {string} div_id - Optional.The id of the div to attach the color legend to. The color legend will have the id <div-id>-bar
* @returns (Object) func- scale function which will return the color as rgb(x , y ,z) for a given value.The function also
* the column and in the case of the categorical (text) data items 'value_to_color', and
* object of values to their colors. If there were more categories than colors - excess categories will be assigned to other
*/

FilterPanel.getColorScale=function(column,data,scheme,div_id,colors){
		let scale= null;
		let default_scheme=(column.datatype==="text")?"Scheme 1":"spectral8"
		if (!scheme){
			scheme = default_scheme;
		}

		if (scheme instanceof Array){
			scale=scheme;
		}
		else{
			let  scales= (column.datatype==="text")?FilterPanel.cat_color_schemes:FilterPanel.color_schemes;
			scale =scales[scheme];
			if (!scale){
				scale=scales[default_scheme];
			}
		}

	if (column.datatype === "text"){
		let other_color = "rgb(220, 220, 220)";
		let values = groupAndOrder(data,column.field);
		let value_to_color={};
		let items=[];
		let n_scale=[];
		
	
		for (let c of scale){
			n_scale.push(hexToRgb(c))
		}
		let value_to_number={};
		let tot=0;
		if (colors){
		    for (let i=0;i<values.length;i++){
				value_to_number[values[i].value]=values[i].count;
				tot+=values[i].count;
			}
			for (let col of colors){
				let rgb = hexToRgb(col[1]);
				value_to_color[col[0]]=rgb;
				items.push({text:col[0],color:rgb});
			}
			
		}
		else{
			for (let i=0;i<n_scale.length;i++){
				if (i===values.length){
					break;
				}
				value_to_color[values[i].value]=n_scale[i];
				value_to_number[values[i].value]=values[i].count;
				tot+=values[i].count;
				items.push({text:values[i].value,color:n_scale[i]})
			}
		}
		if (values.length>items.length){
			items.push({text:"Other",color:other_color})
			value_to_number["other"] = data.length-tot;
		}

		let color_function=function(v){
			let c= value_to_color[v];
			return c?c:other_color
		}
		if (div_id){
			new MLVColorLegend(div_id,items,column.name);
		}
		return {
			func:color_function,
			column:column,
			value_to_color:value_to_color,
			value_to_number:value_to_number,
			scheme:scheme
		}
	}
	else{
		let min_max = findMinMax(data,column.field);
		let scale =FilterPanel.color_schemes[scheme];
		let color_scale=null;
		if (column.log_scale){
			color_scale=d3.scaleSymlog();
		}
		else{
			color_scale=d3.scaleLinear();
		}
		let max = min_max[1];
		let min = min_max[0];
		if (column.max_value !== undefined){
			max=parseFloat(column.max_value);
		}
		if (column.min_value !== undefined){
			min=parseFloat(column.min_value);
		}
        
        color_scale.domain(linspace(min,max,scale.length))
                .range(scale).clamp(true);
      
          let config={
                height:10,
                width:120,
                min:min,
                max:max,
               column:column
            
            }
       	if (div_id){
        	new MLVScaleBar(div_id,color_scale,config);
       	}
        
        return {
        	func:color_scale,
        	column:column,
        	scheme:scheme
        }

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
     		existing_param:existing_param,
     		data:data,
     		has_legend:div_id!==undefined
     	}
        super(columns,callback,"Color By",[260,350],"OK",config);

        this.div_id=div_id;
         let tb = this.div.parent().find(".ui-dialog-titlebar");
		let icon =$("<i class='fas fa-palette'></i>")
			.css({"float":"left","margin-top":"4px","font-size":"18px"});
		tb.prepend(icon);
     }

     _init(){
        let field_div=$("<div>").appendTo(this.div);
        field_div.append("<label>Field:</label>");
        let self = this;
        this.field_select = $("<select>").appendTo(field_div)
        	.on("change",function(){
        		let col = self.field_to_column[$(this).val()];
        		self.column=col;
        		delete col.log_scale;
        		delete col.min_value;
        		delete col.max_value;
        		self.min_input.val("");
        		self.max_input.val("");
        		self.log_check.prop("checked",false);
        		self._populateSchemeSelect(col.datatype);
        		if (col.datatype==="text"){
        			self.scale_div.hide();
        		}
        		else{
        			self.scale_div.show();
        		}
        		self.showScale();

        	});
        this._populateFields(this.field_select,this.config.limit_datatype);
        if (this.config.existing_param){
        	this.field_select.val(this.config.existing_param.column.field);
        }

       
        
        let scheme_div=$("<div>").appendTo(this.div);
        scheme_div.append("<label>Scheme:</label>");
        this.scheme_select = $("<select>").appendTo(scheme_div)
        	.change(function(e){
				self.showScale();
        	});
        let field = this.field_select.val();
        this.column=  this.field_to_column[field];
        if (this.config.existing_param){     	
        	this.column=this.config.existing_param.column;   
        }
		this._populateSchemeSelect(this.column.datatype);
		if (this.config.has_legend){
			let cs = $("<div>").appendTo(this.div);
			cs.append($("<span>Show Legend</span>"));
			let ch=true;
			if (this.config.existing_param){
				ch = this.config.existing_param.display_legend;
			}
			this.show_legend_check=$("<input type='checkbox'>").appendTo(cs).prop("checked",ch);
		}
        this.div.append("<hr>");
        this.scale_div= $("<div>").appendTo(this.div);
       
        
      	this.log_check=$("<input type='checkbox'>").appendTo(this.scale_div)
      		.click(function(e){
      			self.column.log_scale=$(this).prop("checked")
      			self.showScale();
      		})
       this.scale_div.append("<span>Log Scale</span>");
       this.scale_div.append("<label>Cap Scale:</label>");
	
     
		this.addMMInput("min");
		this.addMMInput("max");

    	if (this.column.datatype==="text"){
    		this.scale_div.hide();
    	}
    	this.legend_div_id=getRandomString(6,"A");
    	this.div.append($("<div>").attr("id",this.legend_div_id));

		if (this.config.existing_param){     
        	this.scheme_select.val(this.config.existing_param.scheme);
        	this.log_check.prop("checked",this.column.log_scale)
        }

    	this.showScale();
    	
        
     	}

     addMMInput(type){
     	let input =$("<input>");
     	let self = this;
     	this.scale_div.append("<span>"+type+":<span>").append(input);
     	input.css({width:"65px",height:"20px","margin-left":"2px","margin-right":"2px"})
    		.appendTo(this.scale_div)
    		.on("keypress",function(e){
                let t = $(this);
                if (e.which!==13){
                    return;
                }
                let v= parseFloat(t.val());
                if (isNaN(v)){
                	delete  self.column[type+"_value"]
                }
                else{
                	self.column[type+"_value"]=v;
                }
     
                self.showScale();
    		});
            
    	 if (this.column[type+"_value"] !== undefined){
        	input.val(this.column[type+"_value"])
        }
        this[type+"_input"]=input;

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

     cancelAction(){
     	$("#"+this.div_id+"-bar").remove();
     	this.callback(null);
     }

     showScale(){
     	let datatype =this.column.datatype
     	let data=([{"x":0},{x:100}]);
     	let scheme = this.scheme_select.val();
     	let col={
     		name:"Example",
     		field:"x",
			datatype:datatype
     	}
     	if (datatype==="text"){
     		let scale= FilterPanel.cat_color_schemes[scheme];
     		data=[];
     		for (let n=1;n<=scale.length;n++){
				data.push({"x":"cat"+n})
     		}
			
     	}
		FilterPanel.getColorScale(this.column,this.config.data,scheme,this.legend_div_id);
		$("#"+this.legend_div_id+"-bar").css({top:"10px",left:"10px"});


     }

     doAction(){
         let field = this.field_select.val();
         let label= this.field_to_column[field].name;
         let datatype  = this.field_to_column[field].datatype;
         let schemes=(datatype==="text")?FilterPanel.cat_color_schemes:FilterPanel.color_schemes;
         let scale = this.scheme_select.val();
         let col = this.field_to_column[field];
         if (this.log_check.prop("checked")){
         	col.log_scale=true;
         }
         else{
         	delete col.log_scale;
         }

         if (this.max_input.val()){
         	col.max_value= this.max_input.val();
         }
         else{
         	delete col.max_value;
         }


         if (this.min_input.val()){
         	col.min_value= this.min_input.val();
         }
         else{
         	delete col.min_value;
         }
         let color_scale= FilterPanel.getColorScale(col,this.config.data,scale,this.div_id);
         if (this.show_legend_check){
         	color_scale.display_legend= this.show_legend_check.prop("checked");
         }
         this.callback(color_scale);

     }
}

class MLVColorLegend{
	constructor(div_id,items,name){
	this.id=div_id+"-bar";
		let pos = ["24px","50px"];
		let el = $("#"+this.id)
		if (el.length){
			pos = [el.css("top"),el.css("left")];
			el.remove();
		}
        this.holder=d3.select('#'+div_id).append("svg").attr("id",this.id);
       
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
        }).css({top:pos[0],left:pos[1]});//position({"my":"right top","at":"right top","of":"#"+div_id});
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
        let pos = ["24px","50px"];
		let el = $("#"+this.id)
		if (el.length){
			pos = [el.css("top"),el.css("left")];
			el.remove();
		}
        this.holder=d3.select('#'+div_id).append("svg").attr("id",this.id); 
      
        this.svg =this.holder.append('g');

        this.title=this.holder.append("text")
        .text(config.column.name).attrs({x:10,"alignment-baseline":"hanging"}).style("font-size","12px");
       
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
        if (this.config.column.log_scale){
        	this.legend_scale=d3.scaleSymlog();
        }
        else{
        	this.legend_scale = d3.scaleLinear();
        }
             

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
        }).css({top:pos[0],left:pos[1]});
        this.holder.on("mousedown",function( event ) {
             d3.event.stopPropagation();
        }).style("cursor","move");

     }

     draw(){
        let scale = this.color_scale.range();

        this.holder.attr('width', this.config.width+20)
            .attr('height', this.config.height+45);

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
        this.legend_scale.domain([this.config.min,this.config.max])
            .range([0,this.config.width]);

        this.legend_axis.ticks(Math.round((this.config.width)/25));
        
        this.legend.attr("transform", "translate(0, "+this.config.height+")")
            .call(this.legend_axis)
             .selectAll("text")	
            .style("text-anchor", "end")
            .attr("dx", "-.05em")
            .attr("dy", ".3em")
            .attr("transform", function(d) {
                return "rotate(-45)" 
                });

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


function getRandomString(len,an){
		if (!len){
			len=6;
		}
    	an = an&&an.toLowerCase();
    	let str="", i=0, min=an=="a"?10:0, max=an=="n"?10:62;
   	 	for(;i++<len;){
      		let r = Math.random()*(max-min)+min <<0;
      		str += String.fromCharCode(r+=r>9?r<36?55:61:48);
    	}
    	return str;
    }




function copyStylesInline(destinationNode, sourceNode) {
   var containerElements = ["svg","g"];
   for (var cd = 0; cd < destinationNode.childNodes.length; cd++) {
       var child = destinationNode.childNodes[cd];
       if (containerElements.indexOf(child.tagName) != -1) {
            copyStylesInline(child, sourceNode.childNodes[cd]);
            continue;
       }
       var style = sourceNode.childNodes[cd].currentStyle || window.getComputedStyle(sourceNode.childNodes[cd]);
       if (style == "undefined" || style == null) continue;
       for (var st = 0; st < style.length; st++){
            child.style.setProperty(style[st], style.getPropertyValue(style[st]));
       }
   }
}



function getImageFromSVG(svg,callback) {
  var copy = svg.cloneNode(true);
  copyStylesInline(copy, svg);
  var canvas = document.createElement("canvas");
  var bbox = svg.getBBox();
  $(copy).css("top","0px");
  canvas.width = svg.width.baseVal.value
  canvas.height =svg.height.baseVal.value
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var data = (new XMLSerializer()).serializeToString(copy);
  var DOMURL = window.URL || window.webkitURL || window;
  var img = new Image();
  var svgBlob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
  var url = DOMURL.createObjectURL(svgBlob);
  img.src = url;
        img.onload = function () {
        ctx.drawImage(img, 0, 0);
        callback(canvas,ctx)
  }
 
}

class PopUpWindow{
	constructor(div){
		let rs = getRandomString();
		let self =this;
		let winHtml = "<!DOCTYPE html><html><body><div id= '"+rs+"' ></div></body><html>";
		let winUrl = URL.createObjectURL(
				new Blob([winHtml], { type: "text/html" })
		);

		this.window = window.open(
			winUrl,
			"win"+rs,
		`width=800,height=400,screenX=200,screenY=200;modal=yes`
		);

	     this.window.onload = function() {

		 let d = $(self.window.document.getElementById(rs));
		 d.append(div)

	    }
    }
}








export {MLVRingChart,WGLScatterPlot,MLVScatterPlot,MLVBarChart,MLVChart,FilterPanel,AddChartDialog,ColorByDialog,WGLChart,groupAndOrder,MLVChartDialog,MLVDCChart,MLVColorLegend,findMinMax};


